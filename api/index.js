require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Enable CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// 2. BULLETPROOF JSON CLEANER
function cleanJSON(text) {
    try {
        console.log("Raw AI Output:", text);
        // Remove markdown
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        // Find array brackets
        const firstSquare = clean.indexOf('[');
        const lastSquare = clean.lastIndexOf(']');
        const firstCurly = clean.indexOf('{');
        const lastCurly = clean.lastIndexOf('}');
        
        if (firstSquare !== -1 && lastSquare !== -1) {
            return JSON.parse(clean.substring(firstSquare, lastSquare + 1));
        }
        if (firstCurly !== -1 && lastCurly !== -1) {
            return JSON.parse(clean.substring(firstCurly, lastCurly + 1));
        }
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Clean Error:", e.message);
        return []; 
    }
}

// --- ROUTE 1: SMART SEARCH (Optimized for Speed) ---
app.post('/api/smart-search', async (req, res) => {
    try {
        if (!GROQ_API_KEY) return res.status(500).json({ error: "Missing Groq Key" });

        const { refTitle, userPrompt, type, exclude = [] } = req.body;
        const excludeString = exclude.length > 0 ? `Excluding: ${exclude.join(', ')}` : '';

        const payload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a film curator. Recommend 6 ${type === 'tv' ? 'Series' : 'Movies'}. 
                    STRICT INSTRUCTION: Return ONLY a raw JSON Array. No intro text. No Markdown.
                    Format: [ { "title": "Title", "reason": "Short reason", "score": 90 } ]
                    ${excludeString}`
                },
                { role: "user", content: `Ref: "${refTitle}". Note: "${userPrompt}".` }
            ],
            // Lower tokens slightly to ensure it finishes fast
            max_tokens: 1024,
            temperature: 0.6
        };

        const response = await axios.post(GROQ_URL, payload, { 
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}` } 
        });

        const data = cleanJSON(response.data.choices[0].message.content);
        res.json(data);

    } catch (error) {
        console.error("Groq API Error:", error.message);
        res.json([]); 
    }
});

// --- ROUTE 2: INTEL BRIEF ---
app.post('/api/intel-brief', async (req, res) => {
    try {
        if (!GROQ_API_KEY) return res.status(500).json({ error: "Missing Groq Key" });

        const { title, type } = req.body;
        
        const payload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `Analyze "${title}" (${type}). Return ONLY raw JSON. No Markdown.
                    Format: { "plot_twist": "Spoiler", "cultural_impact": "Impact", "budget_est": "$X", "revenue_est": "$X", "status_verdict": "Hit/Flop", "tagline_ai": "Tagline" }`
                }
            ],
            max_tokens: 500,
            temperature: 0.3
        };

        const response = await axios.post(GROQ_URL, payload, { 
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}` } 
        });

        const data = cleanJSON(response.data.choices[0].message.content);
        res.json(data);

    } catch (error) {
        console.error("Intel API Error:", error.message);
        res.json({ tagline_ai: "Analysis Unavailable" });
    }
});

// Start Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Groq Server running on port ${PORT}`));
}

module.exports = app;
