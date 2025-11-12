/**
 * Audio Extractor
 * Handles audio transcription with timestamps using OpenAI Whisper API
 * Pure extraction logic (no database dependencies)
 */

const { AudioExtractionError } = require('../errors/processing-errors');
const { validateBuffer } = require('../utils/input-validator');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

/**
 * Get audio format from MIME type or file extension
 */
function getAudioFormat(mimeType, fileName) {
    const mimeToFormat = {
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/x-m4a': 'm4a',
        'audio/m4a': 'm4a',
        'audio/mp4': 'm4a', // Some systems use audio/mp4 for m4a files
        'audio/ogg': 'ogg',
        'audio/flac': 'flac',
        'audio/aac': 'aac',
        'audio/x-aac': 'aac' // Alternative AAC MIME type
    };
    
    if (mimeType && mimeToFormat[mimeType]) {
        return mimeToFormat[mimeType];
    }
    
    // Fallback to file extension
    if (fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext && ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'].includes(ext)) {
            return ext;
        }
    }
    
        return 'mp3'; // Default fallback
}

/**
 * Process transcription result and return formatted output
 * 
 * @param {Object} result - OpenAI transcription result
 * @param {string} bufferSizeMBFormatted - Formatted buffer size in MB
 * @param {string} audioFormat - Audio format (mp3, wav, etc.)
 * @returns {Object} Formatted transcription result
 */
async function processTranscriptionResult(result, bufferSizeMBFormatted, audioFormat) {
    // Validate result
    if (!result || !result.text) {
        throw new AudioExtractionError('Transcription produced no text', {
            hasResult: !!result,
            hasText: !!result?.text
        });
    }
    
    // Extract segments (Whisper verbose_json format includes segments with timestamps)
    const segments = result.segments || [];
    const duration = result.duration || (segments.length > 0 ? segments[segments.length - 1].end : 0);
    
    // Ensure segments have required fields
    const validSegments = segments.map(segment => ({
        start: segment.start || 0,
        end: segment.end || 0,
        text: segment.text || ''
    })).filter(segment => segment.text.trim().length > 0);
    
    return {
        text: result.text,
        segments: validSegments,
        duration: duration,
        format: audioFormat,
        metadata: {
            transcriptionMethod: 'openai-whisper-1',
            totalCharacters: result.text.length,
            segmentCount: validSegments.length,
            audioFormat: audioFormat,
            duration: duration
        }
    };
}

/**
 * Transcribe audio with timestamps using OpenAI Whisper API or Groq
 * 
 * @param {Buffer} buffer - Audio file buffer
 * @param {Object} transcriptionClient - OpenAI or Groq client instance (OpenAI-compatible API)
 * @param {string} mimeType - Audio MIME type (optional)
 * @param {string} fileName - Audio file name (optional)
 * @param {Object} logger - Processing logger instance (optional, for progress logging)
 * @param {Object} supabase - Supabase client (optional, for progress logging)
 * @param {string} userDocId - User document ID (optional, for progress logging)
 * @param {string} transcriptionMethod - Method identifier ('groq-whisper-large-v3-turbo' or 'openai-whisper-1')
 * @returns {Promise<{text: string, segments: Array<{start: number, end: number, text: string}>, duration: number, format: string}>} Transcription result
 * @throws {AudioExtractionError} If transcription fails
 */
async function transcribeAudioWithTimestamps(buffer, transcriptionClient, mimeType = null, fileName = null, logger = null, supabase = null, userDocId = null, transcriptionMethod = 'openai-whisper-1') {
    try {
        // Validate buffer
        validateBuffer(buffer, 'Audio buffer');
        
        // Validate transcription client (OpenAI or Groq - both use OpenAI-compatible API)
        if (!transcriptionClient || typeof transcriptionClient.audio?.transcriptions?.create !== 'function') {
            throw new AudioExtractionError('Transcription client is required and must support audio transcription', {
                hasClient: !!transcriptionClient,
                hasAudio: !!transcriptionClient?.audio,
                hasTranscriptions: !!transcriptionClient?.audio?.transcriptions
            });
        }
        
        // Determine model based on provider
        const isGroq = transcriptionMethod.includes('groq');
        const model = isGroq ? 'whisper-large-v3-turbo' : 'whisper-1';
        
        // Check file size (Whisper API supports up to 25MB)
        const bufferSizeMB = buffer.length / 1024 / 1024;
        const MAX_CHUNK_SIZE_MB = 20; // Use 20MB to be safe (under 25MB limit)
        
        if (bufferSizeMB > MAX_CHUNK_SIZE_MB) {
            // File is too large - need to split it
            console.log(`📦 Large audio file detected (${bufferSizeMB.toFixed(2)}MB), splitting into chunks...`);
            return await transcribeLargeAudioFile(buffer, transcriptionClient, mimeType, fileName, MAX_CHUNK_SIZE_MB, logger, supabase, userDocId, transcriptionMethod);
        }
        
        // Calculate timeout based on file size
        // Base: 5 minutes, +2 minutes per 5MB
        const baseTimeoutMs = 5 * 60 * 1000; // 5 minutes base
        const additionalTimeoutMs = Math.floor(bufferSizeMB / 5) * 2 * 60 * 1000; // +2 min per 5MB
        const TRANSCRIPTION_TIMEOUT_MS = baseTimeoutMs + additionalTimeoutMs;
        const maxTimeoutMs = 30 * 60 * 1000; // Cap at 30 minutes
        const finalTimeout = Math.min(Math.max(TRANSCRIPTION_TIMEOUT_MS, baseTimeoutMs), maxTimeoutMs);
        
        const audioFormat = getAudioFormat(mimeType, fileName);
        const bufferSizeMBFormatted = bufferSizeMB.toFixed(2);
        
        console.log(`🎵 Starting audio transcription: ${bufferSizeMBFormatted}MB ${audioFormat} file (timeout: ${(finalTimeout / 60000).toFixed(1)} minutes)`);
        
        // Create a File object for OpenAI API
        // OpenAI SDK accepts File objects or File-like objects with proper structure
        const fileExtension = audioFormat === 'm4a' ? 'm4a' : audioFormat;
        const audioMimeType = mimeType || `audio/${fileExtension}`;
        const audioFileName = fileName || `audio.${fileExtension}`;
        
        let file;
        // Check if File constructor is available (Node.js 18+)
        if (typeof File !== 'undefined' && File.prototype && File.prototype.constructor) {
            // Node.js 18+ has native File support
            file = new File([buffer], audioFileName, { type: audioMimeType });
        } else {
            // Fallback for older Node.js versions: create File-like object
            // OpenAI SDK accepts objects that can be converted to File-like format
            // We'll use the buffer directly with proper metadata
            const { Readable } = require('stream');
            const stream = Readable.from(buffer);
            // Create a File-like object that OpenAI SDK can handle
            file = Object.assign(buffer, {
                name: audioFileName,
                type: audioMimeType,
                size: buffer.length,
                stream: () => stream,
                arrayBuffer: async () => buffer.buffer || buffer,
                text: async () => buffer.toString('utf-8')
            });
        }
        
        // Wrap transcription in timeout promise with retry logic for connection errors
        // Note: Omitting language parameter allows auto-detection (default behavior)
        const maxRetries = 3;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const transcriptionPromise = transcriptionClient.audio.transcriptions.create({
                    file: file,
                    model: model,
                    response_format: 'verbose_json' // Get timestamps
                    // language parameter omitted - auto-detect is the default
                });
                
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new AudioExtractionError(
                            `Audio transcription timed out after ${(finalTimeout / 60000).toFixed(1)} minutes. The audio file may be too long or complex.`,
                            { 
                                bufferSize: buffer.length,
                                bufferSizeMB: bufferSizeMBFormatted,
                                timeoutMs: finalTimeout,
                                timeoutMinutes: (finalTimeout / 60000).toFixed(1)
                            }
                        ));
                    }, finalTimeout);
                });
                
                // Race between transcription and timeout
                const result = await Promise.race([transcriptionPromise, timeoutPromise]);
                
                // Success - break out of retry loop
                console.log(`✅ Audio transcription completed: ${bufferSizeMBFormatted}MB processed`);
                return await processTranscriptionResult(result, bufferSizeMBFormatted, audioFormat);
                
            } catch (error) {
                lastError = error;
                
                // Check if it's a retryable connection error
                const isConnectionError = error.message?.includes('Connection error') ||
                                        error.message?.includes('ECONNRESET') ||
                                        error.message?.includes('ETIMEDOUT') ||
                                        error.message?.includes('network') ||
                                        error.code === 'ECONNRESET' ||
                                        error.code === 'ETIMEDOUT';
                
                // Don't retry on non-retryable errors or if we've exhausted retries
                if (!isConnectionError || attempt >= maxRetries) {
                    throw error;
                }
                
                // Exponential backoff: wait 2^attempt seconds before retrying
                const backoffSeconds = Math.pow(2, attempt);
                console.log(`⚠️  Connection error on attempt ${attempt}/${maxRetries}, retrying in ${backoffSeconds}s...`);
                await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
            }
        }
        
        // If we get here, all retries failed
        throw lastError;
        
    } catch (error) {
        // Re-throw AudioExtractionError as-is
        if (error instanceof AudioExtractionError) {
            throw error;
        }
        
        // Handle OpenAI API errors
        let errorMessage = error.message || 'Unknown error';
        if (error.status === 413 || errorMessage.includes('too large') || errorMessage.includes('file size')) {
            errorMessage = 'Audio file is too large. Whisper API supports files up to 25MB.';
        } else if (error.status === 400 || errorMessage.includes('invalid')) {
            errorMessage = 'Audio file format is not supported or file is corrupted.';
        } else if (error.status === 429) {
            errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
        } else if (errorMessage.includes('timeout')) {
            errorMessage = `Audio transcription timed out: ${errorMessage}`;
        } else {
            errorMessage = `Audio transcription failed: ${errorMessage}`;
        }
        
        // Wrap other errors
        throw new AudioExtractionError(
            errorMessage,
            {
                originalError: error.message,
                status: error.status,
                code: error.code,
                bufferSize: buffer?.length || 0
            }
        );
    }
}

/**
 * Split large audio file and transcribe chunks, then combine results
 * Uses ffmpeg to split audio into chunks under 25MB
 * 
 * @param {Buffer} buffer - Audio file buffer
 * @param {Object} transcriptionClient - OpenAI or Groq client instance (OpenAI-compatible API)
 * @param {string} mimeType - Audio MIME type (optional)
 * @param {string} fileName - Audio file name (optional)
 * @param {number} maxChunkSizeMB - Maximum size per chunk in MB
 * @param {Object} logger - Processing logger instance (optional, for progress logging)
 * @param {Object} supabase - Supabase client (optional, for progress logging)
 * @param {string} userDocId - User document ID (optional, for progress logging)
 * @param {string} transcriptionMethod - Method identifier ('groq-whisper-large-v3-turbo' or 'openai-whisper-1')
 * @returns {Promise<{text: string, segments: Array<{start: number, end: number, text: string}>, duration: number, format: string}>} Combined transcription result
 */
async function transcribeLargeAudioFile(buffer, transcriptionClient, mimeType = null, fileName = null, maxChunkSizeMB = 20, logger = null, supabase = null, userDocId = null, transcriptionMethod = 'openai-whisper-1') {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-split-'));
    const audioFormat = getAudioFormat(mimeType, fileName);
    const fileExtension = audioFormat === 'm4a' ? 'm4a' : audioFormat;
    const inputFile = path.join(tempDir, `input.${fileExtension}`);
    const outputPattern = path.join(tempDir, `chunk_%03d.${fileExtension}`);
    
    try {
        const bufferSizeMB = buffer.length / 1024 / 1024;
        console.log(`📦 Starting large audio file processing: ${bufferSizeMB.toFixed(2)}MB`);
        if (logger && supabase && userDocId) {
            await logger.progress(supabase, userDocId, null, logger.STAGES.TRANSCRIBE, 'Large audio file detected, splitting into chunks', {
                file_size_mb: bufferSizeMB.toFixed(2),
                action: 'splitting'
            }, 'vps');
        }
        
        // Write buffer to temp file
        console.log(`💾 Writing audio buffer to temp file...`);
        await fs.writeFile(inputFile, buffer);
        console.log(`✅ Temp file written: ${inputFile}`);
        
        // Get audio duration using ffprobe
        console.log(`🔍 Analyzing audio duration with ffprobe...`);
        if (logger && supabase && userDocId) {
            await logger.progress(supabase, userDocId, null, logger.STAGES.TRANSCRIBE, 'Analyzing audio duration', {
                action: 'analyzing'
            }, 'vps');
        }
        
        const { stdout: probeOutput } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputFile}"`
        );
        const duration = parseFloat(probeOutput.trim());
        
        if (!duration || isNaN(duration)) {
            throw new AudioExtractionError('Could not determine audio duration', { fileName });
        }
        
        console.log(`✅ Audio duration: ${duration.toFixed(1)}s`);
        
        // Calculate chunk duration (aim for ~20MB chunks)
        // Estimate: assume similar compression ratio, so split by time proportionally
        const estimatedChunkDuration = (duration * maxChunkSizeMB) / bufferSizeMB;
        const numChunks = Math.ceil(duration / estimatedChunkDuration);
        const actualChunkDuration = duration / numChunks;
        
        console.log(`📊 Audio info: ${duration.toFixed(1)}s, ${bufferSizeMB.toFixed(2)}MB, splitting into ~${numChunks} chunks of ~${actualChunkDuration.toFixed(1)}s each`);
        
        // Split audio using ffmpeg
        // Use segment muxer for clean splits
        console.log(`✂️  Splitting audio with ffmpeg (this may take a moment)...`);
        if (logger && supabase && userDocId) {
            await logger.progress(supabase, userDocId, null, logger.STAGES.TRANSCRIBE, `Splitting audio into ${numChunks} chunks`, {
                duration_seconds: duration.toFixed(1),
                num_chunks: numChunks,
                chunk_duration_seconds: actualChunkDuration.toFixed(1),
                action: 'splitting'
            }, 'vps');
        }
        
        await execAsync(
            `ffmpeg -i "${inputFile}" -f segment -segment_time ${actualChunkDuration} -c copy -reset_timestamps 0 "${outputPattern}" -y`
        );
        console.log(`✅ Audio split completed`);
        
        // Find all chunk files
        const files = await fs.readdir(tempDir);
        const chunkFiles = files
            .filter(f => f.startsWith('chunk_') && f.endsWith(`.${fileExtension}`))
            .sort()
            .map(f => path.join(tempDir, f));
        
        console.log(`✅ Split into ${chunkFiles.length} chunks`);
        
        // Transcribe each chunk
        const chunkResults = [];
        let cumulativeTimeOffset = 0;
        
        console.log(`🎵 Starting transcription of ${chunkFiles.length} chunks...`);
        if (logger && supabase && userDocId) {
            await logger.progress(supabase, userDocId, null, logger.STAGES.TRANSCRIBE, `Starting transcription of ${chunkFiles.length} chunks`, {
                total_chunks: chunkFiles.length,
                action: 'transcribing_chunks'
            }, 'vps');
        }
        
        for (let i = 0; i < chunkFiles.length; i++) {
            const chunkFile = chunkFiles[i];
            const chunkBuffer = await fs.readFile(chunkFile);
            const chunkSizeMB = chunkBuffer.length / 1024 / 1024;
            
            console.log(`🎵 [${i + 1}/${chunkFiles.length}] Transcribing chunk (${chunkSizeMB.toFixed(2)}MB, offset: ${cumulativeTimeOffset.toFixed(1)}s)...`);
            if (logger && supabase && userDocId) {
                await logger.progress(supabase, userDocId, null, logger.STAGES.TRANSCRIBE, `Transcribing chunk ${i + 1}/${chunkFiles.length}`, {
                    chunk_number: i + 1,
                    total_chunks: chunkFiles.length,
                    chunk_size_mb: chunkSizeMB.toFixed(2),
                    time_offset_seconds: cumulativeTimeOffset.toFixed(1),
                    action: 'transcribing_chunk'
                }, 'vps');
            }
            
            const chunkStartTime = Date.now();
            
                    // Transcribe chunk (recursive call, but chunk should be < 25MB)
                    // Don't pass logger/supabase/userDocId for individual chunks to avoid excessive logging
                    const chunkResult = await transcribeAudioWithTimestamps(chunkBuffer, transcriptionClient, mimeType, `chunk_${i + 1}.${fileExtension}`, null, null, null, transcriptionMethod);
            
            const chunkTime = ((Date.now() - chunkStartTime) / 1000).toFixed(1);
            console.log(`✅ [${i + 1}/${chunkFiles.length}] Chunk transcribed in ${chunkTime}s (${chunkResult.text.length} chars, ${chunkResult.segments.length} segments)`);
            
            if (logger && supabase && userDocId) {
                await logger.progress(supabase, userDocId, null, logger.STAGES.TRANSCRIBE, `Chunk ${i + 1}/${chunkFiles.length} transcribed successfully`, {
                    chunk_number: i + 1,
                    total_chunks: chunkFiles.length,
                    transcription_time_seconds: chunkTime,
                    characters: chunkResult.text.length,
                    segments: chunkResult.segments.length,
                    action: 'chunk_completed'
                }, 'vps');
            }
            
            // Adjust timestamps by adding cumulative time offset
            const adjustedSegments = chunkResult.segments.map(segment => ({
                start: segment.start + cumulativeTimeOffset,
                end: segment.end + cumulativeTimeOffset,
                text: segment.text
            }));
            
            chunkResults.push({
                text: chunkResult.text,
                segments: adjustedSegments,
                duration: chunkResult.duration
            });
            
            // Update cumulative time offset for next chunk
            // Use the actual duration from transcription (more accurate than estimated)
            cumulativeTimeOffset += chunkResult.duration;
        }
        
        // Combine all results
        const combinedText = chunkResults.map(r => r.text).join(' ');
        const combinedSegments = chunkResults.flatMap(r => r.segments);
        const totalDuration = chunkResults.reduce((sum, r) => sum + r.duration, 0);
        
        console.log(`✅ Combined transcription: ${combinedText.length} characters, ${combinedSegments.length} segments, ${totalDuration.toFixed(1)}s total`);
        
        return {
            text: combinedText,
            segments: combinedSegments,
            duration: totalDuration,
            format: audioFormat,
            metadata: {
                transcriptionMethod: transcriptionMethod.includes('groq') ? 'groq-whisper-large-v3-turbo-split' : 'openai-whisper-1-split',
                totalCharacters: combinedText.length,
                segmentCount: combinedSegments.length,
                audioFormat: audioFormat,
                duration: totalDuration,
                numChunks: chunkFiles.length,
                originalSizeMB: bufferSizeMB.toFixed(2)
            }
        };
        
    } catch (error) {
        // Clean up temp files on error
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error('Failed to clean up temp directory:', cleanupError);
        }
        
        if (error instanceof AudioExtractionError) {
            throw error;
        }
        
        // Check if ffmpeg/ffprobe is available
        if (error.message?.includes('ffmpeg') || error.message?.includes('ffprobe') || error.code === 'ENOENT') {
            throw new AudioExtractionError(
                'ffmpeg is required to process large audio files (>25MB). Please install ffmpeg: brew install ffmpeg',
                { fileName, originalError: error.message }
            );
        }
        
        throw new AudioExtractionError(
            `Failed to transcribe large audio file: ${error.message}`,
            { originalError: error.message, fileName }
        );
    } finally {
        // Clean up temp files
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error('Failed to clean up temp directory:', cleanupError);
        }
    }
}

/**
 * Download audio file from Supabase Storage
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} filePath - Path to file in storage
 * @returns {Promise<Buffer>} Audio buffer
 * @throws {AudioExtractionError} If download fails
 */
async function downloadAudioFromStorage(supabase, filePath) {
    try {
        if (!filePath) {
            throw new AudioExtractionError('file_path is required', { filePath });
        }
        
        const { data, error } = await supabase.storage
            .from('user-documents')
            .download(filePath);
        
        if (error) {
            throw new AudioExtractionError(
                `Failed to download audio: ${error.message}`,
                { filePath, error: error.message }
            );
        }
        
        if (!data) {
            throw new AudioExtractionError(
                'Audio download returned no data',
                { filePath }
            );
        }
        
        // Convert blob to buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Validate buffer
        validateBuffer(buffer, 'Downloaded audio buffer');
        
        return buffer;
        
    } catch (error) {
        // Re-throw AudioExtractionError as-is
        if (error instanceof AudioExtractionError) {
            throw error;
        }
        
        // Wrap other errors
        throw new AudioExtractionError(
            `Failed to download audio: ${error.message}`,
            { filePath, originalError: error.message }
        );
    }
}

module.exports = {
    transcribeAudioWithTimestamps,
    downloadAudioFromStorage,
    getAudioFormat
};

