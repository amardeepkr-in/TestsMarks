# TestMarks — Complete Deployment Guide

## Overview

This guide walks you through deploying TestMarks to **Railway** (free tier ~$0.50-1.00/month).

**Flow:** Zip → GitHub → Railway → Live URL

**Time:** ~15 minutes

---

## Prerequisites

- A GitHub account (free)
- A Railway account (free — sign up with GitHub)
- The `TestMarks.zip` file from your Desktop

---

## STEP 1 — Upload to GitHub

### 1.1 Create a new GitHub repository

1. Go to **https://github.com/new**
2. **Repository name:** `TestMarks`
3. **Description:** `Marks & Admit Card Portal`
4. **Visibility:** Public (recommended for free Railway) or Private (both work)
5. **DO NOT** check "Add a README" or any other options — leave everything blank
6. Click **Create repository**

### 1.2 Upload the zip

1. After creating the repo, you'll see an empty repository page
2. Click **"uploading an existing file"** link (shown in the "Quick setup" section)
3. **Unzip** `TestMarks.zip` on your Desktop first
4. **Select all files** inside the unzipped `TestMarks` folder (NOT the folder itself)
5. Drag and drop them into the GitHub upload area
6. Wait for all files to upload (should be ~120 files)
7. Click **Commit changes**

### 1.3 Verify upload

Your repo should now have these key files at the root:
```
TestMarks/
├── Dockerfile          ← Docker build config
├── railway.json        ← Railway deploy config
├── .env.example        ← Environment variables template
├── package.json        ← Dependencies
├── next.config.ts      ← Next.js config
├── app/                ← Application code
├── lib/                ← Server logic
├── components/         ← UI components
└── __tests__/          ← 222 tests
```

---

## STEP 2 — Deploy on Railway

### 2.1 Create Railway project

1. Go to **https://railway.app**
2. Click **"Login"** → Sign in with your GitHub account
3. Click **"New Project"** (big purple button)
4. Select **"Deploy from GitHub repo"**
5. Find and select your **TestMarks** repository
6. Railway will start building immediately — wait for the first deploy (~2-3 min)

### 2.2 Get your app URL

1. After first deploy, click on your **TestMarks service**
2. Go to **Settings** tab (top navigation)
3. Scroll down to **"Networking"** section
4. Click **"Generate Domain"**
5. Railway gives you a URL like: `testmarks-production.up.railway.app`
6. **Copy this URL** — you'll need it for env vars

---

## STEP 3 — Set Environment Variables

This is the most important step. Without these, the app won't work.

### 3.1 Open Variables panel

1. In Railway dashboard → click your **TestMarks service**
2. Click **"Variables"** tab (next to Settings)

### 3.2 Add these variables

Click **"+ New Variable"** for each one:

| # | Variable Name | Value | Notes |
|---|--------------|-------|-------|
| 1 | `ADMIN_USERNAME` | `admin` | Login username |
| 2 | `ADMIN_PASSWORD` | `YourSecurePass123!` | **CHANGE THIS** to a strong password |
| 3 | `SESSION_SECRET` | *(see below)* | Random secret for session cookies |
| 4 | `NODE_ENV` | `production` | Required for production mode |
| 5 | `NEXT_PUBLIC_APP_URL` | `https://testmarks-production.up.railway.app` | Your Railway URL from Step 2.2 |

### 3.3 Generate SESSION_SECRET

Open a terminal on your computer and run:
```bash
openssl rand -hex 32
```

This outputs something like:
```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2
```

Copy that output and paste it as the value for `SESSION_SECRET`.

### 3.4 Optional variables (add if needed)

| Variable | Value | Purpose |
|----------|-------|---------|
| `SMTP_HOST` | `smtp.gmail.com` | Email sending |
| `SMTP_PORT` | `587` | Email port |
| `SMTP_USER` | `your@gmail.com` | Email username |
| `SMTP_PASS` | `app-password` | Email password |
| `SMTP_FROM` | `noreply@yourdomain.com` | Sender email |
| `SENTRY_DSN` | *(your Sentry DSN)* | Error tracking |

---

## STEP 4 — Add Persistent Storage

**Critical:** Without this, your database resets on every deploy.

### 4.1 Add volume

1. In Railway dashboard → your service → **Settings** tab
2. Scroll to **"Volumes"** section
3. Click **"+ Add Volume"**
4. **Mount Path:** `/app/data`
5. Click **"Add"**

That's it. Railway now persists your SQLite database across deploys.

---

## STEP 5 — Verify Deployment

### 5.1 Check the app

1. Visit your Railway URL: `https://testmarks-production.up.railway.app`
2. You should see the TestMarks homepage
3. Go to `/admin-login` — log in with your admin credentials

### 5.2 Check health endpoint

Visit: `https://testmarks-production.up.railway.app/api/health`

You should see:
```json
{
  "status": "ok",
  "database": "connected",
  "submissions": 0,
  "features": {
    "submissions": true,
    "uploads": true,
    "edits": true
  }
}
```

If `database: "disconnected"` → check that the volume is mounted at `/app/data`

---

## STEP 6 — Optional: Custom Domain

1. Railway dashboard → your service → **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `testmarks.yourdomain.com`)
4. Railway gives you a **CNAME record** to add to your DNS
5. Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
6. Add the CNAME record:
   - **Type:** CNAME
   - **Name:** `testmarks` (or whatever subdomain)
   - **Value:** `testmarks-production.up.railway.app`
   - **TTL:** Auto
7. Wait 5-10 minutes for DNS propagation
8. SSL certificate auto-provisions (free via Let's Encrypt)

---

## How to Update After Changes

When you push new code to GitHub, Railway auto-deploys. But if you need to manually trigger:

1. Railway dashboard → your service
2. Click **"Deployments"** tab
3. Click **"Redeploy"** on the latest deployment

Or push to GitHub:
```bash
git add .
git commit -m "fix: something"
git push
```

Railway auto-deploys within ~2 minutes.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Build fails on `npm ci` | Missing build tools | Already fixed in Dockerfile (python3, make, g++) |
| `Database connection failed` | No volume mounted | Add volume at `/app/data` |
| Can't log in | Wrong credentials | Check `ADMIN_PASSWORD` env var |
| 502 errors | App starting up | Wait 30 seconds, refresh |
| Health check fails | Migrations running | Wait 1 minute, check logs |
| `NEXT_PUBLIC_APP_URL` wrong | Redirects break | Set to your actual Railway URL |
| Session expires immediately | `SESSION_SECRET` missing | Add a random 64-char hex string |
| Build succeeds but app crashes | Missing env vars | Check all required vars are set |

### Viewing Logs

1. Railway dashboard → your service
2. Click **"Deployments"** tab
3. Click the latest deployment
4. Click **"View Logs"**

---

## What's Included

| Feature | Status |
|---------|--------|
| Admin dashboard with RBAC | ✅ Working |
| Student marks portal | ✅ Working |
| PDF/Excel/JSON export | ✅ Working |
| Bulk import | ✅ Working |
| Password reset | ✅ Working |
| 222 automated tests | ✅ Passing |
| Health check endpoint | ✅ Working |
| SQLite (persistent) | ✅ Working |
| Session auth (secure) | ✅ Working |
| Rate limiting | ✅ Working |
| CSP headers | ✅ Working |

---

## Cost

- **Railway free tier:** $5/month credit
- **This app uses:** ~$0.50-1.00/month
- **You get:** Auto HTTPS, custom domains, auto-deploys, persistent storage
- **No credit card required** for free tier

---

## Files Reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Docker build for Railway |
| `railway.json` | Railway deploy configuration |
| `.env.example` | Environment variables template |
| `.dockerignore` | Files excluded from Docker image |
| `RAILWAY.md` | Quick reference deployment guide |
| `DEPLOY.md` | This file — full step-by-step guide |
