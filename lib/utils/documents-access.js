/**
 * Document routes access checking utilities
 * Centralized document access checking logic
 */

/**
 * Check if any documents are passcode-protected
 * @param {Array<string>} docSlugs - Array of document slugs
 * @param {object} serviceSupabase - Service role Supabase client
 * @returns {Promise<boolean>}
 */
async function hasPasscodeProtectedDocs(docSlugs, serviceSupabase) {
    if (docSlugs.length === 0) {
        return false;
    }
    
    try {
        const { data: docAccessLevels, error: accessLevelError } = await serviceSupabase
            .from('documents')
            .select('slug, access_level')
            .in('slug', docSlugs)
            .eq('active', true);
        
        if (!accessLevelError && docAccessLevels) {
            const hasPasscode = docAccessLevels.some(doc => doc.access_level === 'passcode');
            if (hasPasscode) {
                console.log(`🔐 Found passcode-protected document(s) - using individual access checks`);
            }
            return hasPasscode;
        } else if (accessLevelError) {
            console.log(`⚠️  Error checking access levels, using individual checks for safety:`, accessLevelError.message);
            // If we can't check access levels, use individual checks to be safe
            return true;
        }
    } catch (queryError) {
        console.log(`⚠️  Exception checking access levels, using individual checks for safety:`, queryError.message);
        // If we can't check access levels, use individual checks to be safe
        return true;
    }
    
    return false;
}

/**
 * Check document access individually (for passcode-protected docs or when batch fails)
 * @param {string|null} userId - User ID (null for anonymous)
 * @param {string} docSlug - Document slug
 * @param {object} supabase - Supabase client
 * @param {string|null} passcode - Optional passcode
 * @returns {Promise<boolean>}
 */
async function checkDocumentAccessIndividual(userId, docSlug, supabase, passcode = null) {
    console.log(`🔍 Checking access for document: ${docSlug}`);
    const { data: hasAccess, error } = await supabase
        .rpc('user_has_document_access_by_slug', {
            p_user_id: userId,
            p_document_slug: docSlug,
            p_passcode: passcode || null,
        });
    if (error) {
        console.log(`❌ Access check error for ${docSlug}:`, error);
    }
    const accessResult = hasAccess || false;
    console.log(`🔍 Access result for ${docSlug}: ${accessResult}`);
    return accessResult;
}

/**
 * Check document access in batch (more efficient for multiple docs)
 * @param {string|null} userId - User ID (null for anonymous)
 * @param {Array<string>} docSlugs - Array of document slugs
 * @param {object} supabase - Supabase client
 * @returns {Promise<Array<boolean>>}
 */
async function checkDocumentAccessBatch(userId, docSlugs, supabase) {
    console.log(`🔄 Attempting batch access check for ${docSlugs.length} documents`);
    const { data: batchResults, error: batchError } = await supabase
        .rpc('user_has_multiple_document_access', {
            p_user_id: userId,
            p_document_slugs: docSlugs
        });

    if (batchError) {
        console.log(`⚠️  Batch access check failed, falling back to individual checks:`, batchError.message);
        throw batchError;
    }

    // Convert batch results to access array
    const accessMap = {};
    batchResults.forEach(result => {
        accessMap[result.document_slug] = result.has_access;
    });

    const accessChecks = docSlugs.map(docSlug => {
        const hasAccess = accessMap[docSlug] || false;
        console.log(`🔍 Access result for ${docSlug}: ${hasAccess}`);
        return hasAccess;
    });

    console.log(`✅ Batch access check completed in single query`);
    return accessChecks;
}

/**
 * Check document access for multiple documents (with automatic batch/individual selection)
 * @param {string|null} userId - User ID (null for anonymous)
 * @param {Array<string>} docSlugs - Array of document slugs
 * @param {object} supabase - Supabase client
 * @param {object} serviceSupabase - Service role Supabase client
 * @param {string|null} passcode - Optional passcode
 * @returns {Promise<Array<boolean>>}
 */
async function checkDocumentAccessMultiple(userId, docSlugs, supabase, serviceSupabase, passcode = null) {
    let accessChecks = [];
    
    // Check if any documents are passcode-protected (to decide whether to use batch or individual checks)
    let hasPasscodeProtectedDocsFlag = false;
    if (!passcode && docSlugs.length > 0) {
        hasPasscodeProtectedDocsFlag = await hasPasscodeProtectedDocs(docSlugs, serviceSupabase);
    }
    
    if (passcode || hasPasscodeProtectedDocsFlag) {
        console.log(`🔐 Using individual access checks ${passcode ? '(passcode provided)' : '(passcode-protected docs detected)'}`);
        accessChecks = await Promise.all(
            docSlugs.map(docSlug => checkDocumentAccessIndividual(userId, docSlug, supabase, passcode))
        );
    } else {
        // No passcode-protected docs and no passcode provided - can use batch check for efficiency
        try {
            accessChecks = await checkDocumentAccessBatch(userId, docSlugs, supabase);
        } catch (batchError) {
            // Fallback to individual access checks
            console.log(`🔄 Falling back to individual access checks`);
            accessChecks = await Promise.all(
                docSlugs.map(docSlug => checkDocumentAccessIndividual(userId, docSlug, supabase, passcode))
            );
        }
    }
    
    return accessChecks;
}

/**
 * Check document permissions (super_admin or owner_admin)
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID or slug
 * @param {object} serviceSupabase - Service role Supabase client
 * @returns {Promise<{isSuperAdmin: boolean, isOwnerAdmin: boolean, doc: object}>}
 */
async function checkDocumentPermissions(userId, documentId, serviceSupabase) {
    // Get document info first
    // Try slug first (since slugs can be UUIDs too), then try ID if slug lookup fails
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId);
    
    let doc = null;
    let docError = null;
    
    // First, try looking up by slug (works for both UUID slugs and regular slugs)
    const { data: docBySlug, error: slugError } = await serviceSupabase
        .from('documents')
        .select('id, owner_id, slug')
        .eq('slug', documentId)
        .single();
    
    if (!slugError && docBySlug) {
        doc = docBySlug;
    } else if (isUUID) {
        // If slug lookup failed and identifier looks like a UUID, try ID lookup
        const { data: docById, error: idError } = await serviceSupabase
            .from('documents')
            .select('id, owner_id, slug')
            .eq('id', documentId)
            .single();
        
        if (!idError && docById) {
            doc = docById;
        } else {
            docError = idError || slugError;
        }
    } else {
        docError = slugError;
    }
    
    if (docError) {
        console.error(`❌ [checkDocumentPermissions] Error looking up document ${documentId}:`, docError);
        return { isSuperAdmin: false, isOwnerAdmin: false, doc: null };
    }
    
    if (!doc) {
        console.error(`❌ [checkDocumentPermissions] Document not found: ${documentId} (tried slug${isUUID ? ' and id' : ''})`);
        return { isSuperAdmin: false, isOwnerAdmin: false, doc: null };
    }
    
    // Check if user is super admin
    const { data: superAdminCheck, error: superAdminError } = await serviceSupabase
        .from('user_roles')
        .select('id, owner_id')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
        .limit(10);
    
    let isSuperAdmin = false;
    if (!superAdminError && superAdminCheck && superAdminCheck.length > 0) {
        // Check if user is a global super admin (owner_id IS NULL)
        isSuperAdmin = superAdminCheck.some(r => r.owner_id === null);
        
        // Also check if user is super admin for document's owner group
        if (!isSuperAdmin && doc.owner_id) {
            isSuperAdmin = superAdminCheck.some(r => r.owner_id === doc.owner_id);
        }
    }
    
    // Check if user is owner_admin for document's owner group
    let isOwnerAdmin = false;
    if (doc.owner_id) {
        const { data: ownerAdminCheck, error: ownerAdminError } = await serviceSupabase
            .from('user_roles')
            .select('id')
            .eq('user_id', userId)
            .eq('owner_id', doc.owner_id)
            .eq('role', 'owner_admin')
            .limit(1);
        
        isOwnerAdmin = !ownerAdminError && ownerAdminCheck && ownerAdminCheck.length > 0;
    }
    
    return { isSuperAdmin, isOwnerAdmin, doc };
}

module.exports = {
    hasPasscodeProtectedDocs,
    checkDocumentAccessIndividual,
    checkDocumentAccessBatch,
    checkDocumentAccessMultiple,
    checkDocumentPermissions
};

