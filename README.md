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
- Support for travel planning, local guidance, safety context, weather, accommodation guidance, and practical trip advice
- Response formatting designed for clean user-facing output

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
- Google Maps / Places APIs for location and place information
- OpenWeather API for weather data
- NewsAPI for current safety or destination context
- Yelp API support for local recommendations

### Deployment support

- Dockerized frontend
- Dockerized backend
- MongoDB container using Docker Compose
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
│   │   ├── intelligentConfig.js
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
│   │   ├── responseEngine.js
│   │   └── toolService.js
│   │
│   ├── utils/
│   │   ├── fallbackResponses.js
│   │   ├── locationUtils.js
│   │   ├── networkTest.js
│   │   ├── profileUtils.js
│   │   ├── responseMonitor.js
│   │   ├── systemPrompts.js
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
│   │   │   ├── documents/
│   │   │   ├── features/
│   │   │   ├── sidebar/
│   │   │   └── ui/
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── useChat.js
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── utils/
│   │   │   ├── formatMessage.jsx
│   │   │   └── toolIcons.js
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

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create a new user account |
| POST | `/api/auth/login` | Log in and receive JWT token |
| GET | `/api/auth/me` | Get the authenticated user profile |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Send a message to the AI travel assistant |
| POST | `/api/reset-context` | Reset conversation context |
| GET | `/api/context/:userId` | Get user context |
| GET | `/api/quality-analytics` | Get response quality analytics |
| GET | `/api/network-test` | Test external API connectivity |

### Conversations

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/conversations` | List user conversations |
| POST | `/api/conversations` | Create a new conversation |
| GET | `/api/conversations/:id` | Get one conversation |
| DELETE | `/api/conversations/:id` | Delete one conversation |
| DELETE | `/api/conversations` | Delete all conversations |

### Documents

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/documents` | List uploaded documents |
| POST | `/api/documents/upload` | Upload PDF, DOCX, or TXT file |
| DELETE | `/api/documents/:id` | Delete uploaded document |

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Backend health check |

---

## Environment Variables

Create a `.env` file inside the `backend/` directory.

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/atlas_travel

# Authentication
JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=7d

# LLM provider
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

# Optional vector database placeholder
PINECONE_API_KEY=your_pinecone_api_key

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Travel APIs
GOOGLE_API_KEY=your_google_maps_or_places_key
GOOGLE_MAPS_API_KEY=your_google_maps_or_places_key
GOOGLE_PLACES_API_KEY=your_google_places_key
OPEN_WEATHER_KEY=your_openweather_key
NEWS_API_KEY=your_newsapi_key
YELP_API_KEY=your_yelp_key
```

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

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
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
- Backend API
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
mongodb://localhost:27017/atlas_travel
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
Generate keyword metadata
  │
  ▼
Store document and chunks in MongoDB
  │
  ▼
Retrieve relevant chunks during chat
```

Current document retrieval is keyword and chunk based. A future improvement would be to add embedding-based vector search with a vector database such as Pinecone, Weaviate, Qdrant, or MongoDB Atlas Vector Search.

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
- Add request and error monitoring
- Review rate limits for external APIs

### Recommended

- Add automated tests
- Add refresh token support
- Move authentication tokens from localStorage to secure httpOnly cookies
- Add email verification
- Add password reset flow
- Add input validation for all request bodies
- Add file size limits per user
- Add document storage cleanup
- Add vector-based document retrieval
- Add CI/CD pipeline
- Add deployment-specific logging

---

## Current Limitations

This project is functional as a full-stack portfolio application, but some parts can be improved before production use:

- Document search currently uses keyword matching rather than semantic vector search.
- JWT tokens are stored in frontend localStorage.
- There is no refresh-token flow yet.
- There is no email verification or password reset feature yet.
- External API results depend on available API keys and provider limits.
- Test coverage is not yet implemented.
- Some diagnostic and legacy files may be cleaned or moved into a dedicated scripts folder.

---

## Suggested GitHub Repository Checklist

Before pushing the updated version:

```bash
# Check tracked environment files
git ls-files | grep ".env"

# Check ignored files
git status --ignored

# Remove macOS files if present
find . -name ".DS_Store" -delete

# Reinstall dependencies if needed
cd backend && rm -rf node_modules && npm install
cd ../frontend && rm -rf node_modules && npm install

# Run build check
cd frontend
npm run build
```

Recommended files to commit:

```text
README.md
DOCKER_DEPLOYMENT.md
docker-compose.yml
backend/
frontend/
backend/package-lock.json
frontend/package-lock.json
.env.example files
```

Files that should not be committed:

```text
.env
backend/.env
frontend/.env
node_modules/
dist/
.DS_Store
```

---

## Future Improvements

Planned improvements that would make ATLAS stronger:

- Embedding-based document retrieval
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
