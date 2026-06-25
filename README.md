# Marks & Admit Card Portal

A Next.js application for managing student marks and admit cards. Admins can upload, edit, and manage submissions with file upload support for admit cards.

## Tech Stack

- **Framework:** Next.js 15.3.3 (App Router)
- **Runtime:** React 19.1.0
- **Database:** SQLite via better-sqlite3
- **Styling:** CSS custom properties (dark/light themes)
- **Icons:** Lucide React
- **Notifications:** Sonner

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone <repo-url>
cd TestMarks
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Admin Access

Default credentials: `admin` / `admin123` (stored in DB, change via settings panel).

## Project Structure

```
├── app/
│   ├── layout.tsx        # Root layout, theme init, Toaster
│   ├── page.tsx          # Main page (server component)
│   └── globals.css       # All styles (dark/light themes)
├── lib/
│   ├── db.ts             # SQLite setup + schema
│   ├── types.ts          # TypeScript interfaces
│   └── actions.ts        # Server actions (CRUD, auth, uploads)
├── components/
│   ├── DataGrid.tsx       # Data table with search/filter/sort/pagination
│   ├── DashboardSummary.tsx # Stats cards
│   ├── SubmissionForm.tsx # New record form
│   └── SettingsPanel.tsx  # Admin panel (login, toggles, wipe DB, theme)
├── data/                  # SQLite database (auto-created)
└── public/uploads/        # Uploaded admit cards
```

## Features

- **CRUD operations** — Create, read, update, delete student submissions
- **Inline editing** — Click any cell to edit directly in the table
- **File uploads** — Upload admit cards (JPG, PNG, PDF, max 10MB)
- **Search & filter** — Full-text search, category filter, marks range filter
- **Sorting** — Click column headers to sort ascending/descending
- **Pagination** — Configurable page sizes (5, 10, 25, 50, 100)
- **Admin controls** — Toggle submissions, user edits, uploads; wipe database
- **Dark/light theme** — Toggle via settings panel, persisted in localStorage
- **Responsive** — Works on desktop and mobile

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis URL for caching (optional) |
| `REDIS_PASSWORD` | - | Redis password (optional) |
| `ENABLE_CACHING` | `true` | Enable/disable caching |

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```
