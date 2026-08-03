// Test Groq API with and without tools

import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

function isPlaceholder(value) {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();

  return (
    normalized === "" ||
    normalized.includes("your_") ||
    normalized.includes("change_this") ||
    normalized.includes("replace_with")
  );
}

if (isPlaceholder(GROQ_API_KEY)) {
  console.error("❌ GROQ_API_KEY is missing or still a placeholder.");
  console.error("💡 Add your real Groq API key inside backend/.env");
  process.exit(1);
}

const simpleTools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get weather information for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The location to get weather for",
          },
        },
        required: ["location"],
      },
    },
  },
];

async function postGroq(payload) {
  return axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    payload,
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    },
  );
}

async function testGroqTools() {
  console.log("Testing Groq API with tools...");
  console.log(`Model: ${GROQ_MODEL}`);

  try {
    console.log("\n1. Testing Groq without tools...");

    const simpleResponse = await postGroq({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: "Hello, how are you?" }],
      max_tokens: 100,
    });

    console.log("✅ Simple request works:", simpleResponse.status);

    console.log("\n2. Testing Groq with tools using auto tool choice...");

    const autoToolResponse = await postGroq({
      model: GROQ_MODEL,
      messages: [
        { role: "user", content: "What's the weather like in Tokyo?" },
      ],
      tools: simpleTools,
      tool_choice: "auto",
      max_tokens: 150,
    });

    console.log("✅ Auto tool choice works:", autoToolResponse.status);

    console.log("\n3. Testing Groq with forced tool choice...");

    const forcedToolResponse = await postGroq({
      model: GROQ_MODEL,
      messages: [
        { role: "user", content: "What's the weather like in Tokyo?" },
      ],
      tools: simpleTools,
      tool_choice: {
        type: "function",
        function: { name: "get_weather" },
      },
      max_tokens: 150,
    });

    console.log("✅ Forced tool choice works:", forcedToolResponse.status);

    console.log("\n4. Testing actual ATLAS-style safety tool...");

    const actualTools = [
      {
        type: "function",
        function: {
          name: "comprehensive_safety_intelligence",
          description: "Analyze safety and security for travel destinations",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "City or region name",
              },
              country: {
                type: "string",
                description: "Country name",
              },
              specific_concerns: {
                type: "string",
                description: "Specific safety concerns to focus on",
                default: "general",
              },
            },
            required: ["location", "country"],
          },
        },
      },
    ];

    const actualToolResponse = await postGroq({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content:
            "I am planning to visit Japan next week, what do you suggest?",
        },
      ],
      tools: actualTools,
      tool_choice: "auto",
      max_tokens: 200,
    });

    console.log(
      "✅ Actual ATLAS-style tool request works:",
      actualToolResponse.status,
    );
    console.log("\n🎉 Groq diagnostic completed successfully.");
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response?.status,
      error.response?.statusText || error.message,
    );

    if (error.response?.data) {
      console.error("Error details:", error.response.data);
    }

    if (error.response?.status === 401) {
      console.error(
        "\n💡 401 means the Groq API key is invalid, expired, or not loaded correctly.",
      );
      console.error(
        "   Check backend/.env and make sure GROQ_API_KEY is the real key.",
      );
    }

    process.exit(1);
  }
}

testGroqTools();
