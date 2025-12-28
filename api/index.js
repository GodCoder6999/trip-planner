require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/plan-trip', async (req, res) => {
    try {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error("Missing OPENROUTER_API_KEY in Vercel Environment Variables");
        }

        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                "HTTP-Referer": "https://travel-planner.vercel.app",
                "X-Title": "AI Travel Planner",
            }
        });

        const { origin, destination, days, budget, transport, currency } = req.body;
        
        // Use the Free Tier Model
        const modelName = "meta-llama/llama-3.3-70b-instruct:free";

        const prompt = `
            Task: Logistics Plan. ${days} days. ${origin} to ${destination}.
            Mode: ${transport}. Budget: ${budget} ${currency}.
            
            RULES:
            1. GEOGRAPHY: Linear route. No detours.
            2. REALITY: Ocean = Flight.
            3. DETAILS: Specific Train/Flight Nos.
            4. FORMAT: Minified JSON. Keys: d, loc, act(t, a, p, i).
            5. IMPORTANT: Output ONLY JSON. Do not write "Here is the plan".

            EXAMPLE OUTPUT:
            {
                "cost": "₹15k",
                "sum": "Direct route.",
                "itin": [
                    { "d": 1, "loc": "Kolkata", "act": [ { "t": "08:00", "a": "Train 12301", "p": "₹3000", "i": "Train" } ] }
                ]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: modelName,
            temperature: 0.1,
            max_tokens: 1000
        });

        let rawContent = completion.choices[0]?.message?.content || "";

        // --- THE FIX: SMART JSON EXTRACTION ---
        // This finds the first '{' and the last '}' to ignore any text before or after
        const jsonStartIndex = rawContent.indexOf('{');
        const jsonEndIndex = rawContent.lastIndexOf('}');

        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            throw new Error("AI did not return valid JSON. It returned: " + rawContent.substring(0, 50) + "...");
        }

        const cleanJson = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
        // --------------------------------------
        
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Server Error:", error);
        const errorMessage = error.response?.data?.error?.message || error.message;
        res.status(500).json({ error: `OpenRouter Error: ${errorMessage}` });
    }
});

module.exports = app;
