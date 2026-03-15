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
    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        q_keywords: company,
        q_organization_domains_list: domain ? [domain] : [],
        person_titles: ['HR', 'Human Resources', 'Recruiter', 'Talent Acquisition', 'People Operations', 'Hiring Manager'],
        per_page: 3,
        page: 1,
      }),
    });

    const data = await response.json();
    const people = (data.people || []).slice(0, 3).map(p => ({
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      title: p.title || '',
      email: p.email || '',
      linkedin: p.linkedin_url || '',
    }));

    return res.status(200).json({ people });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}