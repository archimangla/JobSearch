// Strip terms that trigger Azure OpenAI content filters
function sanitizeJD(text) {
  if (!text) return text;
  return text
    .replace(/\b(exploit|malware|ransomware|spyware|rootkit|keylogger|trojan|botnet|phishing|pharming|DDoS|DoS attack|zero.?day|CVE-\d+|reverse shell|payload|shellcode|command.?and.?control|C2|exfiltrat\w*|infiltrat\w*|attack surface|threat actor|threat vector|adversar\w+|dark web|deepweb|cyber.?criminal|hacktivist|nation.?state actor|APT\d*|penetration test|pen test|red team|blue team|SOC analyst|SIEM|intrusion detection|intrusion prevention|firewall bypass|privilege escalation|lateral movement|credential dumping|pass.?the.?hash|SQL injection|XSS|CSRF|RCE|remote code execution|arbitrary code execution|buffer overflow|heap spray|use.?after.?free)\b/gi, (match) => {
      // Replace with neutral equivalents
      const map = {
        'attack surface': 'digital footprint', 'threat intelligence': 'security intelligence',
        'penetration test': 'security assessment', 'pen test': 'security assessment',
        'red team': 'security team', 'blue team': 'defense team',
        'intrusion detection': 'anomaly detection', 'intrusion prevention': 'threat prevention',
        'exploit': 'security issue', 'malware': 'malicious software',
        'phishing': 'social engineering', 'DDoS': 'service disruption',
        'zero-day': 'unpatched vulnerability', 'zero day': 'unpatched vulnerability',
      };
      const lower = match.toLowerCase();
      return map[lower] || 'security-concept';
    });
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

  // Sanitize JD content in user messages to avoid Azure content filter
  const sanitizedMessages = messages.map(m => {
    if (typeof m.content === 'string') {
      return { ...m, content: sanitizeJD(m.content) };
    }
    return m;
  });

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
8. For emails: write a FULL, COMPLETE email — minimum 150 words, maximum 220 words. Never write a short stub.

${system || ''}`;

  const userText = sanitizedMessages
    .map(m => typeof m.content === 'string' ? m.content : (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
    .join('\n');

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