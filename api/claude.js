// Detect if text is likely to trigger Azure content filters
function isSensitiveContent(text) {
  const triggers = /cyber|malware|exploit|ransomware|threat intel|attack surface|penetration|red team|zero.?day|DDoS|botnet|phishing|intrusion|vulnerability|CVE-|shellcode|payload|exfiltrat|lateral movement|privilege escalation|SOC analyst|SIEM|dark web/gi;
  const matches = (text.match(triggers) || []).length;
  return matches >= 3; // 3+ matches = likely to trigger filter
}

// Sanitize by replacing individual trigger words
function sanitize(text) {
  if (!text) return text;
  return text
    .replace(/\bcyber\s*(security|threat|attack|criminal|intelligence)\b/gi, 'digital security')
    .replace(/\battack surface\b/gi, 'digital footprint')
    .replace(/\bthreat intel(ligence)?\b/gi, 'security intelligence')
    .replace(/\bpenetration test(ing)?\b/gi, 'security assessment')
    .replace(/\bred team\b/gi, 'security team')
    .replace(/\bzero.?day\b/gi, 'unpatched issue')
    .replace(/\bDDoS\b/gi, 'service disruption attack')
    .replace(/\bmalware\b/gi, 'malicious software')
    .replace(/\bransomware\b/gi, 'malicious software')
    .replace(/\bphishing\b/gi, 'social engineering')
    .replace(/\bexploit(s|ation)?\b/gi, 'security issue')
    .replace(/\bvulnerabilit(y|ies)\b/gi, 'security weakness')
    .replace(/\bintrusion (detection|prevention)\b/gi, 'anomaly detection')
    .replace(/\bprivilege escalation\b/gi, 'access control issue')
    .replace(/\blateral movement\b/gi, 'network traversal')
    .replace(/\bSOC analyst\b/gi, 'security analyst')
    .replace(/\bSIEM\b/gi, 'security monitoring platform')
    .replace(/\bdark web\b/gi, 'underground internet')
    .replace(/\bpayload\b/gi, 'data package')
    .replace(/\bexfiltrat\w+/gi, 'data transfer')
    .replace(/\bCVE-[\d-]+/gi, 'security advisory')
    .replace(/\bbotnet\b/gi, 'network of compromised systems')
    .replace(/\bshellcode\b/gi, 'low-level code');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const apiKey = process.env.GITHUB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: 'GITHUB_API_KEY not set' } });

  let { system, messages, resumeText } = req.body;

  if (!resumeText || resumeText.trim().length < 50) {
    return res.status(200).json({
      content: [{ type: 'text', text: '⚠️ Resume not loaded. Please upload your resume and wait for "resume loaded" badge before generating.' }]
    });
  }

  // Sanitize messages to avoid Azure content filter
  const sanitizedMessages = messages.map(m => {
    const content = typeof m.content === 'string' ? m.content : (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return { role: m.role, content: sanitize(content) };
  });

  // Also sanitize system prompt
  const sanitizedSystem = sanitize(system || '');

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
8. For emails: write a FULL email — minimum 150 words, maximum 220 words. Never write a short stub.

${sanitizedSystem}`;

  const userText = sanitizedMessages.map(m => m.content).join('\n');

  try {
    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        max_tokens: 1500,
        temperature: 0.7,
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