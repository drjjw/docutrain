# Enhanced Console Logging

## Overview

The server now includes comprehensive console logging that provides detailed information about every RAG request, including chunk retrieval statistics, AI model parameters, and performance metrics.

## Log Structure

### 1. Request Header
```
================================================================================
🔵 RAG REQUEST RECEIVED
================================================================================
📝 Query: "What is the dose of Cefazolin in peritoneal dialysis?"
📊 Request Details:
   - Message length: 52 characters
   - History length: 0 messages
   - Model: gemini
   - Document(s): smh
   - Embedding type: openai
   - Session ID: 123e4567-e89b-12d3-a456-426614174000
```

### 2. Chunk Retrieval Section
```
🔍 CHUNK RETRIEVAL:
   - Requesting: 50 chunks
   - Embedding type: openai
   - Similarity threshold: 0.3
   ✓ Retrieved: 50 chunks in 556ms
   - Similarity range: 0.312 - 0.847 (avg: 0.524)
   - Top 5 similarities: 0.847, 0.789, 0.756, 0.723, 0.698
   - Chunks per document: { smh: 50 }  # (for multi-document searches)
```

### 3. AI Generation Section
```
🤖 AI GENERATION:
   - Model: gemini-2.5-flash
   - Temperature: default (Gemini auto)
   - Context: 50 chunks + 0 history messages
   ✓ Generated: 1847 characters in 2522ms
   - Words: ~287
   - Tokens (est): ~462
```

For Grok models:
```
🤖 AI GENERATION:
   - Model: grok-4-fast-non-reasoning
   - Temperature: 0.7
   - Context: 50 chunks + 2 history messages
   ✓ Generated: 2134 characters in 3104ms
   - Words: ~331
   - Tokens (est): ~534
```

### 4. Completion Summary
```
================================================================================
✅ RAG REQUEST COMPLETED
================================================================================
⏱️  Performance Summary:
   - Total time: 3078ms
   - Retrieval time: 556ms (18.1%)
   - Generation time: 2522ms (81.9%)
📦 Data Summary:
   - Chunks used: 50
   - Response length: 1847 chars (~287 words)
   - Conversation ID: abc123-def456-ghi789
================================================================================
```

### 5. Error Logging (if applicable)
```
================================================================================
❌ RAG REQUEST FAILED
================================================================================
⚠️  Error after 1234ms: Failed to embed query with openai: API rate limit exceeded
   Stack: Error: Failed to embed query with openai: API rate limit exceeded
       at embedQuery (/path/to/server.js:578)
       at async /path/to/server.js:570
================================================================================
```

## Key Metrics Logged

### Request Information
- **Query text**: First 100 characters of the user's question
- **Message length**: Total character count
- **History length**: Number of previous messages in conversation
- **Model**: AI model being used (gemini, grok, grok-reasoning)
- **Document(s)**: Which document(s) are being searched
- **Embedding type**: openai or local
- **Session ID**: Unique session identifier

### Chunk Retrieval Metrics
- **Requested chunks**: Number of chunks requested (50)
- **Retrieved chunks**: Actual number returned (may be less if threshold not met)
- **Embedding type**: openai (1536D) or local (384D)
- **Similarity threshold**: 0.3 for OpenAI, 0.05 for local
- **Retrieval time**: Time to find and retrieve chunks
- **Similarity statistics**:
  - Range (min to max)
  - Average similarity
  - Top 5 similarity scores
- **Multi-document breakdown**: Chunks per document (for multi-doc searches)

### AI Generation Metrics
- **Model name**: Actual API model name
- **Temperature**: Generation temperature setting
  - Grok: 0.7 (fixed)
  - Gemini: default (auto-adjusted)
- **Context size**: Number of chunks + history messages
- **Generation time**: Time to generate response
- **Response statistics**:
  - Character count
  - Word count (approximate)
  - Token count (estimated at 4 chars/token)

### Performance Summary
- **Total time**: End-to-end request time
- **Retrieval time**: Time spent finding chunks (with percentage)
- **Generation time**: Time spent generating response (with percentage)
- **Chunks used**: Final count of chunks in context
- **Response length**: Characters and words
- **Conversation ID**: Database ID for this conversation

## Benefits

1. **Debugging**: Quickly identify bottlenecks (retrieval vs generation)
2. **Quality monitoring**: Track similarity scores to ensure relevant chunks
3. **Performance tracking**: Monitor response times and optimize
4. **Multi-document visibility**: See chunk distribution across documents
5. **Model comparison**: Compare Gemini vs Grok performance
6. **Token estimation**: Understand API costs

## Example Full Log

```
================================================================================
🔵 RAG REQUEST RECEIVED
================================================================================
📝 Query: "What is the dose of Cefazolin in peritoneal dialysis?"
📊 Request Details:
   - Message length: 52 characters
   - History length: 0 messages
   - Model: gemini
   - Document(s): smh
   - Embedding type: openai
   - Session ID: 123e4567-e89b-12d3-a456-426614174000

🔍 CHUNK RETRIEVAL:
   - Requesting: 50 chunks
   - Embedding type: openai
   - Similarity threshold: 0.3
   ✓ Retrieved: 50 chunks in 556ms
   - Similarity range: 0.312 - 0.847 (avg: 0.524)
   - Top 5 similarities: 0.847, 0.789, 0.756, 0.723, 0.698

🤖 AI GENERATION:
   - Model: gemini-2.5-flash
   - Temperature: default (Gemini auto)
   - Context: 50 chunks + 0 history messages
   ✓ Generated: 1847 characters in 2522ms
   - Words: ~287
   - Tokens (est): ~462

================================================================================
✅ RAG REQUEST COMPLETED
================================================================================
⏱️  Performance Summary:
   - Total time: 3078ms
   - Retrieval time: 556ms (18.1%)
   - Generation time: 2522ms (81.9%)
📦 Data Summary:
   - Chunks used: 50
   - Response length: 1847 chars (~287 words)
   - Conversation ID: abc123-def456-ghi789
================================================================================
```

## Configuration

The chunk limit is defined as a constant in the code:
```javascript
const CHUNK_LIMIT = 50;
```

To change the number of chunks retrieved, modify this value in `server.js` at line ~594.

## Notes

- All times are in milliseconds
- Similarity scores range from 0 (no match) to 1 (perfect match)
- Token estimates use 4 characters per token (rough approximation)
- Multi-document searches show chunk distribution across sources
- Gemini temperature is auto-adjusted by the model
- Grok models use fixed temperature of 0.7

