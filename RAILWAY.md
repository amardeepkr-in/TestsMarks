# Railway Deployment Guide

## Quick Deploy (3 steps)

### 1. Push to GitHub
```bash
git add .
git commit -m "feat: Railway deployment config"
git push
```

### 2. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `TestMarks` repo

### 3. Set Environment Variables
In Railway dashboard → your service → **Variables** tab, add:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here
SESSION_SECRET=your-random-32-char-string-here
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.up.railway.app
```

### 4. Add Persistent Volume
Railway → your service → **Settings** → **Volumes**:
- Mount Path: `/app/data`
- This persists your SQLite database across deploys

**That's it.** Railway auto-detects the Dockerfile and deploys.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_USERNAME` | Yes | `admin` | Admin login username |
| `ADMIN_PASSWORD` | Yes | `admin123` | Admin login password (CHANGE THIS!) |
| `SESSION_SECRET` | Yes | — | Random string for session signing |
| `NODE_ENV` | Yes | `production` | Set to `production` |
| `NEXT_PUBLIC_APP_URL` | Yes | — | Your Railway app URL |
| `SMTP_HOST` | No | — | Email server host |
| `SMTP_PORT` | No | `587` | Email server port |
| `SMTP_USER` | No | — | Email username |
| `SMTP_PASS` | No | — | Email password |
| `SMTP_FROM` | No | — | From address for emails |
| `SENTRY_DSN` | No | — | Sentry error tracking |
| `REDIS_URL` | No | — | Redis for caching (optional) |

---

## Generate SESSION_SECRET
```bash
openssl rand -hex 32
```

---

## Free Tier Notes
- Railway gives **$5/month free credit**
- This app uses ~$0.50-1.00/month on hobby tier
- SQLite with volume mount persists across deploys
- Automatic HTTPS on `*.up.railway.app`

---

## Updating
Push to GitHub → Railway auto-redeploys.
Migrations run automatically on startup.

## Troubleshooting
- Check logs: Railway dashboard → your service → **Deployments** → **View Logs**
- Health check: `https://your-app.up.railway.app/api/health`
- Database issues: Ensure volume is mounted at `/app/data`
