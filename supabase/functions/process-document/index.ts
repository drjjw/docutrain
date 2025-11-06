import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// Import OpenAI SDK
import OpenAI from 'npm:openai@4';

// Configuration matching lib/document-processor.js
const CHUNK_SIZE = 500; // tokens (roughly 2000 characters)
const CHUNK_OVERLAP = 100; // tokens (roughly 400 characters)
const CHARS_PER_TOKEN = 4; // Rough estimate
const BATCH_SIZE = 50; // Process embeddings in batches
const BATCH_DELAY_MS = 100; // Small delay between batches

// Initialize Supabase client with service role
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI client
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
const openai = new OpenAI({ apiKey: openaiApiKey });

/**
 * Logging stages (matching VPS logger)
 */
const STAGES = {
  DOWNLOAD: 'download',
  EXTRACT: 'extract',
  CHUNK: 'chunk',
  EMBED: 'embed',
  STORE: 'store',
  COMPLETE: 'complete',
  ERROR: 'error'
};

const STATUSES = {
  STARTED: 'started',
  PROGRESS: 'progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Log to database (Edge Function version)
 */
async function logToDatabase(
  userDocId: string,
  documentSlug: string | null,
  stage: string,
  status: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  try {
    const { error } = await supabase
      .from('document_processing_logs')
      .insert({
        user_document_id: userDocId,
        document_slug: documentSlug,
        stage,
        status,
        message,
        metadata,
        processing_method: 'edge_function'
      });

    if (error) {
      console.error(`[Edge Logger] Failed to write to database log (${stage}:${status}):`, error);
    }
  } catch (error) {
    console.error(`[Edge Logger] Exception writing to database log (${stage}:${status}):`, error);
  }
}

/**
 * Clean PDF text to reduce noise (matches lib/document-processor.js)
 */
function cleanPDFText(text: string): string {
  let cleaned = text;

  // Convert "Page X" headers to citation markers
  cleaned = cleaned.replace(/\s*Page (\d+)\s*/g, '\n[Page $1]\n');

  // Convert standalone page numbers to citation markers
  cleaned = cleaned.replace(/^\s*(\d+)\s*$/gm, '\n[Page $1]\n');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

  // Trim lines
  cleaned = cleaned.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  return cleaned;
}

/**
 * Extract text from PDF buffer (simplified - using pdf-parse equivalent)
 */
async function extractPDFTextWithPageMarkers(buffer: Uint8Array): Promise<{ text: string; pages: number }> {
  // Use pdf-parse via npm: compatibility
  const pdfParse = await import('npm:pdf-parse@1.1.1');
  
  // Convert Uint8Array to Buffer for pdf-parse (using npm:buffer for Deno compatibility)
  const { Buffer } = await import('npm:buffer@6.0.3');
  const pdfBuffer = Buffer.from(buffer);
  
  const data = await pdfParse.default(pdfBuffer);
  let fullText = data.text;
  const numPages = data.numpages;

  // Check if text already has page markers
  const pageMarkerRegex = /\[Page \d+\]/g;
  const existingMarkers = fullText.match(pageMarkerRegex);

  if (!existingMarkers || existingMarkers.length < numPages * 0.5) {
    // Clean the text first
    fullText = cleanPDFText(fullText);

    // Calculate approximate characters per page
    const totalChars = fullText.length;
    const avgCharsPerPage = Math.floor(totalChars / numPages);

    // Insert page markers at estimated boundaries
    let markedText = '';
    let currentPos = 0;
    let currentPage = 1;

    // Add first page marker
    markedText += `[Page ${currentPage}]\n`;

    while (currentPos < totalChars && currentPage <= numPages) {
      const pageEnd = Math.min(currentPos + avgCharsPerPage, totalChars);
      const pageText = fullText.substring(currentPos, pageEnd);

      markedText += pageText;

      currentPos = pageEnd;
      currentPage++;

      if (currentPage <= numPages && currentPos < totalChars) {
        markedText += `\n\n[Page ${currentPage}]\n`;
      }
    }

    fullText = markedText;
  }

  return { text: fullText, pages: numPages };
}

/**
 * Split text into overlapping chunks with accurate page detection
 */
function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP, totalPages: number = 1) {
  const chunks: Array<{
    index: number;
    content: string;
    charStart: number;
    charEnd: number;
    pageNumber: number;
    pageMarkersFound: number;
  }> = [];
  
  const chunkChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  // Find all page markers and their positions
  const pageMarkers: Array<{ pageNum: number; position: number }> = [];
  const pageMarkerRegex = /\[Page (\d+)\]/g;
  let match;
  while ((match = pageMarkerRegex.exec(text)) !== null) {
    const pageNum = parseInt(match[1]);
    const position = match.index;
    pageMarkers.push({ pageNum, position });
  }

  // Sort by position
  pageMarkers.sort((a, b) => a.position - b.position);

  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length);
    const chunk = text.substring(start, end);

    // Only include non-empty chunks
    if (chunk.trim().length > 0) {
      // Determine actual page number using page markers
      const chunkCenter = start + (end - start) / 2;
      let actualPage = 1; // Default to page 1

      // Find which page this chunk belongs to
      for (let i = 0; i < pageMarkers.length; i++) {
        if (chunkCenter < pageMarkers[i].position) {
          if (i === 0) {
            actualPage = 1;
          } else {
            actualPage = pageMarkers[i - 1].pageNum;
          }
          break;
        }
      }

      // If chunk center is after the last marker, it belongs to the last page
      if (pageMarkers.length > 0 && chunkCenter >= pageMarkers[pageMarkers.length - 1].position) {
        actualPage = pageMarkers[pageMarkers.length - 1].pageNum;
      }

      // Ensure page number is within valid range
      actualPage = Math.min(Math.max(1, actualPage), totalPages);

      chunks.push({
        index: chunkIndex,
        content: chunk.trim(),
        charStart: start,
        charEnd: end,
        pageNumber: actualPage,
        pageMarkersFound: pageMarkers.length
      });
      chunkIndex++;
    }

    // Move forward by (chunkSize - overlap) to create overlap
    start += chunkChars - overlapChars;
  }

  return chunks;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
  });
  
  return response.data[0].embedding;
}

/**
 * Generate a 100-word abstract from chunks using OpenAI
 */
async function generateAbstract(chunks: Array<{ content: string }>, documentTitle: string): Promise<string | null> {
  try {
    // Use ALL chunks for better abstract quality (gpt-4o-mini supports 128k tokens)
    // This gives the model full context of the entire document
    const chunksForAbstract = chunks;
    
    // Combine chunk content
    const combinedText = chunksForAbstract
      .map(chunk => chunk.content)
      .join('\n\n');
    
    // gpt-4o-mini supports 128k tokens (~500k characters), but we'll be conservative
    // Use up to 400k characters (~100k tokens) to leave room for response and system prompt
    const maxChars = 400000; // ~100k tokens (conservative limit for 128k context window)
    const textForAbstract = combinedText.length > maxChars 
      ? combinedText.substring(0, maxChars) + '...'
      : combinedText;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating concise, informative abstracts from document content. Create a 100-word abstract that captures the key themes, purpose, and scope of the document.'
        },
        {
          role: 'user',
          content: `Please create a 100-word abstract for a document titled "${documentTitle}". Base your abstract on the following content from the document:\n\n${textForAbstract}\n\nProvide ONLY the abstract text, no additional commentary. The abstract should be exactly 100 words.`
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });
    
    const abstract = response.choices[0]?.message?.content?.trim();
    return abstract || null;
    
  } catch (error) {
    console.error('Failed to generate abstract:', error);
    return null;
  }
}

/**
 * Common English stop words to filter out
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they',
  'have', 'had', 'what', 'said', 'each', 'which', 'their', 'time',
  'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'some',
  'her', 'would', 'make', 'like', 'into', 'him', 'has', 'two', 'more',
  'very', 'after', 'words', 'long', 'than', 'first', 'been', 'call',
  'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did', 'get',
  'come', 'made', 'may', 'part', 'over', 'new', 'sound', 'take',
  'only', 'little', 'work', 'know', 'place', 'year', 'live', 'me',
  'back', 'give', 'most', 'very', 'after', 'thing', 'our', 'just',
  'name', 'good', 'sentence', 'man', 'think', 'say', 'great', 'where',
  'help', 'through', 'much', 'before', 'line', 'right', 'too', 'mean',
  'old', 'any', 'same', 'tell', 'boy', 'follow', 'came', 'want',
  'show', 'also', 'around', 'form', 'three', 'small', 'set', 'put',
  'end', 'does', 'another', 'well', 'large', 'must', 'big', 'even',
  'such', 'because', 'turn', 'here', 'why', 'ask', 'went', 'men',
  'read', 'need', 'land', 'different', 'home', 'us', 'move', 'try',
  'kind', 'hand', 'picture', 'again', 'change', 'off', 'play', 'spell',
  'air', 'away', 'animal', 'house', 'point', 'page', 'letter', 'mother',
  'answer', 'found', 'study', 'still', 'learn', 'should', 'america', 'world'
]);

const MIN_WORD_LENGTH = 3;
const MAX_KEYWORDS = 30;
const MIN_FREQUENCY = 1; // Lowered from 2 to include all words that appear at least once

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= MIN_WORD_LENGTH)
    .filter(word => !STOP_WORDS.has(word));
}

/**
 * Count word frequencies
 */
function countWordFrequencies(words: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  
  for (const word of words) {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }
  
  return frequencies;
}

/**
 * Detect common phrases (bigrams and trigrams)
 */
function detectPhrases(words: string[]): Map<string, number> {
  const phrases = new Map<string, number>();
  
  // Detect bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (words[i].length >= MIN_WORD_LENGTH && words[i + 1].length >= MIN_WORD_LENGTH) {
      phrases.set(bigram, (phrases.get(bigram) || 0) + 1);
    }
  }
  
  // Detect trigrams
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (words[i].length >= MIN_WORD_LENGTH && 
        words[i + 1].length >= MIN_WORD_LENGTH && 
        words[i + 2].length >= MIN_WORD_LENGTH) {
      phrases.set(trigram, (phrases.get(trigram) || 0) + 1);
    }
  }
  
  return phrases;
}

/**
 * Normalize frequencies to weights (0.1 to 1.0)
 */
function normalizeWeights(frequencies: Map<string, number>): Map<string, number> {
  if (frequencies.size === 0) {
    return new Map();
  }
  
  const values = Array.from(frequencies.values());
  const minFreq = Math.min(...values);
  const maxFreq = Math.max(...values);
  const range = maxFreq - minFreq;
  
  const weights = new Map<string, number>();
  
  for (const [term, freq] of frequencies.entries()) {
    if (range === 0) {
      weights.set(term, 0.5);
    } else {
      const normalized = (freq - minFreq) / range;
      const weight = 0.1 + (normalized * 0.9);
      weights.set(term, Math.round(weight * 100) / 100);
    }
  }
  
  return weights;
}

/**
 * Generate keywords for word cloud from chunks using word frequency analysis
 * Returns an array of keyword objects with term and weight
 */
async function generateKeywords(chunks: Array<{ content: string }>, documentTitle: string): Promise<Array<{ term: string; weight: number }> | null> {
  console.log('🔑 Generating keywords from word frequency');
  console.log(`   Document: ${documentTitle}`);
  console.log(`   Total chunks available: ${chunks.length}`);
  
  try {
    if (!chunks || chunks.length === 0) {
      console.warn('⚠️ No chunks provided for keyword generation');
      return [];
    }
    
    // Combine all chunk content
    const combinedText = chunks
      .map(chunk => chunk.content || '')
      .filter(content => content && content.trim().length > 0)
      .join('\n\n');
    
    if (!combinedText || combinedText.trim().length === 0) {
      console.warn('⚠️ No text content found in chunks');
      return [];
    }
    
    // Tokenize text
    const words = tokenize(combinedText);
    
    if (words.length === 0) {
      console.warn('⚠️ No valid words found after tokenization');
      return [];
    }
    
    console.log(`   Tokenized ${words.length} words`);
    
    // Count word frequencies
    const wordFreqs = countWordFrequencies(words);
    console.log(`   Found ${wordFreqs.size} unique words`);
    
    // Detect phrases
    const phraseFreqs = detectPhrases(words);
    console.log(`   Found ${phraseFreqs.size} unique phrases`);
    
    // Combine words and phrases, prioritizing phrases
    const allTerms = new Map<string, number>();
    
    // Add words (single terms)
    let wordsAdded = 0;
    for (const [term, freq] of wordFreqs.entries()) {
      if (freq >= MIN_FREQUENCY) {
        allTerms.set(term, freq);
        wordsAdded++;
      }
    }
    console.log(`   Added ${wordsAdded} words (freq >= ${MIN_FREQUENCY})`);
    
    // Add phrases with frequency boost
    let phrasesAdded = 0;
    for (const [phrase, freq] of phraseFreqs.entries()) {
      if (freq >= MIN_FREQUENCY) {
        allTerms.set(phrase, Math.ceil(freq * 1.5));
        phrasesAdded++;
      }
    }
    console.log(`   Added ${phrasesAdded} phrases (freq >= ${MIN_FREQUENCY})`);
    
    if (allTerms.size === 0) {
      console.warn('⚠️ No terms found meeting minimum frequency threshold');
      console.warn(`   Word frequencies: ${wordFreqs.size} unique words`);
      console.warn(`   Phrase frequencies: ${phraseFreqs.size} unique phrases`);
      if (wordFreqs.size > 0) {
        const topWords = Array.from(wordFreqs.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([term, freq]) => `${term}:${freq}`)
          .join(', ');
        console.warn(`   Top words: ${topWords}`);
      }
      return [];
    }
    
    // Normalize to weights
    const weights = normalizeWeights(allTerms);
    
    // Convert to array and sort by weight (descending)
    const keywords = Array.from(weights.entries())
      .map(([term, weight]) => ({
        term: term.trim(),
        weight: weight
      }))
      .filter(k => k.term.length > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_KEYWORDS);
    
    // Re-sort to prioritize phrases when weights are similar
    keywords.sort((a, b) => {
      const aIsPhrase = a.term.includes(' ');
      const bIsPhrase = b.term.includes(' ');
      
      if (Math.abs(a.weight - b.weight) < 0.1) {
        if (aIsPhrase && !bIsPhrase) return -1;
        if (!aIsPhrase && bIsPhrase) return 1;
      }
      
      return b.weight - a.weight;
    });
    
    console.log(`   ✓ Generated ${keywords.length} keywords`);
    if (keywords.length > 0) {
      console.log(`   Top keywords: ${keywords.slice(0, 5).map(k => k.term).join(', ')}`);
    }
    
    return keywords;
    
  } catch (error: any) {
    console.error('⚠️ Error generating keywords from frequency:', error.message);
    console.error(error.stack);
    return []; // Return empty array on error (graceful degradation)
  }
}

/**
 * Process embeddings in batches using OpenAI batch API
 * This makes a single API call for the entire batch instead of individual calls
 */
async function processEmbeddingsBatch(chunks: Array<{ content: string }>, startIdx: number, batchSize: number) {
  const batch = chunks.slice(startIdx, startIdx + batchSize);
  const embeddings = [];
  
  try {
    // Extract all texts from the batch
    const texts = batch.map(chunk => chunk.content);
    
    // Make a single batch API call with all texts
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts, // Array of texts for batch processing
      encoding_format: 'float'
    });
    
    // Map embeddings back to chunks
    batch.forEach((chunk, index) => {
      if (response.data[index] && response.data[index].embedding) {
        embeddings.push({ 
          chunk, 
          embedding: response.data[index].embedding 
        });
      } else {
        console.error(`Failed to get embedding for chunk at index ${startIdx + index}`);
        embeddings.push({ chunk, embedding: null });
      }
    });
    
  } catch (error) {
    console.error(`Failed to embed batch starting at index ${startIdx}:`, error);
    // If batch fails, mark all chunks as failed
    batch.forEach(chunk => {
      embeddings.push({ chunk, embedding: null });
    });
  }
  
  return embeddings;
}

/**
 * Store chunks with embeddings in Supabase
 */
async function storeChunks(documentSlug: string, documentName: string, chunksWithEmbeddings: Array<{ chunk: any; embedding: number[] | null }>) {
  const records = chunksWithEmbeddings
    .filter(item => item.embedding !== null)
    .map(({ chunk, embedding }) => ({
      document_type: documentSlug,
      document_slug: documentSlug,
      document_name: documentName,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: embedding!,
      metadata: {
        char_start: chunk.charStart,
        char_end: chunk.charEnd,
        tokens_approx: Math.round(chunk.content.length / CHARS_PER_TOKEN),
        page_number: chunk.pageNumber,
        page_markers_found: chunk.pageMarkersFound
      }
    }));
  
  // Insert in batches to avoid payload size limits
  const insertBatchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += insertBatchSize) {
    const batch = records.slice(i, i + insertBatchSize);
    const { error } = await supabase
      .from('document_chunks')
      .insert(batch);
    
    if (error) {
      throw new Error(`Failed to insert batch: ${error.message}`);
    }
    
    inserted += batch.length;
  }
  
  return inserted;
}

/**
 * Generate unique slug from title
 */
function generateSlug(title: string): string {
  const timestamp = Date.now();
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  
  return `user-${baseSlug}-${timestamp}`;
}

/**
 * Main processing function
 */
async function processUserDocument(userDocId: string) {
  const startTime = Date.now();
  let documentSlug: string | null = null;
  
  try {
    // 1. Get user document record
    await logToDatabase(userDocId, null, STAGES.DOWNLOAD, STATUSES.STARTED, 'Starting document processing');
    
    const { data: userDoc, error: fetchError } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', userDocId)
      .single();
    
    if (fetchError || !userDoc) {
      throw new Error(`User document not found: ${userDocId}`);
    }
    
    // Update status to processing
    await supabase
      .from('user_documents')
      .update({ 
        status: 'processing', 
        updated_at: new Date().toISOString(),
        processing_method: 'edge_function'
      })
      .eq('id', userDocId);
    
    // 2. Get text content (either from uploaded PDF or direct text input)
    let text: string;
    let pages: number;

    // Check if this is a text upload (placeholder file_path, has text_content in metadata)
    const isTextUpload = userDoc.file_path === 'text-upload' && userDoc.metadata?.text_content && userDoc.metadata?.upload_type === 'text';

    if (isTextUpload) {
      // Direct text input - no download or extraction needed
      await logToDatabase(userDocId, null, STAGES.DOWNLOAD, STATUSES.PROGRESS, 'Processing direct text input', {
        character_count: userDoc.metadata.character_count,
        upload_type: 'text'
      });

      text = userDoc.metadata.text_content;
      pages = 1; // Treat as single page for text uploads

      await logToDatabase(userDocId, null, STAGES.DOWNLOAD, STATUSES.COMPLETED, 'Text content loaded successfully', {
        characters: text.length,
        pages: pages,
        upload_type: 'text'
      });
    } else {
      // PDF upload - download and extract
      await logToDatabase(userDocId, null, STAGES.DOWNLOAD, STATUSES.PROGRESS, 'Downloading PDF from storage', {
        file_path: userDoc.file_path,
        file_size: userDoc.file_size
      });

      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('user-documents')
        .download(userDoc.file_path);

      if (downloadError || !pdfData) {
        throw new Error(`Failed to download PDF: ${downloadError?.message || 'Unknown error'}`);
      }

      // Convert blob to buffer
      const arrayBuffer = await pdfData.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);

      await logToDatabase(userDocId, null, STAGES.DOWNLOAD, STATUSES.COMPLETED, 'PDF downloaded successfully', {
        buffer_size: pdfBuffer.length
      });

      // 3. Extract text from PDF
      await logToDatabase(userDocId, null, STAGES.EXTRACT, STATUSES.STARTED, 'Extracting text from PDF using pdf-parse');

      const extractResult = await extractPDFTextWithPageMarkers(pdfBuffer);
      text = extractResult.text;
      pages = extractResult.pages;

      await logToDatabase(userDocId, null, STAGES.EXTRACT, STATUSES.COMPLETED, 'Text extracted successfully', {
        pages,
        characters: text.length,
        pdf_processor: 'pdf-parse'
      });
    }
    
    // 3. Chunk text
    await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.STARTED, 'Chunking text');

    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP, pages);

    await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.COMPLETED, 'Text chunked successfully', {
      chunk_count: chunks.length,
      chunk_size: CHUNK_SIZE,
      overlap: CHUNK_OVERLAP
    });

    // 4. Generate AI abstract and keywords from chunks
    await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.PROGRESS, 'Generating AI abstract and keywords');
    
    // Generate abstract and keywords in parallel (both use same model and chunks)
    const [abstract, keywords] = await Promise.all([
      generateAbstract(chunks, userDoc.title),
      generateKeywords(chunks, userDoc.title)
    ]);
    
    if (abstract) {
      await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.PROGRESS, 'Abstract generated successfully', {
        abstract_length: abstract.length,
        abstract_words: abstract.split(/\s+/).length
      });
    } else {
      await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.PROGRESS, 'Abstract generation skipped or failed');
    }
    
    if (keywords && keywords.length > 0) {
      await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.PROGRESS, 'Keywords generated successfully', {
        keyword_count: keywords.length
      });
    } else {
      await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.PROGRESS, 'Keyword generation skipped or failed');
    }
    
    // 5. Generate document slug and create documents record with abstract
    // Use the UUID of the user_documents record as the slug
    documentSlug = userDocId;
    
    await logToDatabase(userDocId, documentSlug, STAGES.CHUNK, STATUSES.PROGRESS, 'Document slug generated', {
      slug: documentSlug
    });
    
    // Create intro message with abstract (if available)
    let introMessage = `Ask questions about ${userDoc.title}`;
    if (abstract) {
      introMessage = `<div class="document-abstract"><p><strong>Document Summary:</strong></p><p>${abstract}</p></div><p>Ask questions about this document below.</p>`;
    }
    
    // Check if user is super admin (global super admin has owner_id IS NULL)
    let ownerIdToSet: string | null = null;
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role, owner_id')
      .eq('user_id', userDoc.user_id)
      .eq('role', 'super_admin');
    
    // Check if user is a global super admin (owner_id IS NULL)
    const isSuperAdmin = userRoles && userRoles.some(r => r.owner_id === null);
    
    if (!isSuperAdmin) {
      // Get user's owner group from user_owner_access (regular members)
      const { data: ownerAccess, error: ownerAccessError } = await supabase
        .from('user_owner_access')
        .select('owner_id')
        .eq('user_id', userDoc.user_id)
        .limit(1)
        .maybeSingle();
      
      if (!ownerAccessError && ownerAccess?.owner_id) {
        ownerIdToSet = ownerAccess.owner_id;
      } else {
        // Check user_roles for owner_admin or registered roles with owner_id
        const { data: userRolesWithOwner, error: rolesError } = await supabase
          .from('user_roles')
          .select('owner_id')
          .eq('user_id', userDoc.user_id)
          .not('owner_id', 'is', null)
          .limit(1)
          .maybeSingle();
        
        if (!rolesError && userRolesWithOwner?.owner_id) {
          ownerIdToSet = userRolesWithOwner.owner_id;
        }
      }
    }
    // If super admin, ownerIdToSet remains null (can be set later in edit modal)
    
    // isTextUpload is already defined earlier - use it to disable references (no pages in text uploads)
    const { error: docInsertError } = await supabase
      .from('documents')
      .insert({
        slug: documentSlug,
        title: userDoc.title,
        subtitle: null,
        welcome_message: `Ask questions about ${userDoc.title}`,
        intro_message: introMessage,
        pdf_filename: userDoc.file_path.split('/').pop(),
        pdf_subdirectory: 'user-uploads',
        embedding_type: 'openai',
        active: true,
        access_level: 'owner_restricted',
        owner_id: ownerIdToSet,
        uploaded_by_user_id: userDoc.user_id,
        show_references: !isTextUpload, // Disable references for text uploads (no pages)
        metadata: {
          user_document_id: userDocId,
          user_id: userDoc.user_id,
          uploaded_at: userDoc.created_at,
          file_size: userDoc.file_size,
          has_ai_abstract: abstract ? true : false,
          keywords: keywords || null,
          upload_type: userDoc.metadata?.upload_type || null // Preserve upload type for identification
        }
      });
    
    if (docInsertError) {
      throw new Error(`Failed to create document record: ${docInsertError.message}`);
    }
    
    await logToDatabase(userDocId, documentSlug, STAGES.COMPLETE, STATUSES.PROGRESS, 'Document record created in documents table', {
      slug: documentSlug,
      has_abstract: abstract ? true : false
    });
    
    // 6. Generate embeddings
    await logToDatabase(userDocId, documentSlug, STAGES.EMBED, STATUSES.STARTED, 'Generating embeddings');

    const allEmbeddings: Array<{ chunk: any; embedding: number[] | null }> = [];
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`Processing batch ${batchNum}/${totalBatches}`);

      await logToDatabase(userDocId, documentSlug, STAGES.EMBED, STATUSES.PROGRESS, `Processing batch ${batchNum}/${totalBatches}`, {
        batch: batchNum,
        total_batches: totalBatches
      });

      const batchResults = await processEmbeddingsBatch(chunks, i, BATCH_SIZE);
      allEmbeddings.push(...batchResults);

      // Small delay between batches
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const successfulEmbeddings = allEmbeddings.filter(e => e.embedding !== null).length;

    await logToDatabase(userDocId, documentSlug, STAGES.EMBED, STATUSES.COMPLETED, 'Embeddings generated', {
      total: chunks.length,
      successful: successfulEmbeddings,
      failed: chunks.length - successfulEmbeddings
    });

    // 7. Store chunks in database
    await logToDatabase(userDocId, documentSlug, STAGES.STORE, STATUSES.STARTED, 'Storing chunks in database');

    const inserted = await storeChunks(documentSlug, userDoc.title, allEmbeddings);

    await logToDatabase(userDocId, documentSlug, STAGES.STORE, STATUSES.COMPLETED, 'Chunks stored successfully', {
      chunks_stored: inserted
    });

    // 8. Update user_documents status to ready
    await supabase
      .from('user_documents')
      .update({ 
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', userDocId);
    
    const processingTime = Date.now() - startTime;
    
    await logToDatabase(userDocId, documentSlug, STAGES.COMPLETE, STATUSES.COMPLETED, 'Processing complete', {
      processing_time_ms: processingTime,
      document_slug: documentSlug,
      pages,
      chunks: inserted
    });
    
    return {
      success: true,
      documentSlug,
      stats: {
        pages,
        chunks: inserted,
        processingTimeMs: processingTime
      }
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log error to database
    await logToDatabase(userDocId, documentSlug, STAGES.ERROR, STATUSES.FAILED, 'Processing failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Update user_documents status to error
    await supabase
      .from('user_documents')
      .update({ 
        status: 'error',
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', userDocId);
    
    throw error;
  }
}

/**
 * Edge Function handler
 */
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { user_document_id } = await req.json();

    if (!user_document_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_document_id is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    console.log(`Processing document: ${user_document_id}`);

    // Process document (this may take several minutes)
    const result = await processUserDocument(user_document_id);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );

  } catch (error) {
    console.error('Edge Function error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
});

