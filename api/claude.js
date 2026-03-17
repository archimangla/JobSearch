export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: 'GEMINI_API_KEY not set' } });

  try {
    const { system, messages, resumeText } = req.body;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(200).json({
        content: [{ type: 'text', text: '⚠️ Resume text not received. Please re-upload your resume and try again.' }]
      });
    }

    const systemInstruction = `=== APPLICANT RESUME — ONLY SOURCE OF TRUTH ===
${resumeText}
=== END RESUME ===

CRITICAL RULES — NEVER VIOLATE:
1. ONLY reference projects, skills, technologies, companies, and achievements EXPLICITLY written in the resume above.
2. If asked about PROJECTS → use ONLY entries under the PROJECTS section. Never substitute with internship work.
3. If asked about EXPERIENCE → use ONLY the EXPERIENCE section.
4. If something is not in the resume, say you don't have that background — NEVER invent it.
5. No filler: never say "I am passionate about", "I have always been interested in", "I am excited to".
6. Be specific — use exact project names, numbers, and tech stack from the resume.
7. Mention portfolio https://archimangla.vercel.app naturally when relevant.

${system || ''}`;

    const userText = messages
      .map(m => Array.isArray(m.content)
        ? m.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
        : m.content)
      .join('\n');

    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: { message: data.error?.message || 'Gemini error' } });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
