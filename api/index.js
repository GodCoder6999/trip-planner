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
        // 1. CONSTRUCT A HIGH-IQ PROMPT
        const baseInstruction = `
            You are an expert travel logistics manager. 
            Your goal is to plan a ${days}-day trip that starts at "${origin}" and ENDS at "${origin}".
            
            CRITICAL RULES:
            1. REORDER THE DESTINATIONS: If this is a multi-city trip (${destination}), you must re-arrange the order of cities to create the most logical, efficient geographic route. Do not just follow the user's input order if it is inefficient.
            2. REALISM: Provide SPECIFIC travel details. Do not say "Take a flight". Say "Flight AA123 (Approx $200)" or "Train: Vande Bharat Express (Approx ₹1500)".
            3. FULL CYCLE: Day 1 starts with travel from ${origin}. The Final Day must include travel back to ${origin}.
            4. BUDGET: Stick to a ${budget} budget in ${currency}.
            5. MODE: Prefer ${transport} where possible, but switch if logical (e.g. Flight for oceans, Train for nearby cities).
        `;

        const userPrompt = `
            Plan the itinerary. 
            Format: Day-by-day breakdown.
            Include transport names, departure times, and specific fares for every inter-city move.
        `;

        // 2. DEFINE THE SCHEMA (Must match your Frontend keys)
        const schema = {
            "total_cost": `Estimated total cost in ${currency} (including travel)`,
            "itinerary": [
                {
                    "day": 1,
                    "location": "Origin -> First City",
                    "theme": "Travel & Arrival",
                    "activities": [
                        { "time": "08:00 AM", "activity": "Depart ${origin} via [Transport Name/No]", "cost": "Cost" },
                        { "time": "02:00 PM", "activity": "Check-in and local exploration", "cost": "Cost" },
                        { "time": "Evening", "activity": "Dinner at [Specific Recommendation]", "cost": "Cost" }
                    ]
                },
                {
                    "day": "...",
                    "location": "City Name",
                    "theme": "Theme",
                    "activities": []
                },
                {
                    "day": days,
                    "location": "Last City -> ${origin}",
                    "theme": "Return Journey",
                    "activities": [
                        { "time": "Morning", "activity": "Final souvenir shopping", "cost": "Cost" },
                        { "time": "Afternoon", "activity": "Depart return to ${origin} via [Transport Name]", "cost": "Cost" },
                        { "time": "Night", "activity": "Arrive Home", "cost": "0" }
                    ]
                }
            ]
        };

        // 3. CALL THE AI
        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                { 
                    "role": "system", 
                    "content": baseInstruction + `\n Return ONLY raw JSON matching this schema: ${JSON.stringify(schema)}` 
                },
                { "role": "user", "content": userPrompt }
            ],
            "model": "llama-3.1-8b-instant",
            "temperature": 0.2, // Lower temperature = More strict/logical routing
            "max_tokens": 4096
        });

        const cleanJson = chatCompletion.choices[0]?.message?.content.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to generate plan." });
    }
});

module.exports = app;
