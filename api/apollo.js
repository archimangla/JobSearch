export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APOLLO_API_KEY not set' });

  const { company, domain } = req.body;

  try {
    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'accept': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        q_keywords: company,
        ...(domain ? { q_organization_domains_list: [domain] } : {}),
        person_titles: [
          'HR', 'Human Resources', 'Recruiter', 'Technical Recruiter',
          'Talent Acquisition', 'People Operations', 'Hiring Manager'
        ],
        per_page: 3,
        page: 1,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Apollo API error' });
    }

    const people = (data.people || []).slice(0, 3).map(p => ({
      id: p.id,
      first_name: p.first_name || '',
      last_name: p.last_name_obfuscated || '',
      title: p.title || '',
      has_email: p.has_email || false,
      organization: p.organization?.name || company,
    }));

    return res.status(200).json({ people });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}