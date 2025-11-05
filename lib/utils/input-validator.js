/**
 * Input Validator
 * Comprehensive input validation for document processing
 */

const { ValidationError } = require('../errors/processing-errors');

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
function validateUUID(value, fieldName = 'ID') {
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
    }
    
    if (!UUID_REGEX.test(value)) {
        throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName, value);
    }
    
    return value;
}

/**
 * Validate user document ID
 */
function validateUserDocId(userDocId) {
    if (!userDocId) {
        throw new ValidationError('user_document_id is required', 'userDocId');
    }
    
    return validateUUID(userDocId, 'user_document_id');
}

/**
 * Validate document slug
 */
function validateDocumentSlug(documentSlug, allowNull = false) {
    if (allowNull && (documentSlug === null || documentSlug === undefined)) {
        return null;
    }
    
    if (!documentSlug) {
        throw new ValidationError('document_slug is required', 'documentSlug');
    }
    
    if (typeof documentSlug !== 'string') {
        throw new ValidationError('document_slug must be a string', 'documentSlug', documentSlug);
    }
    
    if (documentSlug.length > 255) {
        throw new ValidationError('document_slug must be 255 characters or less', 'documentSlug', documentSlug);
    }
    
    return documentSlug;
}

/**
 * Validate buffer
 */
function validateBuffer(buffer, fieldName = 'buffer') {
    if (!Buffer.isBuffer(buffer)) {
        throw new ValidationError(`${fieldName} must be a Buffer`, fieldName, typeof buffer);
    }
    
    if (buffer.length === 0) {
        throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
    }
    
    // Check reasonable size limits (e.g., 100MB max)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (buffer.length > MAX_SIZE) {
        throw new ValidationError(
            `${fieldName} exceeds maximum size of ${MAX_SIZE} bytes`,
            fieldName,
            buffer.length
        );
    }
    
    return buffer;
}

/**
 * Validate Supabase client
 */
function validateSupabaseClient(supabase, fieldName = 'supabase') {
    if (!supabase) {
        throw new ValidationError(`${fieldName} client is required`, fieldName);
    }
    
    if (typeof supabase.from !== 'function') {
        throw new ValidationError(`${fieldName} must be a valid Supabase client`, fieldName);
    }
    
    return supabase;
}

/**
 * Validate OpenAI client
 */
function validateOpenAIClient(openaiClient, fieldName = 'openaiClient') {
    if (!openaiClient) {
        throw new ValidationError(`${fieldName} is required`, fieldName);
    }
    
    // Check for common OpenAI client methods
    if (!openaiClient.embeddings || typeof openaiClient.embeddings.create !== 'function') {
        throw new ValidationError(`${fieldName} must be a valid OpenAI client`, fieldName);
    }
    
    return openaiClient;
}

/**
 * Validate text content
 */
function validateText(text, fieldName = 'text', allowEmpty = false) {
    if (typeof text !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName, typeof text);
    }

    if (!allowEmpty && text.trim().length === 0) {
        throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
    }

    // Check reasonable size limits (e.g., 10MB of text)
    const MAX_LENGTH = 10 * 1024 * 1024; // 10MB
    if (text.length > MAX_LENGTH) {
        throw new ValidationError(
            `${fieldName} exceeds maximum length of ${MAX_LENGTH} characters`,
            fieldName,
            text.length
        );
    }

    return text;
}

/**
 * Validate text input for direct text uploads
 */
function validateTextInput(text, fieldName = 'content') {
    if (!text) {
        return 'Text content is required';
    }

    if (typeof text !== 'string') {
        return 'Text content must be a string';
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return 'Text content cannot be empty';
    }

    if (trimmed.length < 10) {
        return 'Text content must be at least 10 characters long';
    }

    // Check for reasonable maximum (5M characters for direct text input)
    const MAX_LENGTH = 5000000; // 5M characters
    if (text.length > MAX_LENGTH) {
        return `Text content exceeds maximum length of ${MAX_LENGTH.toLocaleString()} characters`;
    }

    // Basic content validation - ensure it has some actual text content
    const words = trimmed.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 5) {
        return 'Text content must contain at least 5 words';
    }

    return null; // Valid
}

/**
 * Validate chunk array
 */
function validateChunks(chunks, fieldName = 'chunks') {
    if (!Array.isArray(chunks)) {
        throw new ValidationError(`${fieldName} must be an array`, fieldName, typeof chunks);
    }
    
    if (chunks.length === 0) {
        throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
    }
    
    chunks.forEach((chunk, index) => {
        if (!chunk || typeof chunk !== 'object') {
            throw new ValidationError(
                `${fieldName}[${index}] must be an object`,
                `${fieldName}[${index}]`
            );
        }
        
        if (typeof chunk.content !== 'string' || chunk.content.trim().length === 0) {
            throw new ValidationError(
                `${fieldName}[${index}].content must be a non-empty string`,
                `${fieldName}[${index}].content`
            );
        }
        
        if (typeof chunk.index !== 'number' || chunk.index < 0) {
            throw new ValidationError(
                `${fieldName}[${index}].index must be a non-negative number`,
                `${fieldName}[${index}].index`
            );
        }
    });
    
    return chunks;
}

/**
 * Validate page number
 */
function validatePageNumber(pageNumber, totalPages = null) {
    if (typeof pageNumber !== 'number') {
        throw new ValidationError('page_number must be a number', 'pageNumber', pageNumber);
    }
    
    if (pageNumber < 1) {
        throw new ValidationError('page_number must be >= 1', 'pageNumber', pageNumber);
    }
    
    if (totalPages !== null && pageNumber > totalPages) {
        throw new ValidationError(
            `page_number (${pageNumber}) cannot exceed total_pages (${totalPages})`,
            'pageNumber',
            pageNumber
        );
    }
    
    return pageNumber;
}

/**
 * Validate file path
 */
function validateFilePath(filePath, fieldName = 'file_path') {
    if (!filePath) {
        throw new ValidationError(`${fieldName} is required`, fieldName);
    }
    
    if (typeof filePath !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName, filePath);
    }
    
    // Basic path validation (no directory traversal)
    if (filePath.includes('..') || filePath.includes('//')) {
        throw new ValidationError(
            `${fieldName} contains invalid path characters`,
            fieldName,
            filePath
        );
    }
    
    return filePath;
}

/**
 * Validate processing options
 */
function validateProcessingOptions(options = {}) {
    const validated = {};
    
    if (options.chunkSize !== undefined) {
        if (typeof options.chunkSize !== 'number' || options.chunkSize < 100 || options.chunkSize > 5000) {
            throw new ValidationError(
                'chunkSize must be a number between 100 and 5000',
                'chunkSize',
                options.chunkSize
            );
        }
        validated.chunkSize = options.chunkSize;
    }
    
    if (options.chunkOverlap !== undefined) {
        if (typeof options.chunkOverlap !== 'number' || options.chunkOverlap < 0 || options.chunkOverlap > 500) {
            throw new ValidationError(
                'chunkOverlap must be a number between 0 and 500',
                'chunkOverlap',
                options.chunkOverlap
            );
        }
        validated.chunkOverlap = options.chunkOverlap;
    }
    
    if (options.batchSize !== undefined) {
        if (typeof options.batchSize !== 'number' || options.batchSize < 1 || options.batchSize > 1000) {
            throw new ValidationError(
                'batchSize must be a number between 1 and 1000',
                'batchSize',
                options.batchSize
            );
        }
        validated.batchSize = options.batchSize;
    }
    
    return validated;
}

/**
 * Sanitize string input (prevent injection)
 */
function sanitizeString(input, fieldName = 'input') {
    if (typeof input !== 'string') {
        return input;
    }
    
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
}

/**
 * Validate and sanitize all inputs for processUserDocument
 */
function validateProcessUserDocumentInputs(userDocId, supabase, openaiClient) {
    const validated = {
        userDocId: validateUserDocId(userDocId),
        supabase: validateSupabaseClient(supabase),
        openaiClient: validateOpenAIClient(openaiClient)
    };
    
    return validated;
}

/**
 * Validate and sanitize all inputs for reprocessDocument
 */
function validateReprocessDocumentInputs(userDocId, documentSlug, supabase, openaiClient) {
    const validated = {
        userDocId: validateUserDocId(userDocId),
        documentSlug: validateDocumentSlug(documentSlug),
        supabase: validateSupabaseClient(supabase),
        openaiClient: validateOpenAIClient(openaiClient)
    };
    
    return validated;
}

module.exports = {
    validateUUID,
    validateUserDocId,
    validateDocumentSlug,
    validateBuffer,
    validateSupabaseClient,
    validateOpenAIClient,
    validateText,
    validateTextInput,
    validateChunks,
    validatePageNumber,
    validateFilePath,
    validateProcessingOptions,
    sanitizeString,
    validateProcessUserDocumentInputs,
    validateReprocessDocumentInputs
};

