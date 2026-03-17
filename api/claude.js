export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const apiKey = process.env.GITHUB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: 'GITHUB_API_KEY not set' } });

  const { system, messages, resumeText } = req.body;

  if (!resumeText || resumeText.trim().length < 50) {
    return res.status(200).json({
      content: [{ type: 'text', text: '⚠️ Resume not loaded. Please upload your resume and wait for "resume loaded" badge before generating.' }]
    });
  }

  const systemPrompt = `=== RESUME — ONLY SOURCE OF TRUTH ===
${resumeText.trim()}
=== END RESUME ===

RULES (never violate):
1. Only reference what is explicitly in the resume above. No invented projects, skills, or experience.
2. Questions about PROJECTS → use only the PROJECTS section.
3. Questions about EXPERIENCE → use only the EXPERIENCE section.
4. If something is not in the resume, say so — never make it up.
5. No filler: never say "I am passionate about", "I have always been interested in", "I am excited to".
6. Use exact names, numbers, and technologies from the resume.
7. Mention https://archimangla.vercel.app naturally when relevant.

${system || ''}`;

  const userText = messages
    .map(m => typeof m.content === 'string' ? m.content : (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
    .join('\n');

  try {
    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        max_tokens: 1500,
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: { message: data.error?.message || 'API error' } });
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch(e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
