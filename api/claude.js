export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: 'GEMINI_API_KEY not set' } });

  try {
    const { system, messages, max_tokens, resumeB64, resumeMediaType } = req.body;

    // Build Gemini contents array
    const contents = [];

    // Build the user message parts
    const parts = [];

    // If resume was uploaded, attach it as inline data (Gemini supports PDF natively)
    if (resumeB64 && resumeMediaType) {
      parts.push({
        inline_data: {
          mime_type: resumeMediaType,
          data: resumeB64
        }
      });
      parts.push({
        text: 'The above is the applicant\'s resume. Use it as the SOLE source of truth for their background, education, experience, projects, and skills. NEVER mention anything not in this resume.'
      });
    }

    // Add user messages
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        if (textParts) parts.push({ text: textParts });
      } else if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      }
    }

    contents.push({ role: 'user', parts });

    // System instruction
    const systemInstruction = `${system || ''}

CRITICAL RULES — NEVER VIOLATE:
1. Use ONLY information explicitly written in the uploaded resume. Never mention any project, skill, technology, company, or achievement not in the resume.
2. If asked about PROJECTS → use ONLY the PROJECTS section of the resume. Do NOT substitute with internship/experience.
3. If asked about EXPERIENCE → use ONLY the EXPERIENCE section.
4. If a detail is not in the resume, say so honestly — never invent or assume anything.
5. No filler phrases: never say "I am passionate about", "I have always been interested in", "I am excited to".
6. Be specific. Reference exact project names, numbers, and technologies from the resume.
7. Portfolio: https://archimangla.vercel.app | GitHub: https://github.com/archimangla | LinkedIn: https://linkedin.com/in/archimangla — mention naturally when relevant.

VIOLATING RULE 1 IS A CRITICAL FAILURE. DO NOT HALLUCINATE.`;

    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens || 1500,
        temperature: 0.7,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: { message: data.error?.message || 'Gemini API error' } });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
