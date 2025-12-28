require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to communicate
app.use(express.json());
app.use(express.static('public')); // Serve the HTML file

// Initialize Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// The API Endpoint
app.post('/api/plan-trip', async (req, res) => {
    const { origin, destination, days, budget, transport, currency, type } = req.body;

    // Validate Input
    if (!origin || !destination || !days) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Construct Prompt
        const details = `Budget: ${budget}. Transport: ${transport}. Currency: ${currency}.`;
        let userPrompt = "";

        if (type === 'single') {
            userPrompt = `Plan a ${days}-day trip to ${destination} from ${origin}. ${details}`;
        } else {
            userPrompt = `Plan a ${days}-day multi-city trip. Start: ${origin}. Stops: ${destination}. Optimize route. ${details}`;
        }

        const schema = {
            "total_cost": `Total approx cost in ${currency}`,
            "itinerary": [
                {
                    "day": 1,
                    "location": "City Name",
                    "theme": "Theme of the day",
                    "activities": [
                        { "time": "Morning", "activity": "Activity details", "cost": `Cost in ${currency}` },
                        { "time": "Afternoon", "activity": "Activity details", "cost": `Cost in ${currency}` },
                        { "time": "Evening", "activity": "Activity details", "cost": `Cost in ${currency}` }
                    ]
                }
            ]
        };

        const systemPrompt = `
            You are a helpful travel assistant. 
            You must return strictly valid JSON data. 
            Do not include any markdown formatting like \`\`\`json. 
            Just the raw JSON object.
            Follow this schema structure exactly: ${JSON.stringify(schema)}
        `;

        // Call Groq Llama 3.1
        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": userPrompt }
            ],
            "model": "llama-3.1-8b-instant",
            "temperature": 0.5,
            "max_tokens": 2048,
            "top_p": 1,
            "stop": null,
            "stream": false
        });

        // Parse Response
        const aiContent = chatCompletion.choices[0]?.message?.content || "";
        
        // Clean up if AI adds markdown despite instructions
        const cleanJson = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const tripData = JSON.parse(cleanJson);
        res.json(tripData);

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to generate itinerary. Try again." });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app; // For Vercel