# PDF Chatbot API Reference

This document provides a comprehensive reference for all available API endpoints in the PDF Chatbot application.

## Quick Overview

**Core Functionality:**
- **Chat APIs**: `/api/chat`, `/api/chat-rag` - AI conversation endpoints
- **Document Management**: `/api/documents`, `/api/refresh-registry` - Document registry access and updates
- **Health Monitoring**: `/api/health`, `/api/ready` - System status and readiness checks
- **Analytics**: `/api/analytics` - Usage statistics and performance metrics
- **Cache Management**: `/api/cache/stats`, `/api/cache/clear` - Embedding cache control
- **User Feedback**: `/api/rate` - Conversation rating system

**Total Endpoints**: 13 API routes
**Primary Models**: Gemini, Grok, Grok-Reasoning
**Supported Embeddings**: OpenAI, Local
**Document Count**: 117+ medical documents

## Table of Contents

- [Core Chat Endpoints](#core-chat-endpoints)
- [Document Management](#document-management)
- [Health and Monitoring](#health-and-monitoring)
- [Analytics and Statistics](#analytics-and-statistics)
- [Cache Management](#cache-management)
- [Rating System](#rating-system)
- [System Administration](#system-administration)

## Core Chat Endpoints

### POST `/api/chat`

Primary chat endpoint for conversational AI interactions.

**Request Body:**
```json
{
  "conversationId": "string (optional)",
  "message": "string",
  "document": "string (document slug)",
  "model": "gemini | grok | grok-reasoning",
  "embeddingType": "openai | local",
  "maxTokens": "number (optional)",
  "temperature": "number (optional, 0.0-2.0)",
  "systemPrompt": "string (optional)",
  "sessionId": "string (optional)"
}
```

**Response:**
```json
{
  "response": "string",
  "conversationId": "string",
  "model": "string",
  "tokensUsed": "number",
  "responseTime": "number (ms)",
  "documentUsed": "string",
  "embeddingType": "string"
}
```

### POST `/api/chat-rag`

RAG (Retrieval-Augmented Generation) specific chat endpoint with enhanced document retrieval.

**Request Body:**
```json
{
  "conversationId": "string (optional)",
  "message": "string",
  "document": "string (document slug)",
  "model": "gemini | grok | grok-reasoning",
  "embeddingType": "openai | local",
  "maxTokens": "number (optional)",
  "temperature": "number (optional)",
  "topK": "number (optional, default: 5)",
  "similarityThreshold": "number (optional, default: 0.7)",
  "sessionId": "string (optional)"
}
```

**Response:**
```json
{
  "response": "string",
  "conversationId": "string",
  "model": "string",
  "tokensUsed": "number",
  "responseTime": "number (ms)",
  "documentUsed": "string",
  "embeddingType": "string",
  "chunksRetrieved": "number",
  "sources": ["array of source references"]
}
```

## Document Management

### GET `/api/documents`

Retrieve the complete document registry with all available documents.

**Response:**
```json
{
  "documents": [
    {
      "slug": "ckd-dc-2025",
      "title": "Chronic Kidney Disease in Diabetes: A Clinical Practice Guideline",
      "subtitle": "string",
      "backLink": "string (URL)",
      "welcomeMessage": "string",
      "embeddingType": "openai | local",
      "active": true,
      "metadata": {
        "pages": "number",
        "characters": "number",
        "tokens": "number"
      }
    }
  ]
}
```

### POST `/api/refresh-registry`

Force refresh the document registry cache. Useful when document metadata is updated in the database.

**Response:**
```json
{
  "success": true,
  "message": "Document registry cache cleared and refreshed",
  "documentCount": 117
}
```

## Health and Monitoring

### GET `/api/health`

Comprehensive health check endpoint with system status.

**Query Parameters:**
- `doc` - Document slug to check (optional)

**Response:**
```json
{
  "status": "ok",
  "lazyLoadingEnabled": true,
  "currentDocument": "Chronic Kidney Disease in Diabetes: A Clinical Practice Guideline",
  "currentDocumentType": "ckd-dc-2025",
  "currentDocumentLoaded": true,
  "loadedDocuments": ["array of loaded document slugs"],
  "availableDocuments": ["array of all available document slugs"],
  "totalAvailableDocuments": 117,
  "requestedDoc": "ckd-dc-2025",
  "documentDetails": {
    "ckd-dc-2025": {
      "loaded": true,
      "title": "Chronic Kidney Disease in Diabetes: A Clinical Practice Guideline",
      "name": "PIIS1499267125000206.pdf",
      "year": "2025",
      "pages": 28,
      "characters": 133567,
      "embeddingType": "local"
    }
  }
}
```

### GET `/api/ready`

Readiness check for load balancers and health monitoring systems.

**Response (Ready):**
```json
{
  "status": "ready",
  "message": "System is ready to serve requests",
  "uptime": "number (seconds)",
  "memory": {
    "used": "number (MB)",
    "total": "number (MB)",
    "percentage": "number (%)"
  }
}
```

**Response (Not Ready):**
```json
{
  "status": "not_ready",
  "message": "Document registry not loaded yet"
}
```

## Analytics and Statistics

### GET `/api/analytics`

Get conversation analytics and usage statistics.

**Query Parameters:**
- `timeframe` - Time period: `24h`, `7d`, `30d` (default: `24h`)

**Response:**
```json
{
  "totalConversations": 150,
  "byModel": {
    "gemini": 89,
    "grok": 61
  },
  "byDocument": {
    "ckd-dc-2025": {
      "count": 45,
      "version": "2025",
      "avgResponseTime": 1250
    }
  },
  "avgResponseTime": {
    "gemini": 1180,
    "grok": 1320
  },
  "timeframe": "24h",
  "generatedAt": "2025-10-19T01:15:00.000Z"
}
```

## Cache Management

### GET `/api/cache/stats`

Get detailed statistics about the embedding cache.

**Response:**
```json
{
  "success": true,
  "cache": {
    "totalEntries": 1250,
    "totalSize": "45.2MB",
    "hitRate": 87.5,
    "missRate": 12.5,
    "avgResponseTime": 45,
    "oldestEntry": "2025-10-18T12:00:00.000Z",
    "newestEntry": "2025-10-19T01:15:00.000Z",
    "entriesByDocument": {
      "ckd-dc-2025": 234,
      "smh": 456
    }
  }
}
```

### POST `/api/cache/clear`

Clear the entire embedding cache. Use with caution as this will force regeneration of all cached embeddings.

**Response:**
```json
{
  "success": true,
  "message": "Embedding cache cleared",
  "entriesRemoved": 1250,
  "sizeFreed": "45.2MB"
}
```

## Rating System

### POST `/api/rate`

Submit a rating for a conversation (thumbs up/down feedback).

**Request Body:**
```json
{
  "conversationId": "string (required)",
  "rating": "thumbs_up | thumbs_down"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rating recorded successfully",
  "conversationId": "string",
  "rating": "thumbs_up",
  "timestamp": "2025-10-19T01:15:00.000Z"
}
```

## System Administration

### GET `/`

Serve the main application interface (index.html).

### GET `/index.php`

Legacy Joomla/Apache compatibility - serves index.html.

### GET `*.php`

Catch-all for any PHP file requests - serves index.html.

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "error": "Error message description",
  "details": "Additional error information (optional)",
  "code": "ERROR_CODE (optional)"
}
```

## Rate Limiting

- **Chat endpoints**: Limited to prevent abuse
- **Analytics endpoints**: Limited to prevent excessive queries
- **Cache operations**: Limited to prevent accidental data loss

## Authentication

Currently, all endpoints are publicly accessible. For production deployment, consider adding authentication middleware.

## WebSocket Support

The application supports real-time updates via WebSocket connections for:
- Chat streaming responses
- Document loading progress
- System status updates

## Database Integration

All endpoints interact with Supabase PostgreSQL database for:
- Conversation storage and retrieval
- Document metadata management
- User rating collection
- Analytics data aggregation

## Caching Strategy

- **Document Registry**: 5-minute cache with manual refresh capability
- **Embeddings**: Persistent cache with LRU eviction
- **API Responses**: Short-term caching for health checks

## Monitoring and Logging

- All API calls are logged with request/response details
- Performance metrics are tracked for optimization
- Error handling includes detailed stack traces for debugging

## Development Endpoints

The following endpoints are primarily for development and testing:

- `POST /api/refresh-registry` - Force document registry refresh
- `POST /api/cache/clear` - Clear embedding cache
- `GET /api/cache/stats` - Cache statistics (debugging)

## Common Usage Patterns

### Document Updates Workflow

When updating document metadata in the database:

```bash
# 1. Update document in database (via Supabase dashboard or SQL)
# 2. Force refresh the document registry
curl -X POST http://localhost:3456/api/refresh-registry

# 3. Verify the changes took effect
curl "http://localhost:3456/api/health?doc=ckd-dc-2025"
```

### Cache Management

```bash
# Check cache statistics
curl http://localhost:3456/api/cache/stats

# Clear cache if needed (forces regeneration)
curl -X POST http://localhost:3456/api/cache/clear
```

### Chat API Usage

```bash
# Basic chat request
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is CKD?",
    "document": "ckd-dc-2025",
    "model": "grok",
    "embeddingType": "local"
  }'

# RAG-enhanced chat
curl -X POST http://localhost:3456/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain diabetic nephropathy",
    "document": "ckd-dc-2025",
    "model": "gemini",
    "topK": 5
  }'
```

### Analytics Monitoring

```bash
# Get 24-hour analytics
curl "http://localhost:3456/api/analytics?timeframe=24h"

# Get weekly analytics
curl "http://localhost:3456/api/analytics?timeframe=7d"
```

## WebSocket Integration

The application supports WebSocket connections for real-time features:

- **Chat streaming**: Real-time token streaming during AI responses
- **Document loading**: Progress updates during lazy document loading
- **System notifications**: Health status and system alerts

## File Upload and Static Assets

- **Static files**: Served from `/public` directory
- **PDF documents**: Served from `/PDFs` directory structure
- **CSS/JS assets**: Cache-busted with content hashes

## Environment Variables

Key environment variables affecting API behavior:

- `PORT`: Server port (default: 3456)
- `NODE_ENV`: Environment mode (development/production)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key

## Production Considerations

- Enable authentication for sensitive endpoints
- Implement rate limiting based on usage patterns
- Monitor cache hit rates and adjust cache sizes accordingly
- Set up proper logging and alerting for API failures
- Consider API versioning for future changes
- Enable HTTPS in production
- Set up proper CORS policies for cross-origin requests
