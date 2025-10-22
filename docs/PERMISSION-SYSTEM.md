# Permission System Architecture

## Overview

This document describes the multi-layered permission system that controls document access and user management in the application. The system supports both public document libraries and private user-uploaded documents with granular access controls.

## System Components

### 1. Authentication Layer

#### Frontend Authentication
- **Supabase Auth Integration**: JWT-based authentication with React context
- **Session Management**: Automatic token refresh and state management
- **Route Protection**: `ProtectedRoute` component enforces authentication requirements
- **Context Provider**: `AuthContext` manages global auth state across the app

#### Backend Authentication
- **JWT Verification**: Bearer token validation in API endpoints
- **Optional Auth**: Some endpoints support both authenticated and unauthenticated access
- **User Context**: Authenticated requests include user ID for permission checks

### 2. Document Access System

#### A. Public Document Library

**Database Tables:**
- `documents`: Main document registry with visibility controls
- `owners`: Owner groups that manage document collections

**Visibility Controls:**
```sql
ALTER TABLE documents
ADD COLUMN is_public BOOLEAN DEFAULT true,
ADD COLUMN requires_auth BOOLEAN DEFAULT false;
```

**Access Patterns:**
1. **Public Documents** (`is_public = true, requires_auth = false`):
   - Accessible to everyone without authentication
   - No login required

2. **Public with Auth** (`is_public = true, requires_auth = true`):
   - Accessible to any authenticated user
   - Requires login but no specific permissions

3. **Private Documents** (`is_public = false`):
   - Requires specific owner group membership
   - Super admins bypass restrictions

#### B. User-Uploaded Documents

**Database Table:**
- `user_documents`: Personal documents with strict ownership

**Access Control:**
- **Row Level Security (RLS)**: Users can only access their own documents
- **Owner-Only Operations**: CRUD operations restricted to document owner
- **No Sharing**: Currently no document sharing between users

### 3. Permission Hierarchy

#### User Roles
```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('registered', 'owner_admin', 'super_admin')),
  owner_id UUID REFERENCES owners(id) -- NULL for global super_admins
);
```

**Role Definitions:**
- **`super_admin`**: Global system-wide administrator with access to ALL documents and owner groups (not tied to specific owners)
- **`owner_admin`**: Group administrator for specific owner collections
- **`registered`**: Basic user with access to assigned owner groups

#### Owner Group Access
```sql
CREATE TABLE user_owner_access (
  user_id UUID REFERENCES auth.users(id),
  owner_id UUID REFERENCES owners(id)
);
```

**Access Grants:**
- Direct membership in owner groups
- Enables access to private documents owned by that group
- Separate from role-based permissions

### 4. Core Permission Functions

#### Document Access Check
```sql
CREATE OR REPLACE FUNCTION user_has_document_access_by_slug(
  p_user_id UUID,
  p_document_slug TEXT
) RETURNS BOOLEAN
```

**Logic Flow:**
1. Check if document exists
2. Public documents: Allow based on `requires_auth` setting
3. Private documents: Verify owner group membership or super admin status
4. Return boolean access decision

#### Owner Access Query
```sql
CREATE OR REPLACE FUNCTION get_user_owner_access(p_user_id UUID)
RETURNS TABLE(owner_id UUID, role TEXT)
```

**Returns:**
- All owner groups user has access to
- Combined from both `user_roles` and `user_owner_access` tables

### 5. Frontend Integration

#### Permission Hooks
- `useAuth()`: Authentication state management
- `usePermissions()`: User permission and role information
- `useDocuments()`: User's personal document management

#### UI Components
- `ProtectedRoute`: Authentication enforcement
- `OwnerGroups`: Permission display and management
- `DocumentList`: Filtered document display

### 6. API Endpoints

#### Authentication-Required Endpoints
- `GET /api/permissions`: Current user permissions
- `GET /api/permissions/accessible-owners`: Available owner groups
- `GET /api/permissions/accessible-documents`: Accessible documents

#### Permission-Gated Endpoints
- `POST /api/permissions/grant-owner-access`: Grant group access (admin only)
- `DELETE /api/permissions/revoke-owner-access`: Revoke group access (admin only)

#### Document Access Endpoints
- `GET /api/documents`: Filtered document list with permission checks
- `POST /api/permissions/check-access/:slug`: Document access verification

## Current Limitations

### 1. Document Sharing
- No mechanism for users to share documents with each other
- No temporary or time-limited access grants
- No document-level permission overrides

### 2. Granular Permissions
- Owner group membership is all-or-nothing
- No document-specific permission inheritance
- No role hierarchies within owner groups

### 3. User Management
- No self-service owner group requests
- No bulk permission operations
- No permission audit trails beyond basic timestamps

### 4. Access Control Flexibility
- Documents are either public or private to entire owner groups
- No mixed visibility (e.g., public to some groups, private to others)
- No conditional access based on user attributes

## Expansion Opportunities

### Phase 1: Enhanced Sharing
- **Document Sharing Table**: Allow owners to share specific documents
- **Share Tokens**: Time-limited access URLs for external sharing
- **Permission Levels**: Read-only vs read-write sharing

### Phase 2: Advanced Permissions
- **Document-Level ACLs**: Override owner group permissions per document
- **Role Hierarchies**: Senior admin, content editor, viewer roles
- **Conditional Access**: Time-based, IP-based, or attribute-based rules

### Phase 3: User Management Automation
- **Self-Service Requests**: Users can request owner group access
- **Approval Workflows**: Multi-step permission grant processes
- **Bulk Operations**: Import/export user permissions

### Phase 4: Audit & Compliance
- **Access Logging**: Track who accessed what documents when
- **Permission Changes**: Audit trail for permission modifications
- **Compliance Reports**: GDPR/access right reports

## Database Schema Extensions

### Proposed New Tables

#### Document Sharing
```sql
CREATE TABLE document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  shared_by UUID REFERENCES auth.users(id),
  shared_with UUID REFERENCES auth.users(id),
  permission_level TEXT CHECK (permission_level IN ('read', 'write')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Permission Audit Log
```sql
CREATE TABLE permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT, -- 'grant', 'revoke', 'access', etc.
  target_type TEXT, -- 'document', 'owner', 'user'
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Access Requests
```sql
CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  owner_id UUID REFERENCES owners(id),
  request_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation Considerations

### 1. Backward Compatibility
- Existing public/private document logic must be preserved
- Current API contracts should not break
- Migration path for existing data

### 2. Performance Impact
- Additional permission checks may slow document queries
- Consider caching frequently accessed permissions
- Database indexes for new permission tables

### 3. Security Implications
- New sharing features increase attack surface
- Audit logging adds storage overhead
- Permission changes require careful validation

### 4. User Experience
- Clear permission indicators in UI
- Intuitive sharing workflows
- Self-service permission management

## Migration Strategy

### Phase 1 Deployment
1. Add new tables with proper RLS policies
2. Update permission functions to include sharing logic
3. Deploy API extensions alongside existing endpoints
4. Update frontend components incrementally

### Phase 2 Deployment
1. Enable advanced permission features
2. Implement audit logging
3. Add user management workflows
4. Update documentation and training

### Rollback Plan
- Feature flags to disable new functionality
- Database backup before schema changes
- Gradual rollout with monitoring

## Testing Strategy

### Unit Tests
- Permission function logic validation
- API endpoint permission enforcement
- Database constraint verification

### Integration Tests
- End-to-end permission workflows
- Cross-component permission interactions
- Performance impact assessment

### Security Testing
- Permission bypass attempts
- SQL injection in permission functions
- Access control edge cases

## Monitoring & Maintenance

### Key Metrics
- Permission check performance
- Failed access attempts
- Permission change frequency
- User onboarding completion rates

### Alerts
- Unusual permission grant patterns
- Performance degradation in access checks
- Failed permission validations

### Regular Maintenance
- Clean up expired shares
- Archive old audit logs
- Review and optimize permission queries
