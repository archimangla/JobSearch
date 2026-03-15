export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const notionKey = process.env.NOTION_API_KEY;

  // Debug GET route
  if (req.method === 'GET') {
    return res.status(200).json({
      hasKey: !!notionKey,
      keyLength: notionKey ? notionKey.length : 0,
      keyPrefix: notionKey ? notionKey.slice(0, 7) : 'none'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!notionKey) return res.status(500).json({ error: 'NOTION_API_KEY not set' });

  const { company, position, status, portal, applicationDate, location, mode, coldReachOut, nextAction, salary, notes } = req.body;
  const DATABASE_ID = '306060c4-54a1-81f8-972d-000b8974cb95';

  const properties = {
    Company: { title: [{ text: { content: company || '' } }] },
    ...(position ? { Position: { rich_text: [{ text: { content: position } }] } } : {}),
    ...(applicationDate ? { 'Application Date': { date: { start: applicationDate } } } : {}),
    ...(status ? { Status: { multi_select: [{ name: status }] } } : {}),
    ...(portal ? { Portal: { multi_select: [{ name: portal }] } } : {}),
    ...(location ? { Location: { rich_text: [{ text: { content: location } }] } } : {}),
    ...(mode ? { Mode: { multi_select: [{ name: mode }] } } : {}),
    ...(coldReachOut ? { 'Cold Reach Out': { select: { name: coldReachOut } } } : {}),
    ...(nextAction ? { 'Next Action': { multi_select: [{ name: nextAction }] } } : {}),
    ...(salary ? { Salary: { number: parseFloat(salary) } } : {}),
  };

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties,
        ...(notes ? { children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: notes } }] } }] } : {}),
      }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) { return res.status(500).json({ error: 'Notion returned non-JSON: ' + text.slice(0, 200) }); }

    if (!response.ok) return res.status(response.status).json({ error: data.message || 'Notion error' });
    return res.status(200).json({ success: true, url: data.url, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}