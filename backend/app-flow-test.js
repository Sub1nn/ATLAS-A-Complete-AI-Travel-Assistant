// Test the exact request structure your app sends
import axios from "axios";
import dotenv from "dotenv";
import { responseEngine } from "./services/responseEngine.js";
import { toolService } from "./services/toolService.js";

dotenv.config();

async function testAppFlow() {
  console.log("Testing actual app flow...");

  const message = "I am planning to visit Japan next week, what do you suggest";
  const userIntent = responseEngine.analyzeUserIntent(message);

  console.log("User intent:", userIntent);

  // Simulate your context
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
    // Test the system prompt generation
    console.log("\n1. Testing system prompt generation...");
    const systemPrompt = responseEngine.enhanceSystemPrompt(
      userIntent,
      context.history
    );
    console.log("System prompt length:", systemPrompt.length);
    console.log(
      "System prompt preview:",
      systemPrompt.substring(0, 200) + "..."
    );

    // Test the exact request structure your app uses
    console.log("\n2. Testing exact app request structure...");

    const requestData = {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: message },
      ],
      tools: toolService.getTools(),
      tool_choice: "auto", // Use auto instead of forcing
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
      requestData.messages[0].content.length
    );

    // Make the actual request
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      requestData,
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status >= 400) {
      console.log("❌ Request failed with status:", response.status);
      console.log("Response data:", response.data);
    } else {
      console.log("✅ Request succeeded:", response.status);
      console.log(
        "Response preview:",
        JSON.stringify(response.data, null, 2).substring(0, 500)
      );
    }
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response?.status,
      error.response?.statusText
    );
    console.error("Error data:", error.response?.data);

    if (error.response?.data) {
      console.log("\nDetailed error analysis:");
      if (error.response.data.error) {
        console.log("Error type:", error.response.data.error.type);
        console.log("Error message:", error.response.data.error.message);
      }
    }
  }

  // Test 3: Try with a much shorter system prompt
  console.log("\n3. Testing with shortened system prompt...");
  try {
    const shortSystemPrompt =
      "You are ATLAS, a travel assistant. Help users with travel planning, safety, weather, and local recommendations.";

    const shortRequestData = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: shortSystemPrompt },
        { role: "user", content: message },
      ],
      tools: toolService.getTools(),
      tool_choice: "auto",
      max_tokens: 2500,
      temperature: 0.3,
    };

    const shortResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      shortRequestData,
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
      }
    );

    console.log("✅ Short system prompt works:", shortResponse.status);
  } catch (error) {
    console.error("❌ Short system prompt failed:", error.response?.status);
    console.error("Short prompt error:", error.response?.data);
  }
}

testAppFlow();
