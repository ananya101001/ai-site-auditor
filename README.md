# AI Site Auditor

AI Site Auditor is a Next.js web app that instantly analyses any public website and returns a structured audit report covering SEO, performance, user experience, and content quality. It fetches the target page server-side, extracts key signals with Cheerio, and sends a structured data payload to Claude (claude-sonnet-4-6) which scores each category and generates prioritised, actionable recommendations — all in a single request. Results are displayed in an interactive UI and can be exported as a multi-page PDF report.

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd ai-site-auditor

# 2. Install dependencies
npm install

# 3. Add your Anthropic API key
cp .env.example .env.local
# Edit .env.local and replace your_key_here with your actual key
# Get a key at https://console.anthropic.com/

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How it works

- **Fetch & parse** — The API route fetches the target URL with Axios, then uses Cheerio to extract titles, headings, meta tags, image alt text, link counts, and inline script/style sizes without executing JavaScript.
- **AI analysis** — The extracted data is serialised to JSON and sent to Claude with a structured system prompt that specifies exact scoring rubrics. Claude returns a validated JSON audit report with scores (0–100) and recommendations for each category.
- **Report & export** — The client renders the scores with animated SVG rings and collapsible section cards. A PDF report (generated entirely in-browser with jsPDF) can be downloaded with one click.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| HTML parsing | Cheerio |
| HTTP client | Axios |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| PDF generation | jsPDF + jspdf-autotable |
| Language | TypeScript |
