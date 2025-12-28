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
        
        // --- PROMPT LOGIC BASED ON BUTTON CLICKED ---
        let specificInstruction = "";
        
        if (mode === 'suggestion') {
            specificInstruction = `
            IGNORE the user's requested ${days} days. 
            Instead, calculate the PERFECT duration for this trip and plan for that number of days. 
            Tell the user why you chose this duration in the summary.`;
        } else if (mode === 'alternate') {
            specificInstruction = `
            Plan a DIFFERENT route than the standard one. 
            Try to use different stopover cities (e.g. if standard is via Varanasi, go via Lucknow or Jaipur instead). 
            Keep the duration to ${days} days.`;
        } else {
            specificInstruction = `Plan exactly for ${days} days.`;
        }

        const prompt = `
            Act as a Senior Indian Railways & Flight Logistics Expert. 
            Plan a trip from ${origin} to ${destination}.
            Mode: ${transport}. Budget: ${budget}.
            
            INSTRUCTIONS:
            ${specificInstruction}

            STRICT RULES:
            1. TIMES: You MUST include specific departure/arrival times for trains/flights (e.g. "06:00 AM").
            2. REALISM: Use real train numbers (e.g. 12301 Rajdhani) and realistic prices in Rupees (₹).
            3. LOGIC: Ensure the route is geographically linear.
            4. IMAGES: Single keyword for photos.
            5. FORMAT: JSON ONLY.

            OUTPUT JSON STRUCTURE:
            {
                "cost": "₹ Total",
                "sum": "Summary explanation",
                "itin": [
                    { 
                        "d": 1, 
                        "loc": "City Name", 
                        "act": [ 
                            { "t": "09:00 AM", "a": "Activity/Transport Details", "p": "₹500", "i": "Keyword" } 
                        ] 
                    }
                ]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "meta-llama/llama-3.3-70b-instruct:free",
            temperature: 0.2,
            max_tokens: 2500
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
