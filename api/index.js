require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/plan-trip', async (req, res) => {
    try {
        if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: { "HTTP-Referer": "https://travel-planner.vercel.app", "X-Title": "AI Travel Planner" }
        });

        const { origin, destination, days, budget, transport, mode } = req.body;
        
        // --- BUTTON LOGIC ---
        let specificInstruction = "";
        if (mode === 'suggestion') {
            specificInstruction = `IGNORE user's ${days} days. Calculate the PERFECT duration.`;
        } else if (mode === 'alternate') {
            specificInstruction = `Plan a DIFFERENT route than standard. Use alternative stopovers.`;
        } else {
            specificInstruction = `Plan exactly for ${days} days.`;
        }

        const prompt = `
            Act as a Senior Travel Expert. Plan a trip from ${origin} to ${destination}.
            Mode: ${transport}. Budget: ${budget}.
            
            INSTRUCTIONS:
            ${specificInstruction}

            STRICT RULES:
            1. TIMES: Include specific times (e.g. "06:00 AM").
            2. REALISM: Use real train numbers (e.g. 12301) and prices (₹).
            3. LOGIC: Geographic linear route.
            4. EXTRAS: For every major city visited, list 2 "Most Popular" spots and 2 "Underrated/Hidden" gems.
            5. FORMAT: JSON ONLY.

            OUTPUT JSON STRUCTURE:
            {
                "cost": "₹ Total",
                "sum": "Summary",
                "itin": [
                    { 
                        "d": 1, 
                        "loc": "City Name", 
                        "act": [ 
                            { "t": "09:00 AM", "a": "Activity", "p": "₹500", "i": "Keyword" } 
                        ] 
                    }
                ],
                "extras": [
                    {
                        "city": "City Name",
                        "pop": ["Taj Mahal", "Agra Fort"],
                        "hidden": ["Mehtab Bagh (Sunset view)", "Sheroes Hangout Cafe"]
                    }
                ]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "meta-llama/llama-3.3-70b-instruct:free",
            temperature: 0.2,
            max_tokens: 3000
        });

        let raw = completion.choices[0]?.message?.content || "";
        const jsonStart = raw.indexOf('{');
        const jsonEnd = raw.lastIndexOf('}');
        
        if (jsonStart === -1) throw new Error("AI failed to generate plan.");
        
        res.json(JSON.parse(raw.substring(jsonStart, jsonEnd + 1)));

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message || "Failed to plan." });
    }
});

module.exports = app;
