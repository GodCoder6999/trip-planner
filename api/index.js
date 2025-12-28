require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/plan-trip', async (req, res) => {
    try {
        // 1. Check API Key immediately
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY is missing in Vercel Environment Variables!");
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const { origin, destination, days, budget, transport, currency } = req.body;

        // 2. Construct Prompt
        const prompt = `
            Plan a ${days}-day trip from ${origin} to ${destination}.
            Budget: ${budget} (${currency}). Transport: ${transport}.
            Return JSON matching this schema:
            {
                "total_cost": "Total estimated cost",
                "itinerary": [
                    { "day": 1, "location": "City", "theme": "Theme", "activities": [{ "time": "Morning", "activity": "Activity", "cost": "Cost" }] }
                ]
            }
        `;

        // 3. Call AI
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt + " Return ONLY raw JSON." }],
            model: "llama-3.1-8b-instant",
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        // ERROR REVEALER: This sends the real error message to your screen
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;
