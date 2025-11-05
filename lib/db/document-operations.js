/**
 * Document Operations
 * Handles document CRUD operations and owner ID resolution
 */

const { createClient } = require('@supabase/supabase-js');
const { DatabaseError } = require('../errors/processing-errors');
const { validateSupabaseClient, validateDocumentSlug, validateUserDocId, sanitizeString } = require('../utils/input-validator');

/**
 * Resolve owner ID for a user
 * Determines the appropriate owner_id based on user roles and access
 * 
 * @param {Object} serviceSupabase - Supabase service role client (bypasses RLS)
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Owner ID or null if super admin
 */
async function resolveOwnerId(serviceSupabase, userId) {
    validateSupabaseClient(serviceSupabase);
    
    if (!userId || typeof userId !== 'string') {
        throw new Error('userId must be a valid string');
    }
    
    // Check if user is super admin (global super admin has owner_id IS NULL)
    const { data: userRoles, error: rolesError } = await serviceSupabase
        .from('user_roles')
        .select('role, owner_id')
        .eq('user_id', userId)
        .eq('role', 'super_admin');
    
    if (rolesError) {
        console.warn(`⚠️ Error checking user roles: ${rolesError.message}`);
    }
    
    // Check if user is a global super admin (owner_id IS NULL)
    const isSuperAdmin = userRoles && userRoles.some(r => r.owner_id === null);
    
    if (isSuperAdmin) {
        // Super admin - return null (can be set later in edit modal)
        return null;
    }
    
    // Get user's owner group from user_owner_access (regular members)
    const { data: ownerAccess, error: ownerAccessError } = await serviceSupabase
        .from('user_owner_access')
        .select('owner_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
    
    if (!ownerAccessError && ownerAccess?.owner_id) {
        return ownerAccess.owner_id;
    }
    
    // Check user_roles for owner_admin or registered roles with owner_id
    const { data: userRolesWithOwner, error: rolesWithOwnerError } = await serviceSupabase
        .from('user_roles')
        .select('owner_id')
        .eq('user_id', userId)
        .not('owner_id', 'is', null)
        .limit(1)
        .maybeSingle();
    
    if (!rolesWithOwnerError && userRolesWithOwner?.owner_id) {
        return userRolesWithOwner.owner_id;
    }
    
    // No owner found - return null (will be set later if needed)
    return null;
}

/**
 * Create service role Supabase client
 * Useful for operations that need to bypass RLS
 * 
 * @returns {Object} Supabase service role client
 */
function createServiceSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }
    
    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Create document record
 * 
 * @param {Object} supabase - Supabase client (should be service role)
 * @param {string} documentSlug - Document slug
 * @param {string} title - Document title
 * @param {string} filePath - File path in storage
 * @param {string} userId - User ID who uploaded
 * @param {string|null} ownerId - Owner ID (null for super admin)
 * @param {string|null} abstract - Abstract text
 * @param {Array|null} keywords - Keywords array
 * @param {Object} userDoc - User document record
 * @returns {Promise<void>}
 * @throws {DatabaseError} If creation fails
 */
async function createDocumentRecord(
    supabase,
    documentSlug,
    title,
    filePath,
    userId,
    ownerId,
    abstract,
    keywords,
    userDoc
) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const sanitizedTitle = sanitizeString(title, 'title');
    
    // Create intro message with abstract (if available)
    let introMessage = `Ask questions about ${sanitizedTitle}`;
    if (abstract) {
        introMessage = `<div class="document-abstract"><p><strong>Document Summary:</strong></p><p>${abstract}</p></div><p>Ask questions about this document below.</p>`;
    }
    
    const { error } = await supabase
        .from('documents')
        .insert({
            slug: documentSlug,
            title: sanitizedTitle,
            subtitle: null,
            welcome_message: `Ask questions about ${sanitizedTitle}`,
            intro_message: introMessage,
            pdf_filename: filePath.split('/').pop(),
            pdf_subdirectory: 'user-uploads',
            embedding_type: 'openai',
            active: true,
            access_level: 'owner_restricted',
            owner_id: ownerId,
            uploaded_by_user_id: userId,
            metadata: {
                user_document_id: userDoc.id,
                user_id: userId,
                uploaded_at: userDoc.created_at,
                file_size: userDoc.file_size,
                has_ai_abstract: abstract ? true : false,
                keywords: keywords || null
            }
        });
    
    if (error) {
        throw new DatabaseError(
            `Failed to create document record: ${error.message}`,
            {
                documentSlug,
                errorCode: error.code,
                errorDetails: error.details
            }
        );
    }
}

/**
 * Update document record
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 * @throws {DatabaseError} If update fails
 */
async function updateDocumentRecord(supabase, documentSlug, updates) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { error } = await supabase
        .from('documents')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('slug', documentSlug);
    
    if (error) {
        throw new DatabaseError(
            `Failed to update document record: ${error.message}`,
            {
                documentSlug,
                errorCode: error.code,
                errorDetails: error.details
            }
        );
    }
}

/**
 * Get document record
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<Object|null>} Document record or null
 * @throws {DatabaseError} If query fails
 */
async function getDocumentRecord(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('slug', documentSlug)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            // Not found - return null
            return null;
        }
        
        throw new DatabaseError(
            `Failed to get document record: ${error.message}`,
            {
                documentSlug,
                errorCode: error.code
            }
        );
    }
    
    return data;
}

/**
 * Delete document record
 * Note: Should delete chunks first (foreign key constraint)
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<void>}
 * @throws {DatabaseError} If deletion fails
 */
async function deleteDocumentRecord(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('slug', documentSlug);
    
    if (error) {
        throw new DatabaseError(
            `Failed to delete document record: ${error.message}`,
            {
                documentSlug,
                errorCode: error.code
            }
        );
    }
}

module.exports = {
    resolveOwnerId,
    createServiceSupabaseClient,
    createDocumentRecord,
    updateDocumentRecord,
    getDocumentRecord,
    deleteDocumentRecord
};

