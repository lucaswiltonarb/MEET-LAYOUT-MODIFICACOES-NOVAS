# Moogle Meet (MEET-FAKE) — PRD

## Original Problem Statement
Run the user's GitHub project (https://github.com/alanvictorms/MEET-FAKE.git) — a Google Meet clone with an `/expert` admin panel that can manage fake participants and inject fake chat messages — and adjust UI/expert-panel features as requested. User is highly credit-sensitive.

## Current Stack (post-conversion, May 12, 2026)
User manually converted the project from Next.js 15 to the **Emergent-native stack** (React CRA + FastAPI + MongoDB) and pushed it to:
https://github.com/lucaswiltonarb/MEET-FAKE-FINAL-EMERGENT.git

- **Frontend**: React 19 + CRA (craco), React Router 7, Clerk (`@clerk/clerk-react`), Stream Chat & Video React SDKs, Tailwind
- **Backend**: FastAPI exposes the full set of `/api/*` routes (token, webhooks, admin auth, expert CRUD, fake participants, comments, comment library, broadcast, bulk add/delete)
- **DB**: MongoDB (local in preview, will need Atlas or managed cluster for production)

## Project Structure
```
/app/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env  (MONGO_URL, DB_NAME, CORS_ORIGINS, STREAM_*, CLERK_*, WEBHOOK_SECRET, ADMIN_*)
├── frontend/
│   ├── package.json (CRA + craco)
│   ├── src/  (React Router pages, components, hooks, lib)
│   ├── public/
│   └── .env (REACT_APP_BACKEND_URL, REACT_APP_CLERK_PUBLISHABLE_KEY, REACT_APP_STREAM_*)
├── memory/
├── test_reports/
└── tests/
```

## Key Features Already Implemented (carried over from Next.js version)
- Adaptive grid (max 7x4) for meeting participants
- FakeTile mirrors real participant DOM (mic-off icon, hover overlay, name pill)
- Full PT-BR localization
- Chat notification toasts when chat panel is closed
- People side panel
- Expert admin panel: bulk add/delete fake participants, custom amounts, broadcast chat, multi-line comment addition, comment library
- Custom ConfirmModal replacing native browser alerts

## CHANGELOG
- **2026-05-12**: Swapped entire `/app/frontend` and `/app/backend` with the converted CRA + FastAPI version from the new GitHub repo. Preserved protected env vars (MONGO_URL, DB_NAME, REACT_APP_BACKEND_URL, WDS_SOCKET_PORT). Added Clerk/Stream/Admin secrets to backend `.env` and Clerk/Stream public keys to frontend `.env`. Backend `/api/health` returns 200; frontend root returns 200 and renders the Moogle Meet landing page in PT-BR.
- **Prior session (Next.js)**: Adaptive grid, FakeTile rework, PT-BR translation, expert panel overhaul, chat notifications, people panel.

## Deployment Notes
- Previous Emergent native deploy failed because the original Next.js architecture did not match the CRA-based deployment template (`fastapi_react_mongo_shadcn_base_image_cloud_arm`). nginx welcome page + 520 health checks.
- After the user's CRA conversion the stack now matches the Emergent template. Ready for native deploy attempt.
- **Production reminder**: switch `MONGO_URL` to a managed MongoDB before/after deploy (local mongod won't persist across pods).

## Pending / Backlog
- User to trigger the Emergent native deploy from the chat UI.
- Optional: migrate MongoDB to Atlas for production data persistence.
- Optional: add automated tests under `/app/backend/tests`.

## Critical User Preferences
- **CREDIT SENSITIVITY**: User repeatedly demands minimum tool/credit usage. Do not call testing subagent unless strictly necessary. Skip large refactors and exploratory work.
- **UI**: Stick exactly to specs requested. Do not "improve" styling proactively.
