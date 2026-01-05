require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

/* ------------------ MIDDLEWARE ------------------ */

// Allow all origins (safe for API-only backend)
app.use(cors());
app.use(express.json());

/* ------------------ CONFIG ------------------ */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY missing in environment variables");
}

/* ------------------ BULLETPROOF JSON CLEANER ------------------ */

function cleanJSON(text) {
    try {
        if (!text || typeof text !== "string") return [];

        console.log("🧠 Raw AI Output:\n", text);

        // Remove markdown wrappers
        let clean = text.replace(/```json|```/gi, '').trim();

        // Try extracting array first
        const arrStart = clean.indexOf('[');
        const arrEnd = clean.lastIndexOf(']');
        if (arrStart !== -1 && arrEnd !== -1) {
            return JSON.parse(clean.slice(arrStart, arrEnd + 1));
        }

        // Fallback to object
        const objStart = clean.indexOf('{');
        const objEnd = clean.lastIndexOf('}');
        if (objStart !== -1 && objEnd !== -1) {
            return JSON.parse(clean.slice(objStart, objEnd + 1));
        }

        return JSON.parse(clean);
    } catch (err) {
        console.error("❌ JSON Clean Error:", err.message);
        return [];
    }
}

/* ------------------ ROUTE 1: SMART SEARCH ------------------ */

app.post('/api/smart-search', async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ error: "Missing Groq API Key" });
        }

        const { refTitle, userPrompt, type, exclude = [] } = req.body;
        const excludeString = exclude.length
            ? `Exclude these titles: ${exclude.join(', ')}`
            : '';

        const payload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `
You are a professional film curator.
Recommend EXACTLY 12 ${type === 'tv' ? 'TV series' : 'movies'}.

STRICT RULES:
- Output ONLY a raw JSON array
- No explanations
- No markdown
- No extra text

Format:
[
  { "title": "Exact Title", "reason": "Short punchy reason", "score": 0-100 }
]

${excludeString}
                    `.trim()
                },
                {
                    role: "user",
                    content: `Reference: "${refTitle}". User note: "${userPrompt}".`
                }
            ],
            temperature: 0.6
        };

        const response = await axios.post(GROQ_URL, payload, {
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            timeout: 20000
        });

        const raw = response.data?.choices?.[0]?.message?.content || "";
        const data = cleanJSON(raw);

        res.json(Array.isArray(data) ? data : []);

    } catch (err) {
        console.error("❌ Smart Search Error:", err.response?.data || err.message);
        res.json([]);
    }
});

/* ------------------ ROUTE 2: INTEL BRIEF ------------------ */

app.post('/api/intel-brief', async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ error: "Missing Groq API Key" });
        }

        const { title, type } = req.body;

        const payload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `
You are a film analyst.

STRICT RULES:
- Output ONLY raw JSON
- No markdown
- No intro text

Format:
{
  "plot_twist": "Spoiler summary",
  "cultural_impact": "Why it mattered",
  "budget_est": "$X",
  "revenue_est": "$X",
  "status_verdict": "Hit / Flop / Cult",
  "tagline_ai": "Catchy tagline"
}
                    `.trim()
                },
                {
                    role: "user",
                    content: `Analyze "${title}" (${type}).`
                }
            ],
            temperature: 0.3
        };

        const response = await axios.post(GROQ_URL, payload, {
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            timeout: 20000
        });

        const raw = response.data?.choices?.[0]?.message?.content || "{}";
        const data = cleanJSON(raw);

        res.json(typeof data === "object" && data !== null ? data : {});

    } catch (err) {
        console.error("❌ Intel Brief Error:", err.response?.data || err.message);
        res.json({ tagline_ai: "Analysis unavailable" });
    }
});

/* ------------------ SERVER START ------------------ */

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Groq server running on port ${PORT}`);
    });
}

module.exports = app;
