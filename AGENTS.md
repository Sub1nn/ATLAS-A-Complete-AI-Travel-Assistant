# AGENTS.md

## Project Overview
- **Project:** ATLAS — an AI travel assistant with live travel context, saved conversations, and document-aware chat
- **Target user:** Travelers planning destinations, activities, stays, routes, and safety checks
- **My skill level:** Intermediate
- **Stack:** React, Vite, Tailwind CSS, Node.js, Express, MongoDB, Redis, Pinecone, Docker, and Nginx

## Commands
- **Install:** `cd backend && npm ci`, then `cd frontend && npm ci`
- **Dev:** `npm run dev` inside both `backend/` and `frontend/`
- **Build:** `cd frontend && npm run build`
- **Test:** `cd backend && npm test`
- **Lint:** `cd frontend && npm run lint`

## Do
- Read existing code before modifying anything
- Match existing patterns, naming, and style
- Handle errors gracefully — no silent failures
- Keep changes small and scoped to what was asked
- Run dev/build after changes to verify nothing broke
- Ask clarifying questions before guessing

## Don't
- Install new dependencies without asking
- Delete or overwrite files without confirming
- Hardcode secrets, API keys, or credentials
- Rewrite working code unless explicitly asked
- Push, deploy, or force-push without permission
- Make changes outside the scope of the request

## When Stuck
- If a task is large, break it into steps and confirm the plan first
- If you can't fix an error in 2 attempts, stop and explain the issue

## Testing
- Run existing tests after any change
- Add at least one test for new features
- Never skip or delete tests to make things pass

## Git
- Small, focused commits with descriptive messages
- Never force push

## Response Style
- always respond with clear & concise messages
- use plain English when explaining to the User
- avoid long sentences, complex words, or long paragraphs
