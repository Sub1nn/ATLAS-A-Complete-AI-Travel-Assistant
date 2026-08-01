# ATLAS AI Travel Assistant

ATLAS is a full-stack AI travel assistant designed to help users plan trips, explore destinations, understand local context, and manage travel conversations in one workspace.

The application combines a React frontend, Node.js/Express backend, MongoDB persistence, JWT authentication, document upload, saved chat history, and external travel APIs. Users can create an account, continue previous conversations, upload travel-related files, and receive contextual AI responses supported by weather, location, safety, and document information where available.

---

## Features

### User authentication

- User signup and login
- JWT-based authentication
- Protected backend routes
- Persistent frontend session
- Automatic session validation on page reload

### AI travel assistant

- Chat-based travel planning interface
- Destination-aware responses
- Context memory inside each conversation
- Support for travel planning, local guidance, safety context, weather, accommodation guidance, sports/activity discovery, route planning, and practical trip advice
- Dynamic response formatting that changes according to the user intent instead of using one generic travel template

### Conversation history

- Saved conversations per authenticated user
- Conversation list sidebar
- Continue previous chats
- Delete individual conversations
- Clear all conversations

### Document upload and document-aware chat

- Upload PDF, DOCX, and TXT files
- Extract and store document text
- Split documents into searchable chunks
- Ask questions about uploaded files
- Attach documents to conversations

### External API integration

ATLAS can use external services for live or contextual travel information:

- Groq LLM API for AI responses
- Google Places API (New) and Routes API v2 for location, place and route information
- OpenWeather API for weather data
- NewsAPI for current safety or destination context
- Yelp API support for local recommendations

---

## Pinecone semantic document retrieval

ATLAS supports Pinecone-backed semantic retrieval for uploaded PDF, DOCX and TXT files. MongoDB stores the source document record. Pinecone stores vectors plus document identifiers, filenames and bounded document-chunk text; integrated-index mode also stores its searchable text field. See `PINECONE_RAG_SETUP.md` for setup details and `TRAVEL_RESPONSE_FLOW.md` for the orchestration design.

Recommended backend variables:

```env
PINECONE_ENABLED=true
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=atlas-documents
PINECONE_INDEX_HOST=your_pinecone_index_host_if_using_an_existing_index
PINECONE_INDEX_MODE=inference
PINECONE_TEXT_FIELD=text
PINECONE_EMBEDDING_MODEL=llama-text-embed-v2
PINECONE_EMBEDDING_DIMENSIONS=1024
PINECONE_NAMESPACE_PREFIX=atlas-user
```

Use `PINECONE_INDEX_MODE=inference` for the included automatic setup script. Integrated mode is supported when an integrated-embedding index has already been created in Pinecone with a compatible text field mapping.

Create the Pinecone index once from `backend/`:

```bash
npm run pinecone:setup
```

## Deployment support

- Dockerized frontend
- Dockerized backend
- MongoDB container using Docker Compose
- Separate document, privacy-deletion and retention workers
- Worker heartbeat and queue-health reporting
- Nginx-based frontend production server
- Backend health check endpoint
- Environment-based configuration

---

## Tech Stack

### Frontend

- React 18
- Vite
- Tailwind CSS
- Axios
- Lucide React

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs
- Multer
- pdf-parse
- mammoth
- Helmet
- Morgan
- Express Rate Limit
- Zod

### Infrastructure

- Docker
- Docker Compose
- Nginx
- MongoDB 7

---

## Project Structure

```text
ATLAS-AI-Travel_Assistant/
│
├── backend/
│   ├── config/
│   │   └── rateLimiter.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   ├── conversationController.js
│   │   └── documentController.js
│   │
│   ├── db/
│   │   └── mongoose.js
│   │
│   ├── middleware/
│   │   └── auth.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Conversation.js
│   │   └── Document.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── conversations.js
│   │   └── documents.js
│   │
│   ├── services/
│   │   ├── contextService.js
│   │   ├── documentService.js
│   │   ├── responseVerifier.js
│   │   ├── vectorStore.js
│   │   └── toolService.js
│   │
│   ├── utils/
│   │   ├── locationUtils.js
│   │   ├── networkTest.js
│   │   └── validation.js
│   │
│   ├── app.js
│   ├── index.js
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── chat/
│   │   │   ├── features/
│   │   │   └── sidebar/
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── useChat.js
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── utils/
│   │   │   └── formatMessage.jsx
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   └── package.json
│
├── docker-compose.yml
├── DOCKER_DEPLOYMENT.md
├── README.md
└── .gitignore
```

---

## System Architecture

```text
User
  │
  ▼
React + Vite Frontend
  │
  │  Authenticated API requests
  ▼
Express Backend API
  │
  ├── Auth Controller
  │     └── Signup, login, JWT validation
  │
  ├── Chat Controller
  │     └── AI response generation and conversation updates
  │
  ├── Conversation Controller
  │     └── Saved chat history
  │
  ├── Document Controller
  │     └── File upload, text extraction, document search
  │
  ├── Tool Service
  │     └── Weather, places, news, location and travel APIs
  │
  └── MongoDB
        ├── Users
        ├── Conversations
        └── Documents
```

---

## Backend API Overview

### Authentication

| Method | Endpoint           | Description                        |
| ------ | ------------------ | ---------------------------------- |
| POST   | `/api/auth/signup` | Create a new user account          |
| POST   | `/api/auth/login`  | Log in and receive JWT token       |
| GET    | `/api/auth/me`     | Get the authenticated user profile |
| POST   | `/api/auth/verify-email` | Verify an email token |
| POST   | `/api/auth/resend-verification` | Resend a verification email |
| POST   | `/api/auth/forgot-password` | Request a password reset |
| POST   | `/api/auth/reset-password` | Reset a password with a token |
| PATCH  | `/api/auth/preferences` | Update travel preferences |

### Chat

| Method | Endpoint                 | Description                               |
| ------ | ------------------------ | ----------------------------------------- |
| POST   | `/api/chat`              | Send a message to the AI travel assistant |
| POST   | `/api/reset-context`     | Reset conversation context                |
| GET    | `/api/context/:conversationId` | Get conversation context             |
| GET    | `/api/quality-analytics` | Get response quality analytics            |
| GET    | `/api/network-test`      | Test external API connectivity            |

### Conversations

| Method | Endpoint                 | Description               |
| ------ | ------------------------ | ------------------------- |
| GET    | `/api/conversations`     | List user conversations   |
| POST   | `/api/conversations`     | Create a new conversation |
| GET    | `/api/conversations/:id` | Get one conversation      |
| DELETE | `/api/conversations/:id` | Delete one conversation   |
| DELETE | `/api/conversations`     | Delete all conversations  |

### Documents

| Method | Endpoint                | Description                   |
| ------ | ----------------------- | ----------------------------- |
| GET    | `/api/documents`        | List uploaded documents       |
| POST   | `/api/documents/upload` | Upload PDF, DOCX, or TXT file |
| POST   | `/api/documents/:id/retry` | Retry failed document processing |
| DELETE | `/api/documents/:id`    | Queue durable document deletion |

### Health Check

| Method | Endpoint  | Description          |
| ------ | --------- | -------------------- |
| GET    | `/health` | Backend health check |
| GET    | `/health/ready` | Dependency readiness check |
| GET    | `/health/live` | Process liveness check |
| GET    | `/api/auth/account-deletion-status` | Check deletion status using the tracking token |

---

## Environment Variables

Create a `.env` file inside the `backend/` directory.

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:5173

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/atlas_travel?replicaSet=rs0&directConnection=true

# Authentication
JWT_SECRET=change_this_to_a_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
PRIVACY_POLICY_VERSION=2026-06-22
TERMS_VERSION=2026-06-22

# LLM provider
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

# Optional vector database placeholder
PINECONE_API_KEY=your_pinecone_api_key

# Rate limiting
ENFORCE_DEVELOPMENT_LIMITS=false
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Travel APIs
GOOGLE_MAPS_SERVER_API_KEY=your_google_maps_platform_server_key
OPEN_WEATHER_KEY=your_openweather_key
NEWS_API_KEY=your_newsapi_key
YELP_API_KEY=your_yelp_key
```

Google Maps Platform endpoint mapping:

- Backend geocoding uses `https://maps.googleapis.com/maps/api/geocode/json`.
- Backend live venue discovery uses Places API (New) at `https://places.googleapis.com/v1/places:searchText`.
- Backend route planning uses Routes API v2 at `https://routes.googleapis.com/directions/v2:computeRoutes`.
- Backend local-time context uses `https://maps.googleapis.com/maps/api/timezone/json`.
- Browser maps, if enabled, must use `VITE_GOOGLE_MAPS_API_KEY` only.
- Do not expose `GOOGLE_MAPS_SERVER_API_KEY` through Vite or browser code.

In `NODE_ENV=development`, ATLAS bypasses HTTP rate limits and daily chat/provider/LLM usage budgets by default so local testing can continue without exhausting app-level counters. Set `ENFORCE_DEVELOPMENT_LIMITS=true` if you want to test production-like throttling locally. Production keeps limits enabled.

Create a `.env` file inside the `frontend/` directory.

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

For Docker production builds, the frontend uses `/api` through the Nginx reverse proxy.

---

## Security Notes

Do not commit real `.env` files to GitHub.

The repository should only include safe example files such as:

```text
backend/.env.example
frontend/.env.example
```

Recommended `.gitignore` entries:

```gitignore
# Environment files
.env
**/.env
*.env.local

# Dependencies
node_modules/
**/node_modules/

# Build output
dist/
**/dist/
build/
**/build/

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# OS/editor files
.DS_Store
**/.DS_Store
.vscode/
.idea/

# Temporary files
*.tmp
*.swp
```

For production deployment, use a long random value for `JWT_SECRET`.

Example:

```text
JWT_SECRET=replace_with_a_secure_random_string_at_least_32_characters_long
```

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ATLAS-AI-Travel_Assistant.git
cd ATLAS-AI-Travel_Assistant
```

Use Node.js 20.19+ or 22.12+. The Docker images use Node.js 22.

### 2. Install backend dependencies

```bash
cd backend
npm ci
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm ci
```

### 4. Start MongoDB locally

If MongoDB is installed locally:

```bash
mongod
```

Or start MongoDB using Docker:

```bash
docker run --name atlas-mongo -p 27017:27017 -d mongo:7
```

### 5. Start the backend

```bash
cd backend
npm run dev
```

The backend runs on:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/health
```

### 6. Start the frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

---

## Running with Docker Compose

The project includes a full Docker Compose setup with:

- MongoDB
- One-shot database index migration
- Backend API
- Document processing worker
- Privacy and deletion worker
- Retention worker
- Frontend served through Nginx

### Start the full application

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:4000
```

MongoDB:

```text
mongodb://127.0.0.1:27017/atlas_travel?replicaSet=rs0&directConnection=true
```

### Stop containers

```bash
docker compose down
```

### Stop containers and remove MongoDB data volume

```bash
docker compose down -v
```

---

## Build Checks

### Frontend production build

```bash
cd frontend
npm run build
```

### Backend start check

```bash
cd backend
npm start
```

### Backend diagnostic scripts

```bash
cd backend
npm run diagnostic
npm run test-setup
```

---

## Document Upload Workflow

ATLAS supports PDF, DOCX, and TXT upload.

The document workflow is:

```text
Upload file
  │
  ▼
Validate file type
  │
  ▼
Extract text
  │
  ├── PDF through pdf-parse
  ├── DOCX through mammoth
  └── TXT through buffer text parsing
  │
  ▼
Split text into chunks
  │
  ▼
Generate searchable chunks
  │
  ▼
Store document metadata and fallback chunks in MongoDB
  │
  ▼
Index chunks in the user-specific Pinecone namespace when Pinecone is enabled
  │
  ▼
Retrieve semantically relevant chunks during chat, with MongoDB fallback if Pinecone is unavailable
```

Current document retrieval uses Pinecone semantic search when configured. MongoDB remains the source of truth for users, conversations, messages and document metadata.

---

## Main User Flow

```text
1. User creates an account or logs in
2. Frontend stores the JWT token
3. User starts a travel chat
4. Backend creates or updates a conversation
5. User may upload travel documents
6. Backend extracts and stores document content
7. User asks travel questions
8. Backend combines:
   - conversation memory
   - user message
   - document context
   - external API data
   - LLM response generation
9. Assistant response is saved and shown in the chat UI
10. User can return later and continue the conversation
```

---

## Production Considerations

Before deploying this application publicly, review the following:

### Required

- Use secure production API keys
- Use a strong `JWT_SECRET`
- Store secrets in the hosting provider secret manager
- Remove all real `.env` files from Git tracking
- Enable HTTPS
- Configure production CORS origin
- Use a managed MongoDB instance
- Configure `METRICS_TOKEN` and an HTTPS `ERROR_REPORTING_WEBHOOK_URL`
- Review rate limits for external APIs
- Configure Resend and verify its sending domain
- Run `npm run db:indexes` during managed-database deployment
- Configure automated MongoDB backups and restore testing
- Configure the operator, privacy contact, jurisdiction, lawful basis, international-transfer safeguards and supervisory authority after legal review
- Run the document and retention workers continuously
- Run the privacy worker independently from document parsing
- Alert when `/health/ready` reports missing workers, old queues, or deletion dead letters
- Use the metrics-token-protected `/internal/deletion-dead-letters` endpoint and retry endpoints to recover exhausted account or document deletions
- Configure global provider/LLM budgets and billing alerts in the provider consoles
- Use a MongoDB replica set with `MONGODB_TRANSACTIONS=true`
- Terminate HTTPS at the hosting load balancer or reverse proxy

### Capacity validation

`npm run test:integration` exercises same-conversation contention, fenced writes, expiring operation leases, global provider budgets, and document/account deletion races. `npm run test:load:authenticated` supplies the short authenticated regression load. Run `npm run test:soak` against the production load balancer with deployment-specific `SOAK_TEST_DURATION_MS`, `SOAK_TEST_CONCURRENCY`, and `SOAK_TEST_URL` values. Public-scale claims still require results from the real multi-instance deployment with paid providers enabled, realistic uploads, provider latency/failure injection, shutdown tests, and billing alarms.

## Optional Product Improvements

Planned improvements that would make ATLAS stronger:

- Itinerary builder with editable day-by-day plans
- Map-based place visualization
- User profile preferences
- Saved destinations
- Trip budget estimation
- PDF export for itineraries
- Multi-language support
- Admin dashboard for analytics
- Cloud deployment with CI/CD
- Better automated tests for backend routes and frontend components

---

## Portfolio Value

This project demonstrates practical full-stack development skills:

- React frontend development
- Node.js and Express API design
- MongoDB data modeling
- Authentication and authorization
- AI API integration
- External API orchestration
- File upload and document parsing
- Docker-based deployment
- Production-aware project structure

ATLAS is designed as a realistic AI travel assistant application rather than a simple chatbot demo.

---

## License

This project is licensed under the MIT License.

---

## Author

Subin Khatiwada

Master’s student in robotics and machine learning with interests in full-stack development, AI systems, intelligent automation, and practical machine learning applications.

---

Real `.env` files are excluded from the final ZIP. Start from `.env.example`, `backend/.env.example` and `frontend/.env.example` when configuring local or cloud deployments.


## Google Places API (New) and Routes API v2

ATLAS uses Google Places API (New) for venue, restaurant, accommodation and activity discovery. Routes use the Routes API v2 `computeRoutes` endpoint with an explicit response field mask. Enable **Places API (New)** and **Routes API** in Google Cloud and restrict the backend key to those APIs. The diagnostic script treats permission errors as failed connectivity.

## Travel orchestration update

The backend now uses an intent-first travel pipeline. Google Places API (New) is used for live place discovery, OpenWeather for weather, NewsAPI for current safety context, Google Routes API v2 for routes, Pinecone for document RAG, and Groq for structured planning and final language generation. The response composer handles destination planning, sports/activity searches, hotels/stays, dining/nightlife, route planning, weather and safety with distinct layouts.
