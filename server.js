require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const { URL } = require('url'); // Import URL module

const app = express();
const port = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CUSTOM_SEARCH_ENGINE_ID = process.env.CUSTOM_SEARCH_ENGINE_ID;

app.use(express.static(path.join(__dirname, 'public')));

// *** נתיב החיפוש המקורי ***
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query parameter q is required' });
    if (!GOOGLE_API_KEY || !CUSTOM_SEARCH_ENGINE_ID) {
        console.error("API Key or Search Engine ID missing!");
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const searchUrl = "https://www.googleapis.com/customsearch/v1";
    const params = { key: GOOGLE_API_KEY, cx: CUSTOM_SEARCH_ENGINE_ID, q: query };
    try {
        const response = await axios.get(searchUrl, { params });
        let processedResults = [];
        if (response.data && response.data.items) {
            processedResults = response.data.items.map(item => ({
                title: item.title,
                link: item.link, // We still need the original link
                snippet: item.snippet,
                // Generate the proxy link for the frontend
                proxy_link: `/proxy?url=${encodeURIComponent(item.link || '')}`,
                image_url: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.metatags?.[0]?.['og:image'] || null
            }));
        }
        res.json(processedResults);
    } catch (error) {
        console.error('Google API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch search results' });
    }
});

// *** נתיב הפרוקסי החדש ***
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Missing url query parameter');
    }

    console.log(`Proxy attempt for: ${targetUrl}`);

    try {
        // Use axios to fetch the target URL's content
        const response = await axios.get(targetUrl, {
            responseType: 'text', // Get response as text to avoid buffer issues
            // Send minimal headers, avoid sending user's headers
            headers: {
                'User-Agent': 'RenderProxy/1.0' // Identify our proxy minimally
            },
            timeout: 10000 // 10 second timeout
        });

        // Get content type from the original response, default to text/html
        const contentType = response.headers['content-type'] || 'text/html';

        // **VERY IMPORTANT LIMITATION:**
        // We are NOT parsing or rewriting the HTML.
        // Relative links, CSS, JS, images WILL BE BROKEN on most sites.
        // This just sends the raw HTML back.

        res.set('Content-Type', contentType); // Set the correct content type
        res.send(response.data); // Send the raw HTML/text content

    } catch (error) {
        console.error(`Proxy Error for ${targetUrl}:`, error.message);
        if (error.response) {
            // If the target server responded with an error (e.g., 404)
            res.status(error.response.status).send(`Error fetching remote URL: ${error.response.statusText}`);
        } else if (error.request) {
            // If the request was made but no response received (e.g., timeout)
            res.status(504).send('Error: Could not reach remote server (Timeout or Network Issue)');
        } else {
            // Other errors
            res.status(500).send(`Proxy error: ${error.message}`);
        }
    }
});


// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
