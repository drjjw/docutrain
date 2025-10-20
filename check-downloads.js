const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDownloads() {
    const { data, error } = await supabase
        .from('documents')
        .select('slug, title, downloads')
        .eq('slug', 'obesity-management-2024')
        .single();
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('Document:', data.title);
    console.log('Downloads:', JSON.stringify(data.downloads, null, 2));
}

checkDownloads();

