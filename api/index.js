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

        const { origin, destination, days, budget, transport, currency } = req.body;
        
        const prompt = `
            Act as a Senior Indian Railways Logistics Expert. Plan a ${days}-DAY trip from ${origin} to ${destination}.
            Mode: ${transport}. Budget: ${budget} ${currency}.

            STRICT RULES:
            1. RAILWAY ACCURACY: You MUST use real, existing train numbers.
               - PREFER: Rajdhani (12301/12302), Shatabdi (12003/12004), Vande Bharat, Poorva Exp (12303).
               - DO NOT invent trains. If unsure, use the most famous connection between these cities.
            2. ROUTE LOGIC: Linear direction only. No zig-zagging.
            3. DAY SEQUENCE: Output exactly Day 1 to Day ${days}.
            4. IMAGES: Single word keyword for photos (e.g. "Train", "Ghats", "Fort").
            5. FORMAT: JSON ONLY.

            OUTPUT JSON:
            {
                "cost": "Total Cost",
                "sum": "Summary of route",
                "itin": [
                    { "d": 1, "loc": "City", "act": [ { "t": "09:00", "a": "Train 12301 Rajdhani Exp (Dep Howrah)", "p": "₹3000", "i": "Train" } ] }
                ]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "meta-llama/llama-3.3-70b-instruct:free",
            temperature: 0.1,
            max_tokens: 2000
        });

        let raw = completion.choices[0]?.message?.content || "";
        const jsonStart = raw.indexOf('{');
        const jsonEnd = raw.lastIndexOf('}');
        if (jsonStart === -1) throw new Error("AI Error");
        
        res.json(JSON.parse(raw.substring(jsonStart, jsonEnd + 1)));

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to plan. Please try again." });
    }
});

module.exports = app;
