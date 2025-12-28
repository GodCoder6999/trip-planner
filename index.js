// api/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.post('/api/plan-trip', async (req, res) => {
    const { origin, destination, days, budget, transport, currency, type } = req.body;

    if (!origin || !destination) {
        return res.status(400).json({ error: 'Missing origin or destination' });
    }

    try {
        const details = `Budget: ${budget}. Transport: ${transport}. Currency: ${currency}.`;
        let userPrompt = type === 'single' 
            ? `Plan a ${days}-day trip to ${destination} from ${origin}. ${details}`
            : `Plan a ${days}-day multi-city trip. Start: ${origin}. Stops: ${destination}. Optimize route. ${details}`;

        const schema = {
            "total_cost": `Total approx cost in ${currency}`,
            "itinerary": [
                {
                    "day": 1,
                    "location": "City Name",
                    "theme": "Theme",
                    "activities": [
                        { "time": "Morning", "activity": "Activity", "cost": "Cost" },
                        { "time": "Afternoon", "activity": "Activity", "cost": "Cost" },
                        { "time": "Evening", "activity": "Activity", "cost": "Cost" }
                    ]
                }
            ]
        };

        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                { "role": "system", "content": `Return ONLY raw JSON. No markdown. Schema: ${JSON.stringify(schema)}` },
                { "role": "user", "content": userPrompt }
            ],
            "model": "llama-3.1-8b-instant",
            "temperature": 0.5,
            "max_tokens": 2048
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to generate plan." });
    }
});

module.exports = app;