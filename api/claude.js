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

    // Inject correct profile into every system prompt
    const ARCHI_PROFILE = `
APPLICANT PROFILE (always use this exactly — never deviate):
Name: Archi Mangla
Phone: +91 8800928963 | Location: Delhi, India
Email: archimangla6@gmail.com
LinkedIn: linkedin.com/in/archimangla | GitHub: github.com/archimangla

EDUCATION (always mention BOTH degrees):
1. Bachelor of Technology, Computer Science (2023–2027)
   Maharaja Agrasen Institute of Technology, GGSIPU
2. Bachelor of Science, Data Science — Online (2023–2027)
   Indian Institute of Technology (IIT), Madras

EXPERIENCE:
Computer Science Intern, Frauscher Sensor Technology (Jan 2026 – Feb 2026), Gurugram
- Built Python–Flask dashboard integrating Excel (Pandas, OpenPyXL) managing 100+ live records with 6+ real-time analytics; packaged as Windows .exe
- Automated FAdC configuration and BOM generation using Flask + Excel automation, reducing manual effort by 80%

PROJECTS:
- HealthSync (Python, Flask, SQLite, REST APIs) — 15+ role-based backend endpoints, 35% better data consistency
- Hintro Backend System (Python, FastAPI, PostgreSQL) — 12+ RESTful endpoints, RBAC, ride-matching logic

SKILLS:
Languages: C, C++, Python, SQL, HTML, CSS, JavaScript
Frameworks: Django, DRF, Flask, FastAPI, Celery, REST API Design
Databases: PostgreSQL, SQLite, Redis
Tools: Docker, Git, GitHub, Figma, Google Colab, VS Code
Data: NumPy, Pandas
Core CS: DSA, DBMS, OS, System Design, Backend Architecture

ACHIEVEMENTS:
- 98.45 percentile Mathematics, JEE Mains 2023
- 1st Runner Up, North India Championship, ICMAS
- Head of Poetry Department, Literary Umbrella 2025–26
- Featured in Hindustan Times and The Unheard Stories Podcast
- Multiple poetry wins at MAMC, IITD, IGDTUW, SRCC, DU circuit
`;

    const enrichedSystem = system
      ? ARCHI_PROFILE + '\n\n' + system
      : ARCHI_PROFILE;

    // Convert Anthropic-style to OpenAI-compatible format
    const openaiMessages = [];
    openaiMessages.push({ role: 'system', content: enrichedSystem });
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        const docParts = msg.content.filter(b => b.type === 'document').map(() => '[Resume file uploaded — use the APPLICANT PROFILE above]').join('\n');
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

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}