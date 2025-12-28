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

    try {
        const systemPrompt = `
        You are an elite travel logistician.
        RULES:
        1. **Route Optimization:** Start at '${origin}'. If the user lists '${origin}' as a destination, SKIP IT (they live there) and go to the next city immediately. Reorder the other cities geographically.
        2. **Keywords:** For every location, provide a simple "image_keyword" (1-3 words max) for a stock photo search (e.g., "Eiffel Tower", "Taj Mahal", "Pizza").
        3. **JSON Only:** Return ONLY raw JSON.
        `;

        const userPrompt = `
        Plan a ${days}-day trip.
        Start: ${origin}
        Destinations: ${destination}
        Budget: ${budget}
        Transport: ${transport}
        Currency: ${currency}
        
        Schema:
        {
            "total_cost": "Estimated cost in ${currency}",
            "optimized_route_order": ["City 1", "City 2"],
            "itinerary": [
                {
                    "day": 1,
                    "city": "City Name",
                    "theme": "Theme",
                    "image_keyword": "City Landmark Name",
                    "activities": [
                        { "time": "Morning", "activity": "Activity", "cost": "Price", "image_keyword": "Specific Place Name" },
                        { "time": "Afternoon", "activity": "Activity", "cost": "Price", "image_keyword": "Specific Place Name" },
                        { "time": "Evening", "activity": "Activity", "cost": "Price", "image_keyword": "Specific Place Name" }
                    ]
                }
            ]
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
