# JobPilot — Agentic AI Job Matching & Company Research Platform

**JobPilot** is a premium, state-of-the-art agentic AI web application built to streamline job hunting, matching, and preparation. It automates finding real IT opportunities, evaluates matching percentages against user resumes, and deploys browser agents to search company pages and create dossiers.

### 🌐 Live Deployment URL: [https://fc437ic5.insforge.site](https://fc437ic5.insforge.site)

---

## ✨ Features

1. **Dashboard Analytics Hub:**
   - **Stats Bar:** Displays Total Jobs, Avg. Match Rate, Researched Companies, and Weekly Job Finds.
   - **Live Activity Feed:** Log of job searches and company research timestamps.
   - **SVG Visualization Charts:** Dynamic custom SVG area-under-line and vertical bar charts highlighting jobs found over time, company research volume, and match score distribution.

2. **Smart Profiles & Resume Extraction:**
   - User profile form capturing skills, titles, experience, and history.
   - **AI Resume Extractor:** Instantly extracts full profile fields from uploaded resume PDFs via OpenAI GPT-4o.

3. **Job Search & Gemini Batch Scorer:**
   - Integrated with **Adzuna API** for real-time location-based job queries (US, Delhi, Lucknow, etc.).
   - Uses **Google Gemini** to evaluate jobs against your profile and return precise matching metrics, missing skills, and detailed match reasoning.
   - Advanced filters, sorting, and pagination.

4. **Autonomous Company Research Agent:**
   - A browser agent using **Stagehand** and **Browserbase** powered by Google Gemini to browse company homepages and sub-pages (About, Careers, Blogs).
   - Generates a **9-field Company Dossier** including: Company Overview, Tech Stack, Culture/Values, Why This Role, Your Edge, Gaps to Address, Smart Questions, and Interview Prep.

---

## 🛠️ Technology Stack

- **Framework:** Next.js 16.2 (App Router & Server Actions)
- **Styling:** Tailwind CSS & custom variables
- **Backend-as-a-Service (BaaS):** InsForge Platform (Postgres DB, RLS Policies, Session Auth, Storage Buckets)
- **AI Services:** Google Gemini (Job matching, Browser agent, Synthesis fallback) & OpenAI GPT-4o (Resume PDF parser)
- **Automation:** Stagehand & Browserbase Cloud Sessions
- **Analytics:** PostHog Product Tracking

---

## 🚀 Local Development Setup

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org) (v20+) installed.

### 2. Install Dependencies
Clone the repository and install packages:
```bash
git clone https://github.com/Sarthaksingh2005/job_pilot.git
cd job_pilot
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file at the project root with the following keys:
```env
NEXT_PUBLIC_INSFORGE_URL=https://fc437ic5.ap-southeast.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your_insforge_anon_key
INSFORGE_URL=https://fc437ic5.ap-southeast.insforge.app
INSFORGE_API_KEY=your_insforge_service_key

NEXT_PUBLIC_POSTHOG_KEY=your_posthog_public_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

GOOGLE_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key

BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSER_PROJECT_ID=your_browserbase_project_id
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application locally.

### 5. Build for Production
To test production bundles:
```bash
npm run build
npm start
```
