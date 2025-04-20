require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // Load cheerio library
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// We keep these variables but they are NOT used for the search anymore
// const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// const CUSTOM_SEARCH_ENGINE_ID = process.env.CUSTOM_SEARCH_ENGINE_ID;

app.use(express.static(path.join(__dirname, 'public')));

// *** Search route now uses SCRAPING (EXPERIMENTAL - VERY LIKELY TO BREAK) ***
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }

    // Construct Google search URL
    // Using hl=iw to request Hebrew results, num=20 for more results
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=iw&num=20`;
    console.log(`Attempting to scrape: ${googleSearchUrl}`);

    try {
        // Make request pretending to be a browser
        const response = await axios.get(googleSearchUrl, {
            headers: {
                // **Crucial: Mimic a real browser's User-Agent**
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9,he;q=0.8', // Request English/Hebrew
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
            },
            timeout: 10000 // 10 second timeout
        });

        // Load the HTML content into cheerio
        const $ = cheerio.load(response.data);

        // **WARNING: Google HTML structure changes constantly!**
        // These selectors WILL break without warning. This is just an example attempt.
        const results = [];
        // Try to find result containers (this selector is highly likely to change)
        $('div.g').each((index, element) => { // Using a common but unstable selector 'div.g'
            const resultElement = $(element);

            // Try to find title and link within the container
            // Look for an h3 tag, then find the first link inside or nearby
            const titleElement = resultElement.find('h3').first();
            const title = titleElement.text();
            const linkElement = resultElement.find('a').first(); // Often the link wraps the title or is nearby
            let link = linkElement.attr('href');

            // Clean up the link (Google sometimes uses redirect URLs like /url?q=...)
            if (link && link.startsWith('/url?q=')) {
                const urlParams = new URLSearchParams(link.split('?')[1]);
                link = urlParams.get('q');
            }

            // Try to find the snippet (this selector is EXTREMELY likely to change)
            // This might involve complex nested spans or divs
            const snippet = resultElement.find('div.VwiC3b, span.aCOpRe span').text(); // Example of complex, likely-to-break selectors

            if (title && link) {
                results.push({
                    title: title,
                    link: link,
                    snippet: snippet || "לא נמצא תקציר.", // Provide default if snippet selector fails
                    // No image URL extraction in this basic example
                });
            }
        });

        if (results.length === 0) {
            // Could be no results, OR more likely, Google blocked us or changed HTML structure
            console.warn("No results extracted. Google might have blocked the request or changed its HTML structure.");
            // Check if it looks like a CAPTCHA page
             if (response.data.includes('CAPTCHA') || response.data.includes('unusual traffic')) {
                 return res.status(429).json({ error: 'Blocked by Google (CAPTCHA or unusual traffic detected). Scraping failed.' });
             }
        }

        console.log(`Extracted ${results.length} results (via scraping).`);
        res.json(results); // Send whatever was extracted (might be empty)

    } catch (error) {
        console.error('Scraping Error:', error.message);
         if (error.response && (error.response.status === 429 || error.response.status === 503)) {
             // 429 Too Many Requests, 503 Service Unavailable are common for blocks
             console.error("Google responded with status:", error.response.status);
             return res.status(429).json({ error: `Scraping blocked by Google (Status: ${error.response.status}).` });
         }
         if (error.code === 'ECONNABORTED') {
              return res.status(504).json({ error: 'Timeout while trying to scrape Google.' });
         }
        res.status(500).json({ error: `Failed to scrape Google: ${error.message}` });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
