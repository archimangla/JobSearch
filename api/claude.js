export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GITHUB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: 'GITHUB_API_KEY not set' } });

  try {
    const { system, messages, max_tokens, resumeText } = req.body;
    const openaiMessages = [];

    // resumeText is now sent directly as plain text from the client
    const resumeBlock = resumeText && resumeText.length > 50
      ? `=== RESUME (only source of truth) ===\n${resumeText}\n=== END RESUME ===`
      : '=== NO RESUME TEXT PROVIDED — tell user to upload their resume ===';

    const enrichedSystem = `${resumeBlock}

CRITICAL RULES — NEVER VIOLATE:
1. ONLY use information explicitly written in the resume above. Never mention any project, technology, company, or experience not in the resume.
2. If asked about PROJECTS → use ONLY the PROJECTS section. Never substitute internship/experience.
3. If asked about EXPERIENCE → use ONLY the EXPERIENCE section.
4. If a detail is not in the resume, say so — never invent or assume anything.
5. Never use filler: no "I am passionate about", "I have always been interested in", "I am excited to".
6. Be specific. Reference exact project names, numbers, and technologies from the resume.
7. Portfolio: https://archimangla.vercel.app | GitHub: https://github.com/archimangla | LinkedIn: https://linkedin.com/in/archimangla — mention naturally when relevant.

VIOLATING RULE 1 IS A CRITICAL FAILURE. DO NOT HALLUCINATE.

${system || ''}`;

    openaiMessages.push({ role: 'system', content: enrichedSystem });

    // Add user messages as plain text only
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
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
