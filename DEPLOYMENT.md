# StudyBuddy - Vercel Deployment Guide

## Prerequisites
- GitHub repository: `Kanu4321/StudyBuddy`
- Vercel account connected to GitHub
- Google AI Studio API key for Gemini

---

## 1. Push Clean Code to GitHub

First, ensure the repository is clean (without .venv, node_modules, etc.):

```bash
cd C:\VS\code\PEC

# Check git status - should only show source files
git status --short

# If clean, add and commit
git add -A
git commit -m "feat: complete study buddy with dashboard, auth, and vercel config"
git push origin main
```

---

## 2. Configure Vercel Project

### 2.1 Import Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import `Kanu4321/StudyBuddy`
4. **Important:** Select **"Monorepo"** or configure Root Directory as `/` (root)

### 2.2 Build & Output Settings (Auto-detected from `vercel.json`)
- **Framework Preset:** Other
- **Build Command:** (handled by `vercel.json`)
- **Output Directory:** (handled by `vercel.json`)
- **Install Command:** (handled by `vercel.json`)

---

## 3. Environment Variables

Go to **Settings** → **Environment Variables** and add:

| Name | Value | Environment |
|------|-------|-------------|
| `GEMINI_API_KEY` | Your Google AI Studio API key | Production, Preview, Development |
| `JWT_SECRET` | Strong random string (min 32 chars) | Production, Preview, Development |
| `DATABASE_URL` | `sqlite:///./data/studybuddy.db` | Production, Preview, Development |
| `CORS_ORIGINS` | `https://your-project-name.vercel.app` | Production, Preview |

### Generate JWT_SECRET:
```bash
# Run locally to generate a secure secret
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 4. Project Structure for Vercel

The `vercel.json` configures:
- **Backend:** Python serverless function at `/api/*` → `backend/app/main.py`
- **Frontend:** Static build from `frontend/` → outputs to `frontend/dist/`

### Required Files:
```
StudyBuddy/
├── vercel.json              # Vercel configuration (this file)
├── .vercelignore            # Files to ignore during deployment
├── backend/
│   ├── app/main.py          # FastAPI entry point (serverless)
│   ├── requirements.txt     # Python dependencies
│   └── ...                  # Other backend modules
├── frontend/
│   ├── package.json         # Node dependencies + build script
│   ├── vite.config.js       # Vite config
│   └── src/                 # React source
└── .gitignore               # Git ignore rules
```

---

## 5. Important Notes for Vercel Deployment

### ⚠️ SQLite Limitations on Vercel
- **Vercel's filesystem is ephemeral** - SQLite files are reset on each deployment
- **Solution Options:**
  1. **Use external DB** (recommended): PostgreSQL (Neon, Supabase), PlanetScale, or Turso
  2. **For demo only:** Accept data loss on redeploy

### ⚠️ ChromaDB Limitations
- ChromaDB persistent storage won't work on Vercel serverless
- **Options:**
  1. Use ChromaDB Cloud (managed)
  2. Use Pinecone, Weaviate, or Qdrant vector DB
  3. For demo: Skip persistent vector store (re-index on each request)

### ⚠️ Python Serverless Constraints
- Max execution time: 60s (Hobby) / 300s (Pro)
- Max bundle size: 250MB
- No background processes
- Cold starts on first request

---

## 6. Recommended Production Setup

For a production-ready deployment, consider:

### Database
```bash
# Use Neon (PostgreSQL) - free tier
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/studybuddy
```

### Vector Store
```bash
# Use Pinecone
PINECONE_API_KEY=your-key
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX=studybuddy
```

### Update `backend/app/db.py` for PostgreSQL:
```python
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL must be set")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)
```

---

## 7. Deploy Steps Summary

1. **Push clean code** to GitHub (no .venv, node_modules, .db files)
2. **Import project** in Vercel
3. **Add environment variables** in Vercel dashboard
4. **Deploy** - Vercel will auto-detect Python + Static build
5. **Test** your deployed URL
6. **Update CORS_ORIGINS** with your actual Vercel URL
7. **Redeploy** if needed

---

## 8. Local Development vs Production

| Feature | Local Dev | Vercel Production |
|---------|-----------|-------------------|
| Backend | `uvicorn backend.app.main:app --reload` | Serverless `@vercel/python` |
| Frontend | `npm run dev` (Vite + proxy) | Static files from `frontend/dist` |
| API Proxy | Vite proxy `/api` → `localhost:8000` | Vercel routes `/api/*` → Python function |
| Database | SQLite file (`backend/data/studybuddy.db`) | External PostgreSQL recommended |
| Vector DB | Local ChromaDB (`backend/data/chroma/`) | External (Pinecone/Weaviate) recommended |

---

## 9. Troubleshooting

### Build Fails
- Check `vercel.json` syntax
- Ensure `requirements.txt` has all dependencies
- Check Vercel build logs for Python errors

### API Returns 404
- Verify `vercel.json` routes match your API prefix (`/api`)
- Check `backend/app/main.py` has correct router prefixes

### CORS Errors
- Add your Vercel domain to `CORS_ORIGINS` env var
- Redeploy after adding

### Database Errors
- Ensure `DATABASE_URL` is set in Vercel env vars
- For SQLite: accept data loss on redeploy
- For PostgreSQL: verify connection string

---

## 10. Quick Commands

```bash
# Generate secure JWT secret
python -c "import secrets; print(secrets.token_urlsafe(48))"

# Test local build
cd frontend && npm run build

# Test backend locally
cd backend && .venv/Scripts/uvicorn app.main:app --reload

# Check what files will be deployed
git ls-files | head -50
```

---

## 11. After Successful Deployment

1. Visit your Vercel URL (e.g., `https://studybuddy.vercel.app`)
2. Test: Sign up → Load lecture → Ask questions → Check Dashboard
3. Monitor Vercel Analytics for usage
4. Set up custom domain if needed (Settings → Domains)

---

**Note:** This setup works for demos and small-scale usage. For production with real users, migrate to managed PostgreSQL + managed vector database.