// Test Groq API with tools for debugging
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Simplified tool definition that should work with Groq
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

async function testGroqTools() {
  console.log("Testing Groq API with tools...");

  try {
    // Test 1: Simple request without tools (should work)
    console.log("\n1. Testing Groq without tools...");
    const simpleResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Hello, how are you?" }],
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log("✅ Simple request works:", simpleResponse.status);

    // Test 2: Request with tools but no tool_choice (let Groq decide)
    console.log("\n2. Testing Groq with tools (auto choice)...");
    const autoToolResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: "What's the weather like in Tokyo?" },
        ],
        tools: simpleTools,
        tool_choice: "auto",
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log("✅ Auto tool choice works:", autoToolResponse.status);

    // Test 3: Request with forced tool choice (this might fail)
    console.log("\n3. Testing Groq with forced tool choice...");
    const forcedToolResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: "What's the weather like in Tokyo?" },
        ],
        tools: simpleTools,
        tool_choice: {
          type: "function",
          function: { name: "get_weather" },
        },
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log("✅ Forced tool choice works:", forcedToolResponse.status);

    // Test 4: Test with your actual tool definition (this is likely failing)
    console.log("\n4. Testing with actual safety tool...");
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

    const actualToolResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content:
              "I am planning to visit Japan next week, what do you suggest",
          },
        ],
        tools: actualTools,
        tool_choice: {
          type: "function",
          function: { name: "comprehensive_safety_intelligence" },
        },
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log("✅ Actual safety tool works:", actualToolResponse.status);
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response?.status,
      error.response?.statusText
    );
    console.error("Error details:", error.response?.data);
    console.error("Request that failed:", error.config?.data);
  }
}

testGroqTools();
