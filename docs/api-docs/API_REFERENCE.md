# Chat Application API Reference

This document provides a comprehensive reference for all available API endpoints in the modular chat application.

## Quick Overview

**Core Functionality:**
- **Chat API**: `/api/chat`, `/api/chat/stream` - RAG-based AI conversation with streaming support
- **Authentication**: `/api/auth/*` - JWT token verification and user management
- **Permissions**: `/api/permissions/*` - Role-based access control and document permissions
- **Health Monitoring**: `/api/health`, `/api/ready`, `/api/version`, `/api/analytics` - System monitoring
- **Cache Management**: `/api/cache/*` - Embedding cache statistics and management
- **User Feedback**: `/api/rate` - Conversation rating system
- **Admin**: `/api/users/*` - Super admin user management

**Total Endpoints**: 25+ API routes
**Architecture**: Modular Express.js with route separation
**Primary Models**: Gemini-2.5-flash, Grok-4-fast, Grok-4-fast-reasoning
**Supported Embeddings**: OpenAI (1536D), Local (384D)
**Multi-document Support**: Search across multiple documents simultaneously
**Authentication**: Supabase JWT with role-based permissions

## Table of Contents

- [Core Chat Endpoints](#core-chat-endpoints)
- [Authentication](#authentication)
- [Permissions & Access Control](#permissions--access-control)
- [Health & Monitoring](#health--monitoring)
- [Analytics](#analytics)
- [Cache Management](#cache-management)
- [Rating System](#rating-system)
- [User Management (Admin)](#user-management-admin)
- [Document Routes (Frontend)](#document-routes-frontend)

## Core Chat Endpoints

### POST `/api/chat`

Main RAG chat endpoint with multi-document support and detailed performance metrics.

**Query Parameters:**
- `embedding` - Embedding type: `openai` (default) or `local`

**Request Body:**
```json
{
  "message": "string (required)",
  "history": "array (optional, conversation history)",
  "model": "gemini | grok | grok-reasoning (default: gemini)",
  "doc": "string (document slug or multi-doc with + separator, required)",
  "sessionId": "string (optional, UUID auto-generated if missing)"
}
```

**Response:**
```json
{
  "response": "string",
  "model": "string",
  "actualModel": "gemini-2.5-flash | grok-4-fast-non-reasoning | grok-4-fast-reasoning",
  "sessionId": "string (UUID)",
  "conversationId": "string (UUID)",
  "metadata": {
    "document": "string (filename or combined filenames)",
    "documentType": "string or array (slug(s))",
    "documentSlugs": "array of strings",
    "documentTitle": "string",
    "isMultiDocument": "boolean",
    "responseTime": "number (ms)",
    "retrievalMethod": "rag | rag-multi",
    "chunksUsed": "number",
    "retrievalTime": "number (ms)",
    "embedding_type": "openai | local",
    "embedding_dimensions": "1536 | 384",
    "chunkSimilarities": [
      {
        "index": "number",
        "similarity": "number",
        "source": "string (document slug)"
      }
    ]
  }
}
```

**Example Requests:**
```bash
# Single document chat
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the indications for dialysis?",
    "model": "grok",
    "doc": "smh",
    "history": []
  }'

# Multi-document search
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Compare CKD guidelines",
    "model": "gemini",
    "doc": "kdigo-ckd-2024+smh",
    "history": []
  }'

# With local embeddings
curl -X POST "http://localhost:3456/api/chat?embedding=local" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is diabetic nephropathy?",
    "doc": "ckd-dc-2025"
  }'
```

### POST `/api/chat/stream`

Streaming version of the chat endpoint using Server-Sent Events (SSE).

**Same parameters as `/api/chat`**

**Response Format:** Server-Sent Events
```
data: {"chunk": "AI response chunk", "type": "content"}\n\n
data: {"type": "done", "metadata": {...}}\n\n
```

**Example:**
```bash
curl -X POST http://localhost:3456/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain chronic kidney disease",
    "model": "grok",
    "doc": "smh"
  }'
```

## Authentication

### POST `/api/auth/verify`

Verify JWT token and return user info.

**Request Body:**
```json
{
  "token": "string (Supabase JWT token)"
}
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "user_metadata": {}
  }
}
```

### GET `/api/auth/user`

Get current authenticated user info.

**Headers:**
- `Authorization: Bearer <token>`

**Response:** Same as verify endpoint

## Permissions & Access Control

### GET `/api/permissions`

Get current user's permissions and owner access groups.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "permissions": [
    {
      "user_id": "string",
      "owner_id": "string",
      "owner_slug": "string",
      "owner_name": "string",
      "role": "owner_admin | member"
    }
  ],
  "is_super_admin": false,
  "owner_groups": [
    {
      "owner_id": "string",
      "owner_slug": "string",
      "owner_name": "string",
      "role": "string"
    }
  ]
}
```

### GET `/api/permissions/accessible-owners`

Get list of owner groups user can access with details.

**Headers:**
- `Authorization: Bearer <token>`

### GET `/api/permissions/accessible-documents`

Get list of documents user can access (including private ones).

**Headers:**
- `Authorization: Bearer <token>`

### POST `/api/permissions/check-access/:slug`

Check if user can access a specific document.

**Parameters:**
- `slug` - Document slug

**Headers:**
- `Authorization: Bearer <token>` (optional)

**Response:**
```json
{
  "has_access": true,
  "document_exists": true,
  "error_type": null,
  "message": null,
  "document_info": {
    "title": "string",
    "access_level": "public | private",
    "requires_passcode": false
  }
}
```

### POST `/api/permissions/grant-owner-access` (Admin only)

Grant user access to owner group.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "target_user_id": "string",
  "owner_id": "string"
}
```

### DELETE `/api/permissions/revoke-owner-access/:access_id` (Admin only)

Revoke user's access to owner group.

## Health & Monitoring

### GET `/api/health`

Health check with document registry status.

**Query Parameters:**
- `doc` - Document slug to check (optional)

**Response:**
```json
{
  "status": "ok",
  "mode": "rag-only",
  "currentDocument": "Document Title",
  "currentDocumentType": "slug",
  "availableDocuments": ["array of slugs"],
  "totalAvailableDocuments": 150,
  "requestedDoc": "slug"
}
```

### GET `/api/ready`

Readiness check for load balancers.

**Response:**
```json
{
  "status": "ready",
  "message": "Server is fully ready to serve requests",
  "availableDocuments": 150
}
```

### GET `/api/version`

Server version and architecture info.

**Response:**
```json
{
  "version": "2.0.0-refactored",
  "architecture": "modular",
  "serverFile": "server.js (326 lines)",
  "modules": ["array of module names"],
  "refactoredDate": "2025-10-20",
  "totalModules": 8
}
```

## Analytics

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
    "doc-slug": {
      "count": 45,
      "version": "2025",
      "avgResponseTime": 1250,
      "totalTime": 56250
    }
  },
  "avgResponseTime": {
    "gemini": 1180,
    "grok": 1320
  },
  "errors": 2,
  "uniqueSessions": 89,
  "uniqueDocuments": 12,
  "timeframe": "24h",
  "recentQuestions": [
    {
      "question": "What is CKD?",
      "model": "grok",
      "document": "kdigo-ckd-2024",
      "timestamp": "2025-10-27T...",
      "responseTime": 1250
    }
  ]
}
```

## Cache Management

### GET `/api/cache/stats`

Get embedding cache statistics.

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

Clear the embedding cache.

**Response:**
```json
{
  "success": true,
  "message": "Embedding cache cleared"
}
```

## Rating System

### POST `/api/rate`

Submit conversation rating.

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
  "message": "Rating submitted successfully"
}
```

## User Management (Admin)

### GET `/api/users` (Super Admin Only)

Get all users with roles and permissions.

**Headers:**
- `Authorization: Bearer <super-admin-token>`

**Response:** Array of user objects with roles and owner access

### PUT `/api/users/:userId/role` (Super Admin Only)

Update user role and owner assignment.

**Headers:**
- `Authorization: Bearer <super-admin-token>`

**Request Body:**
```json
{
  "role": "owner_admin | member | super_admin",
  "owner_id": "string (optional)"
}
```

### POST `/api/users/:email/reset-password` (Super Admin Only)

Send password reset email.

**Headers:**
- `Authorization: Bearer <super-admin-token>`

### PUT `/api/users/:userId/password` (Super Admin Only)

Update user password directly.

**Headers:**
- `Authorization: Bearer <super-admin-token>`

**Request Body:**
```json
{
  "password": "string (min 6 chars)"
}
```

### DELETE `/api/users/:userId` (Super Admin Only)

Delete user account.

**Headers:**
- `Authorization: Bearer <super-admin-token>`

## Document Routes (Frontend)

### GET `/`

Root route - redirects to `/chat` with doc parameter or serves landing page.

### GET `/chat`

Chat interface with dynamic meta tags.

**Query Parameters:**
- `doc` - Document slug or multi-doc with `+` separator

### GET `/goodbye`

Goodbye page for declined disclaimer.

### GET `/app`

React admin app (serves index.html).

### GET `/app/*`

React Router - serves index.html for all admin routes.

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "error": "Error message description",
  "details": "Additional error information (optional)"
}
```

## Authentication & Authorization

- **JWT Tokens**: Supabase JWT tokens required for authenticated endpoints
- **Header**: `Authorization: Bearer <token>`
- **Role-based Access**: owner_admin, member, super_admin roles
- **Document Access**: Public documents accessible without auth, private require appropriate permissions

## Key Features

- **Multi-document Search**: Use `+` separator (e.g., `doc=smh+kdigo-ckd-2024`)
- **Embedding Types**: OpenAI (1536D) or Local (384D) embeddings
- **Streaming Responses**: Real-time AI responses via Server-Sent Events
- **Performance Monitoring**: Detailed timing breakdowns and analytics
- **Access Control**: Owner-based document permissions with RLS

## Common Usage Patterns

### Basic Chat Request
```bash
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are dialysis indications?",
    "doc": "smh",
    "model": "grok"
  }'
```

### Multi-document Search
```bash
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Compare CKD guidelines",
    "doc": "kdigo-ckd-2024+smh",
    "model": "gemini"
  }'
```

### Streaming Chat
```bash
curl -X POST http://localhost:3456/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain chronic kidney disease",
    "doc": "smh"
  }'
```

### Check Document Access
```bash
curl -X POST http://localhost:3456/api/permissions/check-access/kdigo-ckd-2024 \
  -H "Authorization: Bearer <token>"
```

### Get Analytics
```bash
curl "http://localhost:3456/api/analytics?timeframe=24h"
```

## Environment Variables

- `PORT`: Server port (default: 3456)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (admin operations)
- `GEMINI_API_KEY`: Google Gemini API key
- `XAI_API_KEY`: xAI/Grok API key
- `OPENAI_API_KEY`: OpenAI API key (optional)

## Production Considerations

- Implement proper rate limiting for chat endpoints
- Monitor embedding cache performance
- Set up proper CORS policies
- Enable HTTPS in production
- Consider API versioning for future changes
- Monitor database performance with complex queries
