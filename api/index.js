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
        // GEOGRAPHY GUARD
        let safeTransport = transport;
        const overseasKeywords = ["New York", "USA", "UK", "Europe", "Canada", "London", "Australia", "Dubai"];
        if (overseasKeywords.some(k => destination.includes(k) || origin.includes(k))) {
            safeTransport = "Flight";
        }

        const prompt = `
            You are a Luxury Travel Concierge. Plan a ${days}-day trip from ${origin} to ${destination}.
            
            RULES FOR "HIGH DETAIL":
            1. RICH DESCRIPTIONS: Do NOT say "City Tour". Say "Explore the ancient lanes of Varanasi and Kashi Vishwanath Temple".
            2. FOOD & GEMS: Include specific famous food spots (e.g. "Blue Tokai Cafe", "Kareem's") or hidden gems.
            3. LOGICAL ROUTE: Arrange cities geographically. (No detours).
            4. IMAGES: For every activity, provide a short 2-3 word search term for a photo (e.g. "Varanasi Ghats", "Vande Bharat Train").

            OUTPUT SCHEMA (JSON ONLY):
            {
                "total_cost": "₹45,000",
                "trip_summary": "A cultural immersion journey...",
                "itinerary": [
                    {
                        "day": 1,
                        "location": "City Name",
                        "theme": "Theme of the Day",
                        "activities": [
                            { 
                                "time": "09:00 AM", 
                                "activity": "Detailed Description of activity", 
                                "price": "₹500", 
                                "icon": "📍",
                                "img_key": "Search Term" 
                            }
                        ]
                    }
                ]
            }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile", // The Smartest Model
            temperature: 0.2,
            max_tokens: 1600
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Trip too detailed for free tier. Try 5-7 days." });
    }
});

module.exports = app;
