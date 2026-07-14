# Supervision Brain

**Live demo:** [TODO — add Vercel deployment URL](https://your-app.vercel.app)

A network risk analysis platform for advisor supervision teams. It watches five data feeds per advisor (mortgage lender spread, protection provider spread, file review results, file review deficiencies, enhanced financial monitoring flags), scores risk against a configurable rule engine, and layers AI on top for narrative explanation, deep-dive review, anomaly surfacing, natural-language rule authoring, and a chat assistant over the data.

Risk grading itself is deterministic — a fixed set of threshold rules decides what's Critical/High/Medium/Low. AI never overrides that; it explains findings, drafts things for a human to review, or answers questions. That split is intentional: an auditable rule engine for the decision that matters, AI for everything around it.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Next.js Frontend                  │
│  Dashboard · Advisors · Analysis · Reports · Chat    │
│  Admin: Risk Rules · Settings                        │
└────────────────────────┬─────────────────────────────┘
                         │ REST API
┌────────────────────────┴─────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                          │
│  Rule engine (deterministic) ──▶ risk grade/score        │
│                                                          │
│  Orchestrator                                            │
│    NRA Agent    → rule evaluation + AI narrative         │
│    EDD Agent     → deep-dive on flagged advisors         │
│    Report Agent  → PDF/Excel + AI executive summary      │
│                                                          │
│  On-demand agents (not part of the analysis run)         │
│    Pattern Discovery Agent → advisory-only AI findings   │
│    Rule Author Agent       → NL → structured rule draft  │
│    Chat Agent               → Q&A over live data         │
│                                                          │
│  PostgreSQL (Supabase) · JWT Auth · Email Alerts         │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | Next.js 16 (Turbopack), TypeScript, Tailwind CSS, Recharts |
| Backend    | Python, FastAPI, SQLAlchemy, Pydantic v2         |
| Database   | PostgreSQL (Supabase)                            |
| AI (local) | LM Studio (OpenAI-compatible API)                |
| AI (cloud) | Google Gemini                                    |
| Reports    | ReportLab (PDF), openpyxl (Excel)                |
| Auth       | JWT (python-jose, passlib)                       |

## Features

**Risk analysis**
- Five risk datasets per advisor, eight configurable rules with editable thresholds, weights, and risk grades
- Composite risk grading (Critical / High / Medium / Low) with full evidence traceability back to the triggering value and threshold
- Runs entirely rule-based if no AI provider is configured — AI is additive, never required

**AI layer**
- Narrative analysis per finding, using each rule's configured hint to focus the explanation
- Enhanced due diligence write-ups for advisors that trip an EDD-required rule
- AI-written executive summaries on generated reports (falls back to a plain summary if AI is unavailable)
- On-demand pattern discovery per advisor — AI reviews the full dataset for things the fixed rules wouldn't catch (trends, near-threshold concerns, cross-dataset correlations). These surface as clearly labeled, unverified findings and never affect the advisor's actual risk grade
- Natural-language rule authoring — describe a rule in plain English, review the AI-drafted structured rule, then save it yourself
- Chat assistant for ad-hoc questions over the current advisor/rule data

**Data management**
- Add advisors individually through a form, or bulk-ingest via JSON upload (with a downloadable sample file showing the expected shape)
- PDF and Excel report generation, downloadable per analysis run

## Quick Start

### 1. Database

```bash
supabase start
# → Postgres on 127.0.0.1:54322 (user: postgres, password: postgres)
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Optional: set AI_PROVIDER + GEMINI_API_KEY (or LM_STUDIO_*) to enable the AI layer

uvicorn app.main:app --reload
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
# Tables are created and seeded automatically on first run
```

### 3. Frontend

```bash
cd frontend
npm install

cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# → http://localhost:3000
```

### 4. First Run

1. Log in with `admin@supervision-brain.local` / `Admin@1234!`
2. Fifty sample advisors are seeded automatically — head to **Advisors** to browse them, or **Settings** to ingest your own JSON data
3. Click **Run Analysis** on the Dashboard to execute the rule engine (and AI enrichment, if configured)
4. Open an advisor's detail page to see findings, or try **Discover AI Patterns** for advisory-only insights
5. Visit **Reports** to download the generated PDF/Excel, or **AI Assistant** to ask questions about the data

### Docker Compose

```bash
cp backend/.env.example .env
docker-compose up --build
```

## Demo Credentials

| Role                 | Email                               | Password      |
|----------------------|--------------------------------------|---------------|
| Administrator        | admin@supervision-brain.local        | Admin@1234!   |
| Compliance Officer   | compliance@supervision-brain.local   | Comply@1234!  |
| Supervision Manager  | supervisor@supervision-brain.local   | Super@1234!   |

## Risk Rules (Pre-configured)

| Rule                                     | Dataset            | Threshold | Grade          |
|-------------------------------------------|---------------------|-----------|-----------------|
| Mortgage Lender Concentration — Medium     | Lender Spread       | >50%      | Medium          |
| Mortgage Lender Concentration — High       | Lender Spread       | >70%      | High + EDD      |
| Protection Provider Concentration — Medium | Provider Spread     | >55%      | Medium          |
| Protection Provider Concentration — High   | Provider Spread     | >70%      | High + EDD      |
| File Review Failure Rate — Medium          | File Reviews        | >25%      | Medium          |
| File Review Failure Rate — High            | File Reviews        | >45%      | High + EDD      |
| Deficiency Codes with Lender Concentration | Deficiencies        | Combo     | High + EDD      |
| EFM Flag with High-Commission Provider     | EFM                 | Active    | Critical + EDD  |

Each rule's `ai_prompt_hint` steers the AI narrative for findings it produces — edit it from the Risk Rules admin page, or draft a whole new rule from a plain-English description.

## API Documentation

FastAPI auto-generates interactive docs at `http://localhost:8000/docs`.

## AI Configuration

The AI provider is selected by the `AI_PROVIDER` environment variable — everything else works identically regardless of which one (or none) is active:

| `AI_PROVIDER` | When to use        | Additional vars needed |
|----------------|---------------------|--------------------------|
| `lm_studio`    | Local development    | `LM_STUDIO_BASE_URL` (default `http://localhost:1234/v1`), `LM_STUDIO_MODEL` |
| `gemini`       | Cloud / production    | `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.0-flash`) |
| *(blank)*      | Rule-based only        | none |

LM Studio exposes an OpenAI-compatible REST API — load any compatible model and point the env vars at it.

## Environment Variables

| Variable              | Description                          | Default |
|------------------------|----------------------------------------|---------|
| `SECRET_KEY`            | JWT signing key                        | dev key (change in prod) |
| `AI_PROVIDER`           | `lm_studio`, `gemini`, or blank         | blank (rule-based only) |
| `LM_STUDIO_BASE_URL`    | LM Studio server URL                    | `http://localhost:1234/v1` |
| `LM_STUDIO_MODEL`       | Model name as listed in LM Studio       | `local-model` |
| `GEMINI_API_KEY`        | Google Gemini API key                    | required if `AI_PROVIDER=gemini` |
| `GEMINI_MODEL`          | Gemini model name                        | `gemini-2.0-flash` |
| `AI_RATE_LIMIT_PER_MINUTE` | Self-throttle for Gemini calls (keeps under free-tier quota); no effect on LM Studio | `10` |
| `AI_REQUEST_TIMEOUT_SECONDS` | Per-request timeout, both providers | `60` |
| `SMTP_*`                | Email alert configuration                | optional |
| `DATABASE_URL`          | SQLAlchemy DB URL                        | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (local Supabase) |
| `CORS_ORIGINS`          | Allowed frontend origins                 | `http://localhost:3000` |

## Project Structure

```
supervision-brain-poc/
├── backend/
│   ├── app/
│   │   ├── agents/            # Orchestrator + NRA / EDD / Report / Pattern Discovery / Rule Author / Chat agents
│   │   ├── api/routes/        # FastAPI endpoints
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Rule engine, AI client, chat context building
│   │   ├── seed_data.py       # Sample data generator
│   │   └── main.py
│   └── requirements.txt
└── frontend/
    ├── app/                   # Next.js App Router pages
    │   ├── dashboard/
    │   ├── advisors/
    │   ├── analysis/
    │   ├── reports/
    │   ├── chat/
    │   └── admin/
    ├── components/
    └── lib/
```
