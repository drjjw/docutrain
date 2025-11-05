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
 * Generate keywords for word cloud from chunks using OpenAI
 * Returns an array of keyword objects with term and weight
 */
async function generateKeywords(chunks: Array<{ content: string }>, documentTitle: string): Promise<Array<{ term: string; weight: number }> | null> {
  console.log('🔑 NEW CODE: generateKeywords() called - AI keyword extraction feature is active!');
  console.log(`   Document: ${documentTitle}`);
  console.log(`   Total chunks available: ${chunks.length}`);
  
  try {
    // Sample chunks from across the entire document for better keyword density analysis
    // Strategy: sample evenly across the document for comprehensive coverage
    let chunksForKeywords: Array<{ content: string }> = [];
    const totalChunks = chunks.length;
    
    if (totalChunks <= 50) {
      // If document is small, use all chunks
      chunksForKeywords = chunks;
    } else {
      // For larger documents, sample more chunks for better keyword density analysis
      // Target: Use ~10% of chunks, up to 300 chunks (to stay within token limits)
      const targetSampleSize = Math.min(300, Math.max(100, Math.floor(totalChunks * 0.1)));
      
      // Sample evenly across the document for comprehensive coverage
      const step = Math.floor(totalChunks / targetSampleSize);
      const usedIndices = new Set<number>();
      
      for (let i = 0; i < totalChunks && chunksForKeywords.length < targetSampleSize; i += step) {
        if (!usedIndices.has(i)) {
          chunksForKeywords.push(chunks[i]);
          usedIndices.add(i);
        }
      }
      
      // Ensure we have samples from beginning, middle, and end
      if (chunksForKeywords.length < targetSampleSize) {
        // Add beginning chunks if not already included
        for (let i = 0; i < Math.min(30, totalChunks) && chunksForKeywords.length < targetSampleSize; i++) {
          if (!usedIndices.has(i)) {
            chunksForKeywords.push(chunks[i]);
            usedIndices.add(i);
          }
        }
        
        // Add middle chunks
        const middleStart = Math.floor(totalChunks / 2) - 15;
        for (let i = middleStart; i < middleStart + 30 && chunksForKeywords.length < targetSampleSize && i < totalChunks; i++) {
          if (!usedIndices.has(i)) {
            chunksForKeywords.push(chunks[i]);
            usedIndices.add(i);
          }
        }
        
        // Add end chunks
        for (let i = Math.max(0, totalChunks - 30); i < totalChunks && chunksForKeywords.length < targetSampleSize; i++) {
          if (!usedIndices.has(i)) {
            chunksForKeywords.push(chunks[i]);
            usedIndices.add(i);
          }
        }
      }
      
      // Sort by original index to maintain some order
      chunksForKeywords.sort((a, b) => {
        const aIndex = chunks.indexOf(a);
        const bIndex = chunks.indexOf(b);
        return aIndex - bIndex;
      });
    }
    
    console.log(`   📋 Sampling ${chunksForKeywords.length} chunks from across document`);
    
    // Combine chunk content
    const combinedText = chunksForKeywords
      .map(chunk => chunk.content)
      .join('\n\n');
    
    // Truncate if too long (to stay within token limits)
    // gpt-4o-mini has 128k context window, so we can use more
    // Reserve ~25k tokens for system prompt, user prompt template, and response
    // That leaves ~100k tokens (~400k chars) for document content
    const maxChars = 400000; // ~100k tokens (leaving room for prompts and response)
    const textForKeywords = combinedText.length > maxChars 
      ? combinedText.substring(0, maxChars) + '...'
      : combinedText;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing document content and extracting key terms and concepts. Identify the most important keywords, phrases, and concepts that would be useful for a word cloud visualization. Focus on domain-specific terms, key concepts, and important topics. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Analyze the following document content and extract 20-30 key terms, phrases, and concepts that best represent this document. For each term, assign a weight from 0.1 to 1.0 based on its importance (1.0 = most important, 0.1 = less important but still relevant).\n\nDocument title: "${documentTitle}"\n\nContent:\n${textForKeywords}\n\nReturn your response as a JSON object with a "keywords" property containing an array of objects, each with "term" (string) and "weight" (number) properties. Example format:\n{"keywords": [{"term": "kidney disease", "weight": 0.95}, {"term": "chronic kidney disease", "weight": 0.90}, {"term": "treatment", "weight": 0.75}]}\n\nProvide ONLY the JSON object, no additional commentary.`
        }
      ],
      temperature: 0.7,
      max_tokens: 800, // Increased to avoid truncation
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error('No content in OpenAI response for keywords');
      return null;
    }
    
    // Parse JSON response - GPT may wrap it in an object
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse keywords JSON:', parseError);
      return null;
    }
    
    // Handle both direct array and wrapped object responses
    let keywords: any[] | null = null;
    if (Array.isArray(parsed)) {
      keywords = parsed;
    } else if (parsed.keywords && Array.isArray(parsed.keywords)) {
      keywords = parsed.keywords;
    } else if (parsed.terms && Array.isArray(parsed.terms)) {
      keywords = parsed.terms;
    } else {
      // Try to find any array in the response
      const keys = Object.keys(parsed);
      for (const key of keys) {
        if (Array.isArray(parsed[key])) {
          keywords = parsed[key];
          break;
        }
      }
    }
    
    if (!keywords || !Array.isArray(keywords)) {
      console.error('Keywords not found in expected format. Parsed response:', JSON.stringify(parsed, null, 2));
      return null;
    }
    
    // Validate and clean keywords
    const validKeywords = keywords
      .filter((k: any) => k && typeof k === 'object' && k.term && typeof k.term === 'string')
      .map((k: any) => ({
        term: k.term.trim(),
        weight: typeof k.weight === 'number' ? Math.max(0.1, Math.min(1.0, k.weight)) : 0.5
      }))
      .filter((k: any) => k.term.length > 0)
      .slice(0, 30); // Limit to 30 keywords
    
    if (validKeywords.length === 0) {
      console.error('No valid keywords after filtering. Original keywords array length:', keywords.length);
      return null;
    }
    
    console.log(`   ✓ Generated ${validKeywords.length} keywords`);
    return validKeywords;
    
  } catch (error: any) {
    console.error('Failed to generate keywords:', error);
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type
    });
    // Return null on error - don't fail the whole process
    return null;
  }
}

/**
 * Process embeddings in batches
 */
async function processEmbeddingsBatch(chunks: Array<{ content: string }>, startIdx: number, batchSize: number) {
  const batch = chunks.slice(startIdx, startIdx + batchSize);
  const embeddings = [];
  
  for (const chunk of batch) {
    try {
      const embedding = await generateEmbedding(chunk.content);
      embeddings.push({ chunk, embedding });
    } catch (error) {
      console.error(`Failed to embed chunk ${chunks.indexOf(chunk)}:`, error);
      embeddings.push({ chunk, embedding: null });
    }
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
    
    // 2. Download PDF from storage
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
    
    const { text, pages } = await extractPDFTextWithPageMarkers(pdfBuffer);
    
    await logToDatabase(userDocId, null, STAGES.EXTRACT, STATUSES.COMPLETED, 'Text extracted successfully', {
      pages,
      characters: text.length,
      pdf_processor: 'pdf-parse'
    });
    
    // 4. Chunk text
    await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.STARTED, 'Chunking text');
    
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP, pages);
    
    await logToDatabase(userDocId, null, STAGES.CHUNK, STATUSES.COMPLETED, 'Text chunked successfully', {
      chunk_count: chunks.length,
      chunk_size: CHUNK_SIZE,
      overlap: CHUNK_OVERLAP
    });
    
    // 5. Generate AI abstract and keywords from chunks
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
    
    // 6. Generate document slug and create documents record with abstract
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
        metadata: {
          user_document_id: userDocId,
          user_id: userDoc.user_id,
          uploaded_at: userDoc.created_at,
          file_size: userDoc.file_size,
          has_ai_abstract: abstract ? true : false,
          keywords: keywords || null
        }
      });
    
    if (docInsertError) {
      throw new Error(`Failed to create document record: ${docInsertError.message}`);
    }
    
    await logToDatabase(userDocId, documentSlug, STAGES.COMPLETE, STATUSES.PROGRESS, 'Document record created in documents table', {
      slug: documentSlug,
      has_abstract: abstract ? true : false
    });
    
    // 7. Generate embeddings
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
    
    // 8. Store chunks in database
    await logToDatabase(userDocId, documentSlug, STAGES.STORE, STATUSES.STARTED, 'Storing chunks in database');
    
    const inserted = await storeChunks(documentSlug, userDoc.title, allEmbeddings);
    
    await logToDatabase(userDocId, documentSlug, STAGES.STORE, STATUSES.COMPLETED, 'Chunks stored successfully', {
      chunks_stored: inserted
    });
    
    // 9. Update user_documents status to ready
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

