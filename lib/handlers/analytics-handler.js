/**
 * Analytics route handler
 * Handles GET /api/documents/:documentId/analytics - Get document analytics
 */

const { authenticateUser, createServiceRoleClient } = require('../utils/documents-auth');

/**
 * Handle GET /api/documents/:documentId/analytics
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 */
async function handleDocumentAnalytics(req, res, supabase) {
    try {
        const { documentId } = req.params;

        // Get authenticated user
        const { userId } = await authenticateUser(req, supabase);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Create service role client for bypassing RLS
        const serviceSupabase = createServiceRoleClient(supabase);

        // Verify document exists
        const { data: document, error: docError } = await serviceSupabase
            .from('documents')
            .select('id, title, slug')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Query conversations - use JSONB containment operator to find conversations with this document_id
        // PostgreSQL JSONB @> operator checks if left JSONB contains right JSONB
        // For Supabase PostgREST, we need to use a filter that checks if the JSONB array contains the document ID
        // Also handle legacy conversations that use document_name/pdf_name instead of document_ids
        
        // Get query parameters for pagination
        const limit = parseInt(req.query.limit || '100', 10); // Default 100, max 1000
        const offset = parseInt(req.query.offset || '0', 10);
        const maxLimit = Math.min(limit, 1000); // Cap at 1000 for performance
        
        let conversations = [];
        let totalConversations = 0;
        let convData = null; // Declare outside try block for stats calculation
        const documentSlug = document.slug; // Declare outside try block for stats calculation
        
        try {
            // Query conversations with document_ids (new format)
            // Limit to recent 2000 for better performance (can be increased if needed)
            const { data: fetchedConvData, error: convError } = await serviceSupabase
                .from('chat_conversations')
                .select(`
                    id,
                    question,
                    response,
                    user_id,
                    ip_address,
                    created_at,
                    model,
                    session_id,
                    document_ids,
                    document_name,
                    pdf_name
                `)
                .order('created_at', { ascending: false })
                .limit(2000); // Reduced from 5000 for better performance

            if (convError) {
                console.error('Error fetching conversations:', convError);
            } else if (fetchedConvData) {
                convData = fetchedConvData; // Store for stats calculation
                // Filter conversations where:
                // 1. document_ids array contains our documentId (new format)
                // 2. OR document_name/pdf_name matches document slug (legacy format)
                const matchingConversations = convData.filter(conv => {
                    // New format: check document_ids array
                    if (conv.document_ids && Array.isArray(conv.document_ids)) {
                        return conv.document_ids.includes(documentId);
                    }
                    // Legacy format: check document_name or pdf_name
                    if (documentSlug) {
                        const docName = conv.document_name || conv.pdf_name || '';
                        // Check if document_name/pdf_name contains the slug or matches document title
                        return docName.toLowerCase().includes(documentSlug.toLowerCase()) ||
                               docName.toLowerCase().includes(document.title.toLowerCase());
                    }
                    return false;
                });
                
                totalConversations = matchingConversations.length;
                // Apply pagination
                conversations = matchingConversations.slice(offset, offset + maxLimit);
            }
        } catch (err) {
            console.error('Error in conversation query:', err);
        }

        console.log(`Analytics: Found ${totalConversations} total conversations, returning ${conversations.length} (offset: ${offset}, limit: ${maxLimit}) for document ${documentId} (${document.slug})`);

        // Get user IDs from conversations
        const userIds = conversations ? [...new Set(conversations.map(c => c.user_id).filter(Boolean))] : [];
        
        // Fetch user profiles and emails
        let userMap = {};
        if (userIds.length > 0) {
            // Get user profiles
            const { data: profiles, error: profilesError } = await serviceSupabase
                .from('user_profiles')
                .select('user_id, first_name, last_name')
                .in('user_id', userIds);

            if (!profilesError && profiles) {
                profiles.forEach(profile => {
                    userMap[profile.user_id] = {
                        first_name: profile.first_name,
                        last_name: profile.last_name
                    };
                });
            }

            // Get user emails from auth.users (requires service role)
            const { data: users, error: usersError } = await serviceSupabase.auth.admin.listUsers();
            if (!usersError && users && users.users) {
                users.users.forEach(user => {
                    if (userMap[user.id]) {
                        userMap[user.id].email = user.email;
                    } else {
                        userMap[user.id] = { email: user.email };
                    }
                });
            }
        }

        // Process conversations with user info
        const processedConversations = (conversations || []).map(conv => {
            const userInfo = conv.user_id ? userMap[conv.user_id] : null;
            return {
                id: conv.id,
                question: conv.question,
                response: conv.response,
                user_email: userInfo?.email || null,
                user_name: userInfo?.first_name || userInfo?.last_name 
                    ? `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() 
                    : null,
                ip_address: conv.ip_address || null,
                created_at: conv.created_at,
                model: conv.model,
                session_id: conv.session_id
            };
        });

        // Calculate conversation statistics using ALL matching conversations (not just paginated)
        // We need to recalculate stats based on total matching conversations
        // For now, we'll calculate stats from the filtered results we have
        // Note: This is approximate since we're only looking at recent 2000 conversations
        const allMatchingConversations = convData ? convData.filter(conv => {
            if (conv.document_ids && Array.isArray(conv.document_ids)) {
                return conv.document_ids.includes(documentId);
            }
            if (documentSlug) {
                const docName = conv.document_name || conv.pdf_name || '';
                return docName.toLowerCase().includes(documentSlug.toLowerCase()) ||
                       docName.toLowerCase().includes(document.title.toLowerCase());
            }
            return false;
        }) : [];
        
        const uniqueUserIds = new Set(allMatchingConversations.map(c => c.user_id).filter(Boolean));
        const uniqueIPs = new Set(allMatchingConversations.map(c => c.ip_address).filter(Boolean));
        const conversationStats = {
            total: totalConversations, // Use total count from pagination
            uniqueUsers: uniqueUserIds.size,
            uniqueIPs: uniqueIPs.size
        };

        // Query downloads via document_attachments
        const { data: attachments, error: attachmentsError } = await serviceSupabase
            .from('document_attachments')
            .select('id, title, url')
            .eq('document_id', documentId);

        if (attachmentsError) {
            console.error('Error fetching attachments:', attachmentsError);
        }

        const attachmentIds = attachments ? attachments.map(a => a.id) : [];
        let downloads = [];
        let totalDownloads = 0;
        let allDownloadRecords = []; // Store for stats calculation
        // Get download pagination params - declare outside if block
        const downloadLimit = parseInt(req.query.downloadLimit || '100', 10);
        const downloadOffset = parseInt(req.query.downloadOffset || '0', 10);
        const maxDownloadLimit = Math.min(downloadLimit, 1000);

        if (attachmentIds.length > 0) {
            // Query download tracking records
            const { data: downloadRecords, error: downloadsError } = await serviceSupabase
                .from('document_attachment_downloads')
                .select(`
                    id,
                    attachment_id,
                    user_id,
                    ip_address,
                    downloaded_at
                `)
                .in('attachment_id', attachmentIds)
                .order('downloaded_at', { ascending: false })
                .limit(2000); // Limit to recent 2000 for performance

            if (downloadsError) {
                console.error('Error fetching downloads:', downloadsError);
            } else if (downloadRecords) {
                allDownloadRecords = downloadRecords; // Store for stats calculation
                totalDownloads = downloadRecords.length;
                
                // Create attachment map
                const attachmentMap = {};
                attachments.forEach(att => {
                    attachmentMap[att.id] = { title: att.title, url: att.url };
                });

                // Get user IDs from downloads
                const downloadUserIds = [...new Set(downloadRecords.map(d => d.user_id).filter(Boolean))];
                
                // Fetch user info for downloads
                let downloadUserMap = {};
                if (downloadUserIds.length > 0) {
                    const { data: downloadProfiles, error: downloadProfilesError } = await serviceSupabase
                        .from('user_profiles')
                        .select('user_id, first_name, last_name')
                        .in('user_id', downloadUserIds);

                    if (!downloadProfilesError && downloadProfiles) {
                        downloadProfiles.forEach(profile => {
                            downloadUserMap[profile.user_id] = {
                                first_name: profile.first_name,
                                last_name: profile.last_name
                            };
                        });
                    }

                    // Get emails from auth.users
                    const { data: downloadUsers, error: downloadUsersError } = await serviceSupabase.auth.admin.listUsers();
                    if (!downloadUsersError && downloadUsers && downloadUsers.users) {
                        downloadUsers.users.forEach(user => {
                            if (downloadUserIds.includes(user.id)) {
                                if (downloadUserMap[user.id]) {
                                    downloadUserMap[user.id].email = user.email;
                                } else {
                                    downloadUserMap[user.id] = { email: user.email };
                                }
                            }
                        });
                    }
                }

                // Process downloads with user info and apply pagination
                const processedDownloads = downloadRecords.map(record => {
                    const attachment = attachmentMap[record.attachment_id];
                    const userInfo = record.user_id ? downloadUserMap[record.user_id] : null;
                    return {
                        id: record.id,
                        attachment_title: attachment ? attachment.title : 'Unknown',
                        attachment_url: attachment ? attachment.url : null,
                        user_email: userInfo?.email || null,
                        user_name: userInfo?.first_name || userInfo?.last_name 
                            ? `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() 
                            : null,
                        ip_address: record.ip_address || null,
                        downloaded_at: record.downloaded_at
                    };
                });
                
                downloads = processedDownloads.slice(downloadOffset, downloadOffset + maxDownloadLimit);
            }
        }

        // Calculate download statistics using ALL download records (not just paginated)
        let uniqueDownloadUsers = 0;
        let uniqueDownloadIPs = new Set();
        
        if (allDownloadRecords.length > 0) {
            const allDownloadUserIds = [...new Set(allDownloadRecords.map(d => d.user_id).filter(Boolean))];
            const allDownloadUserEmails = new Set();
            
            // Fetch user emails for all downloads to calculate stats accurately
            if (allDownloadUserIds.length > 0) {
                const { data: allDownloadUsers, error: allDownloadUsersError } = await serviceSupabase.auth.admin.listUsers();
                if (!allDownloadUsersError && allDownloadUsers && allDownloadUsers.users) {
                    allDownloadUsers.users.forEach(user => {
                        if (allDownloadUserIds.includes(user.id) && user.email) {
                            allDownloadUserEmails.add(user.email);
                        }
                    });
                }
            }
            
            uniqueDownloadUsers = allDownloadUserEmails.size > 0 
                ? allDownloadUserEmails.size 
                : new Set(allDownloadRecords.map(d => d.user_id).filter(Boolean)).size;
            uniqueDownloadIPs = new Set(allDownloadRecords.map(d => d.ip_address).filter(Boolean));
        }
        
        const downloadStats = {
            total: totalDownloads, // Use total count from pagination
            uniqueUsers: uniqueDownloadUsers,
            uniqueIPs: uniqueDownloadIPs.size
        };

        // Return analytics data
        const result = {
            conversationStats,
            conversations: processedConversations,
            conversationPagination: {
                total: totalConversations,
                limit: maxLimit,
                offset: offset,
                hasMore: (offset + maxLimit) < totalConversations
            },
            downloadStats,
            downloads,
            downloadPagination: {
                total: totalDownloads,
                limit: maxDownloadLimit,
                offset: downloadOffset,
                hasMore: (downloadOffset + maxDownloadLimit) < totalDownloads
            }
        };
        
        console.log(`Analytics response for ${documentId}:`, {
            conversationCount: processedConversations.length,
            totalConversations,
            downloadCount: downloads.length,
            totalDownloads,
            conversationStats,
            downloadStats
        });
        
        res.json(result);

    } catch (error) {
        console.error('Error in document analytics API:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch analytics',
            message: error.message || 'Unknown error'
        });
    }
}

module.exports = {
    handleDocumentAnalytics
};

