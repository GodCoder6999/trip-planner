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
        // 1. Geography Check (Simple Logic)
        // If "New York" or "London" or "USA" is in the text, and origin is in India, force Flight.
        let safeTransport = transport;
        const overseasKeywords = ["New York", "London", "USA", "UK", "Europe", "Australia", "Canada"];
        const isOverseas = overseasKeywords.some(k => destination.includes(k) || origin.includes(k));
        
        if (isOverseas && transport.includes("Train")) {
            safeTransport = "Flight (Geography Override)";
        }

        const prompt = `
            Plan a ${days}-day trip from ${origin} to ${destination}.
            
            RULES:
            1. MODE: ${safeTransport}. (If changed to Flight, explain why in summary).
            2. REALISM: Use REAL transport names (e.g. "IndiGo 6E-505", "Shatabdi Exp"). 
               - DO NOT invent "Sealdah to New York Express". That is impossible.
            3. MATH: Estimate specific costs in ${currency}. 
            4. SPEED: Keep descriptions short (max 10 words).

            OUTPUT JSON ONLY:
            {
                "total_cost": "₹75,000",
                "trip_summary": "Due to the ocean, we switched to flight...",
                "suggestion": { "is_perfect": true, "text": "Good duration." },
                "itinerary": [
                    {
                        "day": 1,
                        "location": "City",
                        "theme": "Travel",
                        "activities": [
                            { "time": "09:00", "activity": "Flight XX123", "price": "₹5000", "icon": "✈️" }
                        ]
                    }
                ]
            }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant", // Back to speed model
            temperature: 0.1,
            max_tokens: 1500
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Server Error:", error);
        // This will show the REAL error on your screen
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;
