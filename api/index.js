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
    const { origin, destination, days, budget, transport, currency } = req.body;

    try {
        const systemPrompt = `
        You are an Intelligent Travel Comparison Engine. 
        Your goal is to compare "The Rail Experience" vs "The Air Shortcut" for every leg of an Indian trip.

        CORE LOGIC:
        1. **Route Strategy:** Start at '${origin}'. If '${origin}' is in the destination list, SKIP IT as a destination. Optimize the order of the remaining cities.
        2. **The Decision Rule:** - If distance < 400km, Flight is "Not Practical".
           - For long hauls, highlight time savings.
        3. **Structure:** For every movement between cities (Leg 1, Leg 2...), provide a comparison.
        4. **Images:** Provide a simple "image_keyword" (e.g., "Varanasi Ghats") for the destination.
        
        OUTPUT FORMAT:
        Return ONLY raw JSON matching this specific schema. No markdown.
        `;

        const userPrompt = `
        Plan a trip starting from ${origin} to ${destination}.
        Total Days: ${days}. Budget: ${budget}. Currency: ${currency}.

        JSON SCHEMA:
        {
            "trip_summary": "Brief summary of the route",
            "segments": [
                {
                    "from": "City A",
                    "to": "City B",
                    "image_keyword": "City B Landmark",
                    "transport_comparison": {
                        "train": {
                            "name": "Specific Train Name (e.g., Vande Bharat)",
                            "fare_3ac": "Price",
                            "fare_2ac": "Price",
                            "duration": "Time"
                        },
                        "flight": {
                            "practical": true/false,
                            "details": "Direct or 1-stop",
                            "fare": "Price",
                            "duration": "Flight time + 2hr Check-in"
                        },
                        "recommendation": "Cheapest or Quickest"
                    },
                    "itinerary_days": [
                        {
                            "day_number": 1,
                            "theme": "Theme of day",
                            "activities": [
                                { "time": "Morning", "desc": "Activity", "cost": "Price" },
                                { "time": "Evening", "desc": "Activity", "cost": "Price" }
                            ]
                        }
                    ]
                }
            ],
            "total_estimated_cost": "Total Price"
        }
        `;

        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": userPrompt }
            ],
            "model": "llama-3.1-8b-instant",
            "temperature": 0.2,
            "max_tokens": 4096,
            "response_format": { type: "json_object" }
        });

        const tripData = JSON.parse(chatCompletion.choices[0].message.content);
        res.json(tripData);

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to generate plan." });
    }
});

module.exports = app;

