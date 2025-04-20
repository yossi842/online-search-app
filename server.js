// טעינת משתני סביבה (Render יספק אותם, לא מקובץ .env)
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
// קביעת הפורט ממשתנה סביבתי ש-Render יספק
const port = process.env.PORT || 3000; // Render ישתמש ב-PORT

// קבלת מפתח API ומזהה מנוע חיפוש ממשתני סביבה
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CUSTOM_SEARCH_ENGINE_ID = process.env.CUSTOM_SEARCH_ENGINE_ID;

// הגדרת התיקייה 'public' כתיקייה שממנה יוגשו קבצים סטטיים
app.use(express.static(path.join(__dirname, 'public')));

// נתיב לטיפול בבקשות חיפוש
app.get('/search', async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: 'נא לספק שאילתת חיפוש (פרמטר q)' });
    }

    // בדיקה חשובה שהמפתחות הוגדרו ב-Render
    if (!GOOGLE_API_KEY || !CUSTOM_SEARCH_ENGINE_ID) {
        console.error("FATAL ERROR: API Key or Search Engine ID not configured in Render environment variables.");
        return res.status(500).json({ error: 'Server configuration error: API Key or Search Engine ID missing.' });
    }

    const searchUrl = "https://www.googleapis.com/customsearch/v1";
    const params = {
        key: GOOGLE_API_KEY,
        cx: CUSTOM_SEARCH_ENGINE_ID,
        q: query,
    };

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
        console.error('Error calling Google API:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: `Failed to fetch results from Google API: ${error.message}` });
    }
});

// נתיב ברירת מחדל שמגיש את קובץ ה-HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// הפעלת השרת
app.listen(port, () => {
    // אין צורך לציין localhost כאן, Render דואג לזה
    console.log(`Server listening on port ${port}`);
});
