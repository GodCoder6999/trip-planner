require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/plan-trip', async (req, res) => {
    const { origin, destination, days, budget, transport, currency } = req.body;

    try {
        // 1. HARDCODED GEOGRAPHY CHECK (Saves AI brain power)
        let safeTransport = transport;
        const overseasKeywords = ["USA", "UK", "Europe", "Canada", "Australia", "New York", "London", "Dubai"];
        if (overseasKeywords.some(k => destination.includes(k) || origin.includes(k))) {
            safeTransport = "Flight";
        }

        // 2. THE "GOD MODE" PROMPT (Ultra-Compressed)
        const prompt = `
            Task: Logistics Plan. ${days} days. ${origin} to ${destination}.
            Mode: ${safeTransport}. Budget: ${budget} ${currency}.
            
            STRICT RULES:
            1. GEOGRAPHY: Reorder cities linearly. No detours.
            2. TRANSPORT: Must include specific Train/Flight No (e.g. "12301 Rajdhani", "6E-505").
            3. BREVITY: Max 4 words per activity.
            4. FORMAT: Minified JSON. Use keys: d(day), loc(location), act(activities array -> t(time), a(activity), p(price), i(img_keyword)).

            EXAMPLE OUTPUT:
            {
                "cost": "₹15k",
                "sum": "Direct route via Rajdhani.",
                "itin": [
                    { "d": 1, "loc": "Kolkata", "act": [ { "t": "08:00", "a": "Dep Howrah via 12301 Rajdhani", "p": "₹3000", "i": "Indian Train" } ] }
                ]
            }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant", // Speed Model
            temperature: 0.1,
            max_tokens: 1800 
        });

        const rawContent = chatCompletion.choices[0]?.message?.content || "";
        const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Optimization failed. Try 7 days." });
    }
});

module.exports = app;
