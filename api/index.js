import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST requests only" });
  }

  try {
    const {
      origin,
      destination,
      days,
      budget,
      transport,
      currency
    } = req.body;

    if (!origin || !destination || !days) {
      return res.status(400).json({ error: "Missing required inputs" });
    }

    /* ============================
       SYSTEM PROMPT (INTELLIGENCE)
    ============================= */
    const systemPrompt = `
You are a high-precision AI travel planner used in a real production app.

You must:
- Be realistic and geographically logical
- Respect transport mode strictly
- Optimize days vs distance
- Avoid rushed or tourist-trap plans
- Stay within the given budget tier

Trip constraints:
- From: ${origin}
- To: ${destination}
- Days: ${days}
- Budget: ${budget}
- Transport: ${transport}
- Currency: ${currency}

Return ONLY valid JSON. No markdown. No commentary.
`;

    /* ============================
       USER PROMPT (FORMAT CONTROL)
    ============================= */
    const userPrompt = `
Generate the best possible itinerary.

Return JSON in EXACTLY this structure:

{
  "total_cost": "string with currency symbol",
  "trip_summary": "short human-friendly summary",
  "suggestion": {
    "is_perfect": boolean,
    "text": "suggestion if any",
    "ideal_days": number
  },
  "itinerary": [
    {
      "day": number,
      "location": "city or area",
      "theme": "short theme",
      "activities": [
        {
          "time": "Morning/Afternoon/Evening/Night",
          "icon": "emoji",
          "activity": "clear description",
          "price": "estimated cost"
        }
      ]
    }
  ]
}

Rules:
- If days are insufficient, suggest ideal_days > ${days}
- If days are optimal, set is_perfect = true
- Do NOT invent booking links
- Prices must be realistic for ${currency}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      temperature: 0.4,
      max_tokens: 1800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const raw = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        error: "Invalid JSON returned by AI",
        raw
      });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Trip planner error:", error);
    return res.status(500).json({
      error: "Failed to generate travel plan"
    });
  }
}
