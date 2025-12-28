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
        // 1. CREATE STRICT TRANSPORT RULES
        let transportRule = "";
        if (transport === "Train Only") {
            transportRule = "STRICTLY TRAIN ONLY. Do NOT suggest flights under any circumstances. If a train route is long, still use the train.";
        } else if (transport === "Flight Only") {
            transportRule = "STRICTLY FLIGHT ONLY. Do NOT suggest trains. Use flights for all inter-city travel.";
        } else {
            transportRule = "Mix of Flights and Trains based on efficiency and cost.";
        }

        const prompt = `
            Act as a senior travel logistics manager. Plan a ${days}-day trip from "${origin}" to "${destination}".
            
            RULES:
            1. TRANSPORT MODE: ${transportRule}
            2. REALISM: Use specific names (e.g., "Vande Bharat Exp", "IndiGo 6E-554").
            3. COSTS: specific price in ${currency} for every item.
            4. RETURN TRIP: Final day must include return to ${origin}.
            5. ADVICE: Analyze if ${days} days is enough. If not, suggest the IDEAL duration.

            Return ONLY raw JSON matching this structure:
            {
                "total_cost": "₹45,000",
                "trip_summary": "A fast-paced 5-day tour...",
                "suggestion": {
                    "is_perfect": false, 
                    "ideal_days": 7, 
                    "text": "For a relaxed experience covering all spots, we recommend 7 days." 
                },
                "itinerary": [
                    {
                        "day": 1,
                        "location": "Origin -> City",
                        "theme": "Travel",
                        "activities": [
                            { "time": "08:00 AM", "activity": "Depart via [Transport Name]", "price": "₹1,200", "icon": "🚆" }
                        ]
                    }
                ]
            }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant",
            temperature: 0.1 // Very strict
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to plan. Please try a shorter duration or check API key." });
    }
});

module.exports = app;
