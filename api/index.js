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
        const prompt = `
            You are a Travel Logistics Engine.
            Task: Plan a ${days}-day trip from ${origin} to ${destination}.
            
            CRITICAL RULES:
            1. REALITY CHECK: If there is an ocean between cities (e.g. Kolkata to New York), you MUST use a Flight, even if the user asked for Train.
            2. NO HALLUCINATIONS: Do not invent fake trains like "Sealdah to New York". Use real flights (e.g., Emirates, Air India, Qatar Airways).
            3. PRICING: You must Estimate real-world prices in ${currency}. Do NOT just copy numbers.
            4. TOTAL COST: Sum up all the daily costs to provide an accurate total.

            USER INPUT:
            - Budget: ${budget}
            - Mode Preference: ${transport}

            OUTPUT SCHEMA (Return strictly this JSON):
            {
                "total_cost": "Sum of all costs below (e.g. ₹1,50,000)",
                "trip_summary": "Explain the route and transport choices.",
                "suggestion": { "is_perfect": true, "text": "Duration advice." },
                "itinerary": [
                    {
                        "day": 1,
                        "location": "City Name",
                        "theme": "Travel Phase",
                        "activities": [
                            { "time": "09:00 AM", "activity": "Specific flight/train details", "price": "Real Cost", "icon": "✈️" },
                            { "time": "02:00 PM", "activity": "Activity description", "price": "Real Cost", "icon": "📍" }
                        ]
                    }
                ]
            }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            // UPGRADED MODEL: Smarter, better at math and geography
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            max_tokens: 3000
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Planning failed. Try a shorter trip duration." });
    }
});

module.exports = app;
