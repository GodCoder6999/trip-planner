require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai'); // standard OpenAI library

const app = express();
app.use(cors());
app.use(express.json());

// CONNECT TO OPENROUTER
const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY, // New Environment Variable
    defaultHeaders: {
        "HTTP-Referer": "https://travel-planner.vercel.app", // Optional: Your site URL
        "X-Title": "AI Travel Planner", // Optional: Your site name
    }
});

app.post('/api/plan-trip', async (req, res) => {
    const { origin, destination, days, budget, transport, currency } = req.body;

    try {
        // 1. SMART MODEL: Llama 3.3 70B (The Genius Model)
        const modelName = "meta-llama/llama-3.3-70b-instruct";

        // 2. THE "GOD MODE" PROMPT (Compressed for Speed + IQ)
        const prompt = `
            Task: Logistics Plan. ${days} days. ${origin} to ${destination}.
            Mode: ${transport}. Budget: ${budget} ${currency}.
            
            CRITICAL RULES (Use your 70B Intelligence):
            1. GEOGRAPHY: Reorder cities into a PERFECT LINEAR ROUTE. (e.g. Kolkata -> Varanasi -> Delhi). No detours.
            2. REALITY: If ocean exists between cities, switch to Flight immediately.
            3. DETAILS: Use REAL Train/Flight Numbers (e.g. "12301 Rajdhani", "IndiGo 6E-554").
            4. FORMAT: Minified JSON. Keys: d(day), loc(location), act(activities array -> t(time), a(activity), p(price), i(img_keyword)).

            EXAMPLE OUTPUT:
            {
                "cost": "₹15k",
                "sum": "Direct route via Rajdhani.",
                "itin": [
                    { "d": 1, "loc": "Kolkata", "act": [ { "t": "08:00", "a": "Dep Howrah via 12301 Rajdhani", "p": "₹3000", "i": "Indian Train" } ] }
                ]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: modelName,
            temperature: 0.1,
            max_tokens: 1200
        });

        const rawContent = completion.choices[0]?.message?.content || "";
        const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("OpenRouter Error:", error);
        res.status(500).json({ error: "AI Service busy. Please try again." });
    }
});

module.exports = app;
