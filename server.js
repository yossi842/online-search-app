require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CUSTOM_SEARCH_ENGINE_ID = process.env.CUSTOM_SEARCH_ENGINE_ID;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query parameter q is required' });
    if (!GOOGLE_API_KEY || !CUSTOM_SEARCH_ENGINE_ID) {
        console.error("API Key or Search Engine ID missing in environment variables!");
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
                link: item.link,
                snippet: item.snippet,
                image_url: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.metatags?.[0]?.['og:image'] || null
            }));
        }
        res.json(processedResults);
    } catch (error) {
        console.error('Google API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch results from Google' });
    }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
