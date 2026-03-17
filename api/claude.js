export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GITHUB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: 'GITHUB_API_KEY not set' } });

  try {
    const { system, messages, max_tokens } = req.body;

    // Build OpenAI messages
    const openaiMessages = [];

    // Extract resume text from document blocks if present
    let resumeText = '';
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'document' && block.source?.data) {
            // Send resume to GPT-4o for extraction first
            const extractRes = await fetch('https://models.inference.ai.azure.com/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                max_tokens: 1000,
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'image_url',
                        image_url: {
                          url: `data:${block.source.media_type};base64,${block.source.data}`
                        }
                      },
                      {
                        type: 'text',
                        text: 'Extract all text from this resume exactly as written. Return only the raw text content, no commentary.'
                      }
                    ]
                  }
                ]
              })
            });
            const extractData = await extractRes.json();
            resumeText = extractData.choices?.[0]?.message?.content || '';
          }
        }
      }
    }

    // Build system prompt — use extracted resume if available, else fallback
    const fallbackProfile = `Applicant: Archi Mangla
Education: B.Tech CSE — MAIT GGSIPU (2023–2027) | BS Data Science — IIT Madras (2023–2027)
Experience: CS Intern at Frauscher Sensor Technology (Jan–Feb 2026)
Skills: Python, Flask, Django, FastAPI, PostgreSQL, Redis, Docker, JS, C++, Pandas, NumPy, Figma`;

    const profileContext = resumeText
      ? `APPLICANT RESUME (use this as the source of truth for all outputs):\n${resumeText}`
      : `APPLICANT PROFILE (fallback):\n${fallbackProfile}`;

    const enrichedSystem = profileContext + '\n\n' + (system || '');

    openaiMessages.push({ role: 'system', content: enrichedSystem });

    // Add remaining messages (text only, skip document blocks)
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        if (textParts) openaiMessages.push({ role: msg.role, content: textParts });
      } else {
        openaiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openaiMessages,
        max_tokens: max_tokens || 1500,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: { message: data.error?.message || 'API error' } });
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
