require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Allow all origins (Fixes CORS issues)
app.use(cors({ origin: '*' }));
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const GROQ_URL = "[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)";

// 2. BULLETPROOF JSON CLEANER (Fixes the "Vanish" bug)
function cleanJSON(text) {
    try {
        console.log("Raw AI Output:", text); // Debugging log
        // Remove markdown wrappers like ```json ... ```
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Find the start and end of the JSON structure
        const firstSquare = clean.indexOf('[');
        const lastSquare = clean.lastIndexOf(']');
        const firstCurly = clean.indexOf('{');
        const lastCurly = clean.lastIndexOf('}');
        
        // Prioritize Arrays (for lists of movies)
        if (firstSquare !== -1 && lastSquare !== -1) {
            return JSON.parse(clean.substring(firstSquare, lastSquare + 1));
        }
        // Fallback to Objects (for single movie details)
        if (firstCurly !== -1 && lastCurly !== -1) {
            return JSON.parse(clean.substring(firstCurly, lastCurly + 1));
        }
        // Final attempt
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Clean Error:", e.message);
        return []; // Returns empty array instead of crashing server
    }
}

// --- ROUTE 1: SMART SEARCH (Curate/Dream) ---
app.post('/api/smart-search', async (req, res) => {
    try {
        if (!GROQ_API_KEY) return res.status(500).json({ error: "Missing Groq Key" });

        const { refTitle, userPrompt, type, exclude = [] } = req.body;
        
        const excludeString = exclude.length > 0 ? `Excluding: ${exclude.join(', ')}` : '';

        const payload = {
            model: "llama-3.3-70b-versatile", // High quality model
            messages: [
                {
                    role: "system",
                    content: `You are a film curator. Recommend 12 ${type === 'tv' ? 'Series' : 'Movies'}. 
                    STRICT INSTRUCTION: Output ONLY a raw JSON Array. Do not write intro text. Do not use Markdown blocks.
                    Format: [ { "title": "Exact Title", "reason": "Short punchy reason", "score": 85 } ]
                    ${excludeString}`
                },
                { role: "user", content: `Ref: "${refTitle}". Note: "${userPrompt}".` }
            ],
            temperature: 0.6
        };

        const response = await axios.post(GROQ_URL, payload, { 
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}` } 
        });

        const data = cleanJSON(response.data.choices[0].message.content);
        res.json(data);

    } catch (error) {
        console.error("Groq Error:", error.response?.data || error.message);
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
                    content: `You are a film archivist. Output ONLY raw JSON. No Markdown.
                    Format: { "plot_twist": "Spoiler", "cultural_impact": "Impact", "budget_est": "$X", "revenue_est": "$X", "status_verdict": "Hit/Flop/Cult", "tagline_ai": "Fun tagline" }`
                },
                { role: "user", content: `Analyze: "${title}" (${type})` }
            ],
            temperature: 0.3
        };

        const response = await axios.post(GROQ_URL, payload, { 
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}` } 
        });

        const data = cleanJSON(response.data.choices[0].message.content);
        res.json(data);

    } catch (error) {
        console.error("Intel Error:", error.message);
        res.json({ tagline_ai: "Analysis Unavailable" });
    }
});

// Start Server (For Local Testing)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Groq Server running on port ${PORT}`));
}

module.exports = app;
