/**
 * PubMed API Service
 * Fetches article metadata from NCBI E-utilities API
 */

// Cache for PubMed API responses
const pubmedCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch article metadata from PubMed using esummary
 * @param {string} pmid - PubMed ID
 * @returns {Promise<Object>} Article metadata
 */
export async function fetchPubMedArticle(pmid) {
    // Check cache first
    const cached = getCachedArticle(pmid);
    if (cached) {
        console.log(`📚 PubMed cache hit for PMID: ${pmid}`);
        return cached;
    }

    try {
        console.log(`📚 Fetching PubMed data for PMID: ${pmid}`);

        const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error(`Rate limit exceeded. Please wait before making another request.`);
            } else {
                throw new Error(`PubMed API error: ${response.status} ${response.statusText}`);
            }
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`PubMed API returned error: ${data.error}`);
        }

        // Extract article data
        const result = data.result[pmid];
        if (!result) {
            throw new Error('Article not found in PubMed');
        }

        const articleData = {
            pmid: pmid,
            title: result.title || 'Title not available',
            authors: formatAuthors(result.authors),
            journal: result.source || result.fulljournalname || 'Journal not available',
            pubDate: formatPubDate(result),
            doi: extractDOI(result),
            abstract: result.abstract || null,
            volume: result.volume || null,
            issue: result.issue || null,
            pages: result.pages || null,
            fetchedAt: Date.now()
        };

        // Cache the result
        setCachedArticle(pmid, articleData);

        return articleData;

    } catch (error) {
        console.error('Error fetching PubMed article:', error);
        throw error;
    }
}

/**
 * Format author list for display
 */
function formatAuthors(authors) {
    if (!authors || authors.length === 0) {
        return 'Authors not available';
    }

    // Take first 3 authors, then add "et al." if more
    const authorNames = authors.slice(0, 3).map(author => {
        // Use collective name if available, otherwise format name
        if (author.collectivename) {
            return author.collectivename;
        }
        return `${author.name || author.lastname || ''}${author.forename ? ` ${author.forename}` : ''}`.trim();
    });

    if (authors.length > 3) {
        authorNames.push('et al.');
    }

    return authorNames.join(', ');
}

/**
 * Format publication date
 */
function formatPubDate(result) {
    const pubdate = result.pubdate || result.epubdate;
    if (!pubdate) return 'Date not available';

    // Parse different date formats
    try {
        const date = new Date(pubdate);
        if (isNaN(date.getTime())) {
            return pubdate; // Return as-is if parsing fails
        }
        return date.getFullYear().toString();
    } catch {
        return pubdate;
    }
}

/**
 * Extract DOI from article data
 */
function extractDOI(result) {
    // Check various places where DOI might be stored
    if (result.doi) return result.doi;
    if (result.elocationid && result.elocationid.startsWith('10.')) return result.elocationid;

    // Check articleids array
    if (result.articleids) {
        const doiEntry = result.articleids.find(id => id.idtype === 'doi');
        if (doiEntry) return doiEntry.value;
    }

    return null;
}

/**
 * Get cached article if still valid
 */
function getCachedArticle(pmid) {
    const cached = pubmedCache.get(pmid);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.fetchedAt > CACHE_DURATION) {
        pubmedCache.delete(pmid);
        return null;
    }

    return cached;
}

/**
 * Cache article data
 */
function setCachedArticle(pmid, data) {
    pubmedCache.set(pmid, data);

    // Clean up old cache entries periodically
    if (pubmedCache.size > 100) {
        // Remove oldest entries
        const entries = Array.from(pubmedCache.entries());
        entries.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
        const toRemove = entries.slice(0, 20); // Remove 20 oldest
        toRemove.forEach(([key]) => pubmedCache.delete(key));
    }
}

/**
 * Clear PubMed cache
 */
export function clearPubMedCache() {
    pubmedCache.clear();
    console.log('🗑️ PubMed cache cleared');
}

/**
 * Get cache statistics
 */
export function getPubMedCacheStats() {
    return {
        size: pubmedCache.size,
        entries: Array.from(pubmedCache.keys())
    };
}
