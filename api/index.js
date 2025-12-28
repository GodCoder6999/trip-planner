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
            Act as a senior travel logistics manager. Plan a ${days}-day trip from "${origin}" to "${destination}".
            
            STRICT REQUIREMENTS:
            1. REALISM: You MUST provide specific transport names. 
               - If Flight: Use format "IndiGo 6E-204" or "Air India AI-405".
               - If Train: Use format "Vande Bharat Exp (22436)" or "Rajdhani Exp (12301)".
            2. COSTS: Every single activity and transport must have a specific price in ${currency}.
            3. TOTAL COST: Calculate a realistic total at the end.
            4. RETURN TRIP: The final day must include the return journey to ${origin} with specific transport details.

            Return ONLY raw JSON matching this structure:
            {
                "total_cost": "₹45,000",
                "trip_summary": "A 5-day cultural immersion...",
                "itinerary": [
                    {
                        "day": 1,
                        "location": "Origin -> City",
                        "theme": "Travel & Check-in",
                        "activities": [
                            { "time": "08:00 AM", "activity": "Depart via [Transport Name]", "price": "₹1,200", "icon": "✈️/🚆" },
                            { "time": "02:00 PM", "activity": "Check-in at [Hotel Area]", "price": "₹0", "icon": "🏨" }
                        ]
                    }
                ]
            }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant",
            temperature: 0.2
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to generate plan. Please try again." });
    }
});

module.exports = app;
