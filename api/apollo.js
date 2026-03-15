export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { company } = req.body;
  if (!company) return res.status(400).json({ error: 'Company name required' });

  // Build LinkedIn search URLs — no API needed, always works
  const encodedCompany = encodeURIComponent(company);
  const titles = ['HR', 'Recruiter', 'Talent Acquisition', 'Human Resources', 'People Operations'];

  const links = titles.map(title => ({
    title,
    url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(title + ' ' + company)}&origin=GLOBAL_SEARCH_HEADER`,
  }));

  // Also build a direct company people search
  const companyPeopleUrl = `https://www.linkedin.com/company/${company.toLowerCase().replace(/\s+/g, '-')}/people/`;

  return res.status(200).json({ links, companyPeopleUrl, company });
}