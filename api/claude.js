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
      ? `=== RESUME (ONLY source of truth — do not go beyond this) ===\n${resumeText}\n=== END RESUME ===`
      : '=== NO RESUME UPLOADED ===\nTell the user: "Please upload your resume first so I can give accurate, grounded answers."';

    const enrichedSystem = `${resumeBlock}\n\nCRITICAL RULES — FOLLOW EXACTLY:\n1. NEVER mention any project, skill, technology, company, or experience that is NOT explicitly written in the resume above. If it is not in the resume, it does not exist.\n2. If asked about projects, use ONLY the project names and details from the PROJECTS section of the resume. Do not invent project names.\n3. If asked about experience, use ONLY the EXPERIENCE section of the resume.\n4. If the resume does not have enough information to answer, say so honestly — do NOT fill gaps with invented content.\n5. No filler phrases: never say "I am passionate about", "I have always been interested in", "I am excited to", or similar.\n6. Sound like a real human. Be specific. Reference exact project names, numbers, and technologies from the resume.\n7. Portfolio: https://archimangla.vercel.app | GitHub: https://github.com/archimangla | LinkedIn: https://linkedin.com/in/archimangla — mention naturally when relevant.\n\nVIOLATING RULE 1 OR 2 IS A CRITICAL FAILURE. DO NOT HALLUCINATE.\n\n${system || ''}`;

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
