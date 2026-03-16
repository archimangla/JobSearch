# Job Search Assistant
> AI-powered job search tool — draft emails, answer forms, tailor resumes, and update your Notion tracker. All in one place.

🔗 **Live:** [jobhuntwitharchi.vercel.app](https://jobhuntwitharchi.vercel.app)

---

## What it does

Upload your resume and paste a job description once. The tool gives you four AI-powered modules:

| Module | What it does |
|---|---|
| 📧 Outreach email | Drafts a cold email to HR/recruiter. Auto-detects email from JD. Opens directly in Gmail. |
| 📝 Form answers | Answers "why us / tell us about yourself" questions, tailored to the JD and your background. |
| ✨ Tailor resume | Rewrites bullet points and adds a summary to match the JD — without inventing experience. Downloads as DOCX. |
| 🗂 Notion update | Adds an entry directly to your DB Applications tracker with all fields — status, portal, mode, next action, salary. |

---

## Tech stack

- **Frontend** — Vanilla HTML/CSS/JS, hosted as static files on Vercel
- **Backend** — Vercel serverless functions (Node.js)
- **AI** — GPT-4o via GitHub Models API (free tier)
- **Integrations** — Notion API, LinkedIn search
- **DOCX generation** — [docx.js](https://docxjs.com/) (client-side)

---

## Project structure

```
JobSearch/
├── api/
│   ├── claude.js      # AI proxy — routes LLM requests via GitHub Models
│   ├── apollo.js      # LinkedIn recruiter search link generator
│   └── notion.js      # Notion DB integration — adds entries to DB Applications
├── public/
│   └── index.html     # Full frontend (single file)
└── vercel.json        # Routing config
```

---

## How to run locally

```bash
# Clone the repo
git clone https://github.com/archimangla/JobSearch.git
cd JobSearch

# Install Vercel CLI
npm install -g vercel

# Add environment variables
# Create a .env.local file with:
# GITHUB_API_KEY=your_github_token
# NOTION_API_KEY=your_notion_integration_token

# Run locally
vercel dev
```

---

## Environment variables

| Variable | Where to get it |
|---|---|
| `GITHUB_API_KEY` | [github.com/marketplace/models](https://github.com/marketplace/models) → Get API key |
| `NOTION_API_KEY` | [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → New integration → copy token |

> After getting the Notion token, open your DB Applications page → `...` → Connections → connect your integration.

---

## How the AI proxy works

The frontend sends Anthropic-style API requests to `/api/claude`. The serverless function converts them to OpenAI-compatible format and forwards to GitHub Models (`models.inference.ai.azure.com`). This keeps the API key server-side and bypasses browser CORS restrictions.

```
Browser → /api/claude (Vercel serverless) → GitHub Models (GPT-4o) → response
```

---

## Features in detail

**Resume tailoring** — Upload your actual PDF/DOCX. Claude reads the file, identifies JD keywords, and rewrites matching bullet points. Rule: never invent experience not in the original resume. Output downloads as a formatted DOCX.

**Recruiter search** — Clicking "Find recruiters on LinkedIn" generates pre-filled LinkedIn search URLs for HR, Recruiter, Talent Acquisition, and People Operations roles at the target company.

**Gmail integration** — After generating an email, "Open in Gmail" pre-fills the recipient (auto-extracted from JD or entered manually), subject, and body in one click.

**Notion DB sync** — Directly creates a new page in your `DB Applications` database with fields: Company, Position, Status, Portal, Cold Reach Out, Mode, Next Action, Location, Salary, Application Date.

---

## Built by

**Archi Mangla**  
B.Tech CSE — MAIT, GGSIPU | BS Data Science — IIT Madras  
[linkedin.com/in/archimangla](https://linkedin.com/in/archimangla) · [github.com/archimangla](https://github.com/archimangla)
