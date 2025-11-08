/**
 * Send processing notification email via edge function
 * @param {Object} params - Notification parameters
 * @param {string} params.user_id - User ID
 * @param {string} params.document_title - Document title
 * @param {string} params.document_url - Document URL (optional)
 * @param {string} params.status - 'success' or 'failure'
 * @param {string} [params.error_message] - Error message (for failures)
 * @param {string} [params.error_details] - Error details (for failures)
 * @param {Object} [params.stats] - Processing stats (for successes)
 * @param {string} [params.processing_method] - Processing method ('edge_function', 'vps', 'vps_fallback')
 * @returns {Promise<Object>} Result with success status
 */
async function sendProcessingNotification({
    user_id,
    document_title,
    document_url,
    status,
    error_message,
    error_details,
    stats,
    processing_method
}) {
    try {
        const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/send-processing-notification`;
        
        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
                user_id,
                document_title,
                document_url,
                status,
                error_message,
                error_details,
                stats,
                processing_method
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            console.error('Failed to send processing notification:', errorData);
            return { success: false, error: errorData.error || 'Failed to send notification' };
        }

        const result = await response.json();
        return { success: true, ...result };
    } catch (error) {
        console.error('Error sending processing notification:', error);
        // Don't throw - notification failure shouldn't break processing
        return { success: false, error: error.message };
    }
}

module.exports = { sendProcessingNotification };

