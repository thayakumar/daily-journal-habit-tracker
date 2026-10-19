# Daily Journal & Habit Tracker

A personal daily food, wellness, and habit tracking app powered by Google Sheets as the database.

## Setup

### 1. Deploy the Google Apps Script

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1nS5QffTjna9GWb6HLQWTnoPqxSEhFGtSpAjixyoGAIY
2. Go to **Extensions > Apps Script**
3. Replace the content of `Code.gs` with the code from `google-apps-script/Code.gs`
4. Click **Deploy > New deployment**
5. Select **Web app** as the type
6. Set:
   - Description: "Journal Tracker API"
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** and copy the Web App URL

### 2. Configure the App

1. Copy `.env.example` to `.env`
2. Paste your Apps Script Web App URL as `VITE_GOOGLE_SCRIPT_URL`

### 3. Run Locally

```bash
npm install
npm run dev
```

## Google Sheet Structure

The app uses three sheets in the spreadsheet:

- **Entries** — One row per day (date, meals, sleep, exercise, habits as JSON)
- **Habits** — Habit definitions (id, name, color classes)
- **Settings** — Key-value pairs (e.g. showTasksColumn)

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Google Sheets (database)
- Google Apps Script (API layer)
- Lucide React (icons)
