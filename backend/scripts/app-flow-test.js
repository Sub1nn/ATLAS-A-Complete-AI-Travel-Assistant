// Test the exact request structure ATLAS sends to Groq

import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const { responseEngine } = await import("../services/responseEngine.js");
const { toolService } = await import("../services/toolService.js");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

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

async function callGroq(requestData, timeout = 45000) {
  return axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    requestData,
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout,
      validateStatus: (status) => status < 500,
    },
  );
}

async function testAppFlow() {
  console.log("Testing actual ATLAS app flow...");

  const message =
    "I am planning to visit Japan next week, what do you suggest?";
  const userIntent = responseEngine.analyzeUserIntent(message);

  console.log("\nUser intent:");
  console.dir(userIntent, { depth: 4 });

  const context = {
    history: [],
    currentLocation: null,
    userProfile: {
      preferredStyle: "comprehensive",
      travelExperience: "intermediate",
      interests: [],
    },
  };

  try {
    console.log("\n1. Testing system prompt generation...");

    const systemPrompt = responseEngine.enhanceSystemPrompt(
      userIntent,
      context.history,
    );

    console.log("System prompt length:", systemPrompt.length);
    console.log(
      "System prompt preview:",
      systemPrompt.substring(0, 200) + "...",
    );

    console.log("\n2. Testing exact app request structure...");

    const tools = toolService.getTools();

    const requestData = {
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      tools,
      tool_choice: "auto",
      max_tokens: 2500,
      temperature: 0.3,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    };

    console.log("Request structure:");
    console.log("- Model:", requestData.model);
    console.log("- Messages count:", requestData.messages.length);
    console.log("- Tools count:", requestData.tools.length);
    console.log("- Tool choice:", requestData.tool_choice);
    console.log(
      "- System prompt length:",
      requestData.messages[0].content.length,
    );

    const response = await callGroq(requestData);

    if (response.status >= 400) {
      console.log("❌ Request failed with status:", response.status);
      console.log("Response data:");
      console.dir(response.data, { depth: 5 });
    } else {
      console.log("✅ Request succeeded:", response.status);
      console.log(
        "Response preview:",
        JSON.stringify(response.data, null, 2).substring(0, 700),
      );
    }
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response?.status,
      error.response?.statusText || error.message,
    );

    if (error.response?.data) {
      console.error("Error data:");
      console.dir(error.response.data, { depth: 5 });
    }
  }

  console.log("\n3. Testing with shortened system prompt...");

  try {
    const shortSystemPrompt =
      "You are ATLAS, a travel assistant. Help users with travel planning, safety, weather, and local recommendations.";

    const shortRequestData = {
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: shortSystemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      tools: toolService.getTools(),
      tool_choice: "auto",
      max_tokens: 1200,
      temperature: 0.3,
    };

    const shortResponse = await callGroq(shortRequestData);

    if (shortResponse.status >= 400) {
      console.log("❌ Short system prompt failed:", shortResponse.status);
      console.dir(shortResponse.data, { depth: 5 });
    } else {
      console.log("✅ Short system prompt works:", shortResponse.status);
    }
  } catch (error) {
    console.error(
      "❌ Short system prompt failed:",
      error.response?.status || error.message,
    );

    if (error.response?.data) {
      console.error("Short prompt error:");
      console.dir(error.response.data, { depth: 5 });
    }
  }
}

testAppFlow();
