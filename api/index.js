require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Permissive CORS (Essential for Vercel/Frontend communication)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// 2. BULLETPROOF JSON PARSER (The Fix for "Vanish" bug)
// Llama 3.3 loves to wrap JSON in ```json ... ```. This function removes that.
function cleanJSON(text) {
    console.log("Raw AI Response:", text); // Logs to Vercel for debugging
    try {
        // Step A: Strip Markdown code blocks
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Step B: Find the actual JSON array or object
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

        // Final attempt: Parse as is
        return JSON.parse(clean);
    } catch (e) { 
        console.error("❌ JSON Parse Failed:", e.message);
        return []; // Return empty array to prevent frontend crash
    }
}

// --- ROUTE 1: SMART SEARCH (Curate/Dream) ---
app.post('/api/smart-search', async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            console.error("❌ Server Error: Missing GROQ_API_KEY");
            return res.status(500).json({ error: "Server Configuration Error" });
        }

        const { refTitle, userPrompt, type, exclude = [] } = req.body; 
        
        // Build exclusion string
        const excludeString = exclude.length > 0 
            ? `\n\nIMPORTANT: Do NOT recommend these specific titles: ${exclude.join(', ')}.` 
            : '';

        const payload = {
            model: "llama-3.3-70b-versatile", // The specific model you requested
            messages: [
                {
                    role: "system",
                    content: `You are a film curator. Recommend 12 ${type === 'tv' ? 'Series' : 'Movies'}. 
                    STRICT INSTRUCTION: Output ONLY a valid JSON Array. Do not write intro text. Do not use Markdown blocks.
                    Format: [ { "title": "Exact Title", "reason": "Short reason", "score": 85 } ]
                    ${excludeString}`
                },
                { role: "user", content: `Ref: "${refTitle}". User Note: "${userPrompt}".` }
            ],
            // Lower temperature makes the model follow format rules better
            temperature: 0.5 
        };

        const response = await axios.post(GROQ_URL, payload, { 
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}` } 
        });

        const data = cleanJSON(response.data.choices[0].message.content);
        res.json(data);

    } catch (error) {
        console.error("❌ API Route Error:", error.message);
        res.json([]); 
    }
});

// --- ROUTE 2: INTEL BRIEF ---
app.post('/api/intel-brief', async (req, res) => {
    try {
        const { title, type } = req.body;
        const payload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a film archivist. Output ONLY valid JSON. No Markdown.
                    Format: { "plot_twist": "...", "cultural_impact": "...", "budget_est": "...", "revenue_est": "...", "status_verdict": "Hit/Flop/Cult", "tagline_ai": "..." }`
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
        console.error("❌ Intel Error:", error.message);
        res.json({ plot_twist: "Data Redacted (Error)", tagline_ai: "System Offline" });
    }
});

// Start Server (For Local Testing)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Backend running locally on port ${PORT}`);
    });
}

module.exports = app;
