require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/plan-trip', async (req, res) => {
    try {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error("Missing OPENROUTER_API_KEY");
        }

        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                "HTTP-Referer": "https://travel-planner.vercel.app",
                "X-Title": "AI Travel Planner",
            }
        });

        const { origin, destination, days, budget, transport, currency } = req.body;
        
        // Using the Smart 70B Model (Free Tier)
        const modelName = "meta-llama/llama-3.3-70b-instruct:free";

        const prompt = `
            Act as a Senior Travel Logistician. Plan a ${days}-DAY trip from ${origin} to ${destination}.
            Mode: ${transport}. Budget: ${budget} ${currency}.

            STRICT RULES:
            1. ROUTE LOGIC: Organize cities in a straight geographic line (e.g. East to West). No zig-zagging.
            2. DAY COUNT: You MUST output exactly ${days} days. Day 1, Day 2, Day 3... up to Day ${days}. Do NOT skip numbers.
            3. REAL IMAGES: For every activity, provide a search keyword for a REAL photo (e.g. "Varanasi Ghats", "Taj Mahal", "Indian Train").
            4. FORMAT: Pure JSON.

            OUTPUT JSON STRUCTURE:
            {
                "cost": "Total Estimate",
                "sum": "Brief summary of the linear route",
                "itin": [
                    { 
                      "d": 1, 
                      "loc": "City Name", 
                      "act": [ 
                        { "t": "09:00", "a": "Activity Name", "p": "Price", "i": "SearchKeyword" } 
                      ] 
                    }
                ]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: modelName,
            temperature: 0.1,
            max_tokens: 2000
        });

        let rawContent = completion.choices[0]?.message?.content || "";
        
        // Cleanup JSON
        const jsonStartIndex = rawContent.indexOf('{');
        const jsonEndIndex = rawContent.lastIndexOf('}');
        
        if (jsonStartIndex === -1) { throw new Error("AI failed to generate JSON"); }
        
        const cleanJson = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
        res.json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || "Failed to generate plan" });
    }
});

module.exports = app;
