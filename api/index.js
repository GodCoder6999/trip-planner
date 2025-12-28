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
        // 1. GEOGRAPHY GUARD (Prevent Ocean Trains)
        let safeTransport = transport;
        const overseasKeywords = ["New York", "USA", "UK", "Europe", "Canada", "London", "Australia"];
        if (overseasKeywords.some(k => destination.includes(k) || origin.includes(k))) {
            safeTransport = "Flight";
        }

        const prompt = `
            You are an expert Travel Agent. Plan a ${days}-day trip from ${origin} to ${destination}.
            
            CRITICAL RULES (Use your High Intelligence):
            1. GEOGRAPHIC LOGIC: You MUST reorder cities to form a straight line. 
               - BAD Route: Kolkata -> New Jalpaiguri -> Delhi (This is a detour).
               - GOOD Route: Kolkata -> Varanasi -> Prayagraj -> Delhi (This is the main line).
            2. REAL TRAINS ONLY: Use real trains like "Rajdhani (12301)", "Poorva Exp", "Vande Bharat". 
            3. MODE: ${safeTransport}. (If Ocean involved, force Flight).
            4. SPEED: Return JSON only. Keep descriptions to 3-5 words max.

            USER INPUT:
            - Budget: ${budget} ${currency}
            - Mode: ${safeTransport}

            OUTPUT SCHEMA (JSON ONLY):
            {
                "total_cost": "Est Total (e.g. ₹15,000)",
                "trip_summary": "Direct route via Main Line.",
                "suggestion": { "is_perfect": true, "text": "Good plan." },
                "itinerary": [
                    {
                        "day": 1,
                        "location": "City",
                        "theme": "Travel",
                        "activities": [
                            { "time": "16:00", "activity": "Train Name & No", "price": "₹Cost", "icon": "🚆" }
                        ]
                    }
                ]
            }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            // SWITCHING TO THE BEST MODEL
            model: "llama-3.3-70b-versatile", 
            temperature: 0.2,
            max_tokens: 1024 // Limit output length to prevent Vercel Timeout
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "High-IQ Model timed out. Try reducing days to 5." });
    }
});

module.exports = app;
