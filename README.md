# 🌍 ATLAS — AI-Powered Travel Intelligence Assistant

> **ATLAS** is a production-ready, multi-agent, API-integrated AI travel assistant built with **Node.js (Express)** and **React**.  
> It analyzes travel queries, retrieves live weather & safety information, identifies attractions & cuisines, and produces structured, human-readable travel intelligence reports.

---

## 🚀 Overview

ATLAS uses:

- **LLM reasoning**
- **External travel intelligence APIs**
- **A custom intent classification engine**
- **A multi-tool execution pipeline**
- **A beautiful, structured response formatter**

This enables the assistant to provide actionable insights for any location in seconds.

---

## ✨ Features

### 🧠 Intelligent Query Understanding

- Detects user intent across:
  - Weather
  - Safety
  - Accommodation
  - Attractions
  - Culture & etiquette
  - Local cuisines
- Weighted keyword + contextual scoring system

### 🔧 Multi-Agent Tool Integration

ATLAS fetches real-time results from:

- Weather APIs
- Safety intelligence feeds
- Local cuisine search
- Tourist attraction discovery

### 🎨 Beautiful Structured Responses

Every final output includes:

- 🕑 **Timestamp**
- 📊 **Intelligence Analysis**
- 📑 **Executive Summary**
- 🎯 **Key Recommendations**
- 🔧 **Tools Used**
- Optional sections:
  - 🌤️ _Weather Outlook_
  - 🛡️ _Safety Advisory_
  - 🕌 _Cultural Etiquette_
  - 📍 _Local Experiences & Attractions_
  - 🍽️ _Cuisine Highlights & Dining Recommendations_
  - 🏨 _Accommodation Insights & Stay Recommendations_

---

## 🧠 System Architecture

```

📦 user_assistant_app/
├── backend/
│   ├── app.js                    # Express app entry
│   ├── routes/
│   │   └── chat.js              # Chat API routes
│   ├── controllers/
│   │   └── chatController.js    # Orchestrates intents → tools → LLM → formatter
│   ├── services/
│   │   ├── responseEngine.js    # Core intelligence engine (formatting, intent analysis)
│   │   ├── toolService.js       # Weather, safety, cuisine, attractions integrations
│   ├── utils/
│   │   ├── systemPrompts.js
│   │   ├── locationUtils.js
│   │   ├── fallbackResponses.js
│   └── ...
└── frontend/
├── src/
│   ├── components/          # UI components (chat window, message bubble, response cards)
│   ├── services/            # API bridge to backend
│   ├── App.jsx
│   ├── main.jsx

```

---

## ⚙️ Tech Stack

| Layer     | Technologies                                                         | Purpose                                 |
| --------- | -------------------------------------------------------------------- | --------------------------------------- |
| Frontend  | React, Vite, TailwindCSS, shadcn/ui                                  | Clean, modern chat UI                   |
| Backend   | Node.js, Express, Vector DB                                          | API routing, tool orchestration         |
| AI Engine | Custom `responseEngine` Agentic flow                                 | Intent detection, structured formatting |
| LLM       | OpenAI / Gemini / Any compatible model                               | Natural language reasoning              |
| APIs      | Weather API, Safety API, Attractions API, Cuisine & Accomodation API | Real-time travel intelligence           |

---

## 📡 API Usage

### `POST /api/chat`

Send a user query to the assistant.

#### **Request**

```json
{
  "message": "I am traveling to Nepal next week"
}
```

#### **Sample Response**

```
🕑 23:19:57

📊 INTELLIGENCE ANALYSIS
• Weather Analysis
• Safety Intelligence
• Local Experiences & Attractions

📑 EXECUTIVE SUMMARY
Nepal is a beautiful destination with cultural richness and scenic landscapes.
Light rainfall is expected next week — pack accordingly.

🎯 KEY RECOMMENDATIONS
• Register with your embassy
• Avoid large gatherings
• Explore heritage sites in Kathmandu
• Check daily weather forecasts

🔧 TOOLS USED
• Weather API
• Safety API
```

---

## 🧪 Local Development Guide

### Backend Setup

```bash
cd user_assistant_app/backend
npm install
npm run dev
```

Create a `.env`:

```
PORT=5000
GROQ_API_KEY = LLM response
GOOGLE_API_KEY = Live traffic data
GOOGLE_PLACES_API_KEY = Live accomodation
PINECONE_API_KEY = Vector DB
NEWS_API_KEY = Current situation
OPEN_WEATHER_KEY = Live weather
YELP_API_KEY = Live news
```

---

### Frontend Setup

```bash
cd user_assistant_app/frontend
npm install
npm run dev
```

---

## 🔐 Security Considerations

- API key protection via environment variables
- Rate limiting
- XSS-safe output sanitization
- CORS enforcement
- Graceful error handling for all endpoints

---

## 🧭 Future Roadmap

- 🗺️ Interactive map view
- 🧠 Vector semantic search for destinations
- 🗣️ Multi-language support
- 📱 Progressive Web App (PWA)
- 🎒 AI itinerary generator
- 🎧 Voice-enabled assistant mode

---

## 👤 Author

**Subin Khatiwada**
Creator & Lead Engineer — ATLAS Travel Intelligence Assistant

---

## 🧾 License

**MIT License**
Feel free to use, modify, or extend with attribution.

---

## ⭐ Support & Contributions

If you find ATLAS useful:

- ⭐ Star the repository
- 📣 Share it
- 🤝 Contribute improvements

Together, let’s build the smartest AI travel assistant in the world!
