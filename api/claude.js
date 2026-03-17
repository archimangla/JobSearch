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
    const openaiMessages = [];

    // Step 1: Extract resume text from uploaded document
    let resumeText = '';
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'document' && block.source?.data) {
            const extractRes = await fetch('https://models.inference.ai.azure.com/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                max_tokens: 1500,
                messages: [{
                  role: 'user',
                  content: [
                    {
                      type: 'image_url',
                      image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` }
                    },
                    {
                      type: 'text',
                      text: 'Extract ALL text from this resume exactly as written. Preserve section names (EDUCATION, EXPERIENCE, PROJECTS, SKILLS, etc.) and their content. Return only the raw resume text, no commentary.'
                    }
                  ]
                }]
              })
            });
            const extractData = await extractRes.json();
            resumeText = extractData.choices?.[0]?.message?.content || '';
          }
        }
      }
    }

    // Step 2: Build system prompt — resume + JD as the only context
    const resumeBlock = resumeText
      ? `=== RESUME (source of truth) ===\n${resumeText}\n=== END RESUME ===`
      : '=== NO RESUME UPLOADED — ask user to upload their resume ===';

    const enrichedSystem = `${resumeBlock}\n\nINSTRUCTIONS:\n- Use ONLY the resume above as the source of truth for the applicant's background, education, experience, projects, and skills.\n- When the question/task is about projects specifically, focus on the PROJECTS section of the resume only. Do NOT default to the internship/experience section unless the question explicitly asks about work experience.\n- When the question/task is about experience or work, use the EXPERIENCE section.\n- Always tailor outputs to the job description provided in the user message.\n- Never invent, assume, or hallucinate any detail not present in the resume.\n- Sound like a real human — specific, grounded, no filler phrases like "I am passionate about" or "I have always been interested in".\n- Portfolio: https://archimangla.vercel.app | GitHub: https://github.com/archimangla | LinkedIn: https://linkedin.com/in/archimangla — mention naturally when relevant.\n\n${system || ''}`;

    openaiMessages.push({ role: 'system', content: enrichedSystem });

    // Step 3: Add user messages (text only, skip document blocks)
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

    // Step 4: Call GPT-4o
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
