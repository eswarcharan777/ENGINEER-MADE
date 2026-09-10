# Engineer Kingdom deployment

## 1. Push to your GitHub repository manually

Open PowerShell in this project folder and run:

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Prepare Engineer Kingdom for deployment"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Before `git commit`, inspect `git status` and confirm that `backend/.env`, `frontend/.env`, `node_modules`, virtual environments, logs, and `frontend/build` are not listed.

If the repository already has an `origin`, use this instead of `git remote add`:

```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## 2. Import into Vercel

Vercel Services is currently available in public beta on all plans. Confirm that
**Services** appears in the Framework Preset list before importing. If it is not
shown for the account, use two Vercel projects as a temporary fallback.

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Keep the project root as the repository root. Do not select `frontend` or
   `backend` as the Root Directory.
3. In **Build & Deployment**, select the **Services** framework preset.
4. Do not override the build command or output directory. The root
   `vercel.json` defines the Create React App and FastAPI services and routes
   `/api/*` to FastAPI before the frontend catch-all.
5. Add these server-only variables for Preview and Production:
   - `GEMINI_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (the complete service-account JSON value)
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET` (required for administrator image/document uploads)
   - `ADMIN_EMAILS` (comma-separated administrator email addresses)
6. Add the Firebase web configuration variables required at frontend build
   time: `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`,
   `REACT_APP_FIREBASE_PROJECT_ID`, `REACT_APP_FIREBASE_STORAGE_BUCKET`,
   `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`, and `REACT_APP_FIREBASE_APP_ID`.
7. Leave `REACT_APP_API_URL` unset. Browser requests use the deployment's own
   `/api` prefix, which avoids Preview URL and CORS problems.
8. Add `CORS_ORIGINS` only if a different origin must call the API.
9. Deploy a Preview first. Verify `/api/health` returns `{"status":"ok"}`,
   then test login, dashboard, AI Tutor, learning paths, and authenticated Admin.
10. Promote the verified Preview to Production.

After the first deploy, deploy both Firebase rulesets from the repository root:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
```

This is required for the locked-down audit, telemetry, upload metadata, and
Storage policies. Verify the selected Firebase project before executing it.

### Local Services verification

After installing the Vercel CLI, run this from the repository root:

```powershell
vercel dev -L
```

The `-L` mode runs both services locally without authenticating to Vercel.
Confirm the homepage loads and `http://localhost:3000/api/health` responds. The
exact port is printed by the CLI and may differ if port 3000 is occupied.

The FastAPI application intentionally exposes both `/health` and `/api/health`
internally. This keeps the service compatible with Vercel's `/api` mounting
behavior as well as direct local backend development.

Never commit API keys, Firebase service-account JSON, `.env` files, or `.vercel` project metadata.
