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

    // Convert Anthropic-style request to OpenAI-compatible format
    const openaiMessages = [];
    if (system) openaiMessages.push({ role: 'system', content: system });
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        // Handle document/text content blocks
        const textParts = msg.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        const docParts = msg.content
          .filter(b => b.type === 'document')
          .map(() => '[Resume uploaded by user]')
          .join('\n');
        openaiMessages.push({ role: msg.role, content: [docParts, textParts].filter(Boolean).join('\n') });
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

    // Convert OpenAI response back to Anthropic-style format
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}