require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Enable CORS for all
app.use(cors({ origin: '*' }));
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; 
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// 2. Helper: Clean JSON from AI response (Removes Markdown)
function cleanJSON(text) {
    try {
        console.log("Raw AI Output:", text); // Debug log
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const firstSquare = clean.indexOf('[');
        const lastSquare = clean.lastIndexOf(']');
        const firstCurly = clean.indexOf('{');
        const lastCurly = clean.lastIndexOf('}');
        
        // Prioritize Arrays
        if (firstSquare !== -1 && lastSquare !== -1) {
            return JSON.parse(clean.substring(firstSquare, lastSquare + 1));
        }
        // Fallback to Objects
        if (firstCurly !== -1 && lastCurly !== -1) {
            return JSON.parse(clean.substring(firstCurly, lastCurly + 1));
        }
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Clean Error:", e.message);
        return []; 
    }
}

// --- ROUTE 1: SMART SEARCH (Curate/Dream) ---
app.post('/api/smart-search', async (req, res) => {
    try {
        if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing OpenRouter Key" });

        const { refTitle, userPrompt, type, exclude = [] } = req.body;
        
        // 3. OpenRouter Payload
        const payload = {
            // "meta-llama/llama-3.3-70b-instruct" is the OpenRouter ID for the Llama 3.3 70B model
            model: "meta-llama/llama-3.3-70b-instruct", 
            messages: [
                {
                    role: "system",
                    content: `You are a film curator. Recommend 12 ${type === 'tv' ? 'Series' : 'Movies'} based on: "${userPrompt}" (Ref: ${refTitle}).
                    Do NOT recommend: ${exclude.join(', ')}.
                    STRICT INSTRUCTION: Output ONLY a raw JSON Array. No Markdown. No intro text.
                    Example: [ { "title": "Name", "reason": "Why it fits", "score": 90 } ]`
                },
                { role: "user", content: "Generate recommendations now." }
            ],
            temperature: 0.7, // Higher creativity for curation
            // Optional headers for OpenRouter ranking
            provider: {
                allow_fallbacks: true
            }
        };

        const response = await axios.post(OPENROUTER_URL, payload, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://cinegenius.vercel.app", // Optional: Your site URL
                "X-Title": "CineGenius" // Optional: Your App Name
            }
        });

        // OpenRouter follows OpenAI format, so content is here:
        const rawText = response.data.choices[0].message.content;
        const data = cleanJSON(rawText);
        res.json(data);

    } catch (error) {
        console.error("OpenRouter Error:", error.response?.data || error.message);
        res.json([]); 
    }
});

// --- ROUTE 2: INTEL BRIEF ---
app.post('/api/intel-brief', async (req, res) => {
    try {
        if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing Key" });

        const { title, type } = req.body;
        
        const payload = {
            model: "meta-llama/llama-3.3-70b-instruct",
            messages: [
                {
                    role: "system",
                    content: `Analyze "${title}" (${type}). Return ONE JSON object. No Markdown.
                    Format: { "plot_twist": "Spoiler", "cultural_impact": "Impact", "budget_est": "$X", "revenue_est": "$X", "status_verdict": "Hit/Flop", "tagline_ai": "Fun tagline" }`
                }
            ],
            temperature: 0.3 // Lower temp for facts
        };

        const response = await axios.post(OPENROUTER_URL, payload, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://cinegenius.vercel.app",
                "X-Title": "CineGenius"
            }
        });

        const rawText = response.data.choices[0].message.content;
        const data = cleanJSON(rawText);
        res.json(data);

    } catch (error) {
        console.error("Intel Error:", error.message);
        res.json({ tagline_ai: "Analysis Failed" });
    }
});

// Local Dev
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

module.exports = app;
