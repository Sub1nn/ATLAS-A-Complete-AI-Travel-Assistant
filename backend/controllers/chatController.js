import axios from "axios";
import { toolService } from "../services/toolService.js";
import { responseEngine } from "../services/responseEngine.js";
import { getLocationData } from "../utils/locationUtils.js";
import { conversationContext } from "../utils/profileUtils.js";
import { fallbackResponses } from "../utils/fallbackResponses.js";
import { IntelligentToolSelector } from "../config/intelligentConfig.js";
import { ResponseMonitor } from "../utils/responseMonitor.js";
import crypto from "crypto";

// Simple request queue to manage rate limits
class RequestQueue {
  constructor() {
    this.lastRequestTime = 0;
    this.minInterval = 1500; // Minimum 1.5 seconds between requests
  }

  async waitForTurn() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      console.log(`🚦 Rate limit prevention: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

const requestQueue = new RequestQueue();

// Helper functions to avoid 'this' binding issues (enhanced versions)
function getOrCreateContext(userId) {
  try {
    if (!conversationContext.has(userId)) {
      console.log(`🆕 Creating new context for user: ${userId}`);
      conversationContext.set(userId, {
        history: [],
        currentLocation: null,
        userProfile: {
          preferredStyle: "comprehensive",
          travelExperience: "intermediate",
          interests: [],
          preferredComplexity: "medium",
          preferredTools: {},
          travelPurposes: []
        },
        createdAt: Date.now(),
        lastActive: Date.now(),
        requestCount: 0,
      });
    } else {
      // Update last active time and request count
      const context = conversationContext.get(userId);
      context.lastActive = Date.now();
      context.requestCount = (context.requestCount || 0) + 1;
    }
    return conversationContext.get(userId);
  } catch (err) {
    console.error("❌ Context creation error:", err.message);
    return {
      history: [],
      currentLocation: null,
      userProfile: {
        preferredStyle: "comprehensive",
        travelExperience: "intermediate",
        interests: [],
        preferredComplexity: "medium",
        preferredTools: {},
        travelPurposes: []
      },
      createdAt: Date.now(),
      lastActive: Date.now(),
      requestCount: 1,
    };
  }
}

// Enhanced input validation
function validateInput(message, userId) {
  const errors = [];

  if (!message || typeof message !== "string") {
    errors.push("Message is required and must be a string");
  } else {
    if (message.length < 1) errors.push("Message cannot be empty");
    if (message.length > 2000)
      errors.push("Message too long (max 2000 characters)");
    if (message.trim().length === 0)
      errors.push("Message cannot be only whitespace");
  }

  if (userId && (typeof userId !== "string" || userId.length > 50)) {
    errors.push("Invalid user ID format");
  }

  return errors;
}

// Sanitize user input
function sanitizeInput(message) {
  return message
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .substring(0, 2000); // Hard limit
}

// Generate unique request ID for tracking
function generateRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// COMPLETELY REWRITTEN: Enhanced tool choice determination with comprehensive logic
function determineToolChoice(message, userIntent, context) {
  const lowerMessage = message.toLowerCase();

  console.log(`🎯 Analyzing tool choice for intent: ${userIntent.primaryIntent.type} (confidence: ${userIntent.primaryIntent.confidence})`);

  // STEP 0: Handle system/identity questions - ABSOLUTELY NO TOOLS
  if (userIntent.primaryIntent.type === "system_identity") {
    console.log(`🤖 SYSTEM IDENTITY QUERY - FORCING NO TOOLS`);
    return "none";
  }

  // ADDITIONAL SAFETY CHECK: Block tools only for direct identity questions.
  // Do NOT use broad checks such as startsWith("what are"), because travel queries like
  // "what are your concerns on travelling to Nepal" must still be routed normally.
  const directIdentityPatterns = [
    /^who\s+are\s+you/i,
    /^what\s+are\s+you/i,
    /^what\s+is\s+atlas/i,
    /^tell\s+me\s+about\s+atlas/i,
    /^tell\s+me\s+about\s+yourself/i,
    /^who\s+(created|made|built|developed)\s+you/i,
    /(who\s+is\s+)?your\s+(creator|developer)/i,
    /creator\s+name/i,
    /name\s+of\s+your\s+creator/i,
    /created\s+by\s+who/i,
    /made\s+by\s+whom/i,
  ];

  const isDirectIdentityQuestion = directIdentityPatterns.some((pattern) =>
    pattern.test(message.trim())
  );

  if (isDirectIdentityQuestion) {
    console.log(`🚫 DIRECT IDENTITY QUESTION DETECTED - BLOCKING ALL TOOLS`);
    return "none";
  }

  // STEP 1: Deterministic routing for broad/regional questions.
  // If no exact city/country can be geocoded, do not force tool calls. This avoids
  // raw function-call leakage and lets the assistant provide clean general guidance.
  if (userIntent.primaryIntent.type === "weather_inquiry" && (!userIntent.locations || userIntent.locations.length === 0)) {
    console.log("🌤️ Broad weather query without exact location - direct response");
    return "none";
  }

  // Accommodation and weather should use one focused tool when location exists,
  // not broad multi-tool analysis.
  if (userIntent.primaryIntent.type === "weather_inquiry" && userIntent.locations?.length > 0) {
    return { type: "function", function: { name: "comprehensive_weather_analysis" } };
  }

  if (userIntent.primaryIntent.type === "accommodation_search" && userIntent.locations?.length > 0) {
    return { type: "function", function: { name: "smart_accommodation_finder" } };
  }

  // STEP 1: Handle conversation continuations (like "Yes please")
  if (userIntent.isConversationContinuation && context.history.length > 0) {
    const lastAssistantMessage = context.history
      .slice()
      .reverse()
      .find(msg => msg.role === "assistant");

    if (lastAssistantMessage?.content) {
      // Check if continuing a specific topic
      if (lastAssistantMessage.content.toLowerCase().includes("tennis") || 
          lastAssistantMessage.content.toLowerCase().includes("sports")) {
        console.log(`🎾 Continuation: Tennis/sports activity search`);
        return {
          type: "function",
          function: { name: "local_experiences_and_attractions" }
        };
      }
      
      // Check for restaurant recommendations continuation
      if (lastAssistantMessage.content.toLowerCase().includes("restaurant") ||
          lastAssistantMessage.content.toLowerCase().includes("dining")) {
        console.log(`🍽️ Continuation: Restaurant search`);
        return {
          type: "function",
          function: { name: "intelligent_restaurant_discovery" }
        };
      }

      // Check for accommodation continuation
      if (lastAssistantMessage.content.toLowerCase().includes("hotel") ||
          lastAssistantMessage.content.toLowerCase().includes("accommodation")) {
        console.log(`🏨 Continuation: Accommodation search`);
        return {
          type: "function",
          function: { name: "smart_accommodation_finder" }
        };
      }
    }
  }

  // STEP 2: Use the intelligent tool selector
  const toolChoice = IntelligentToolSelector.generateToolChoice(message, userIntent, context);
  if (toolChoice !== "none") {
    return toolChoice;
  }

  // STEP 3: Enhanced fallback logic for edge cases
  // Safety queries ALWAYS get safety intelligence if location present
  if ((lowerMessage.includes("safe") || lowerMessage.includes("security") || 
       lowerMessage.includes("dangerous") || lowerMessage.includes("risk")) && 
       userIntent.locations?.length > 0) {
    console.log(`🚨 Safety keywords detected with location - forcing safety tool`);
    return {
      type: "function",
      function: { name: "comprehensive_safety_intelligence" }
    };
  }

  // Weather queries ALWAYS get weather analysis if location present
  if ((lowerMessage.includes("weather") || lowerMessage.includes("climate") ||
       lowerMessage.includes("temperature") || lowerMessage.includes("forecast")) &&
       userIntent.locations?.length > 0) {
    console.log(`🌤️ Weather keywords detected with location - forcing weather tool`);
    return {
      type: "function",
      function: { name: "comprehensive_weather_analysis" }
    };
  }

  // Activity questions with outdoor context
  if (userIntent.primaryIntent.type === "activity_recommendations" && 
      userIntent.locations?.length > 0) {
    const isOutdoorActivity = [
      "play", "tennis", "golf", "football", "run", "bike", "walk", 
      "hike", "outdoor", "sports", "courts", "facilities"
    ].some(keyword => lowerMessage.includes(keyword));

    const isWeatherDependent = ["today", "tomorrow", "this", "planning", "thinking"].some(keyword =>
      lowerMessage.includes(keyword));

    if (isOutdoorActivity && isWeatherDependent) {
      console.log(`🌤️ Outdoor activity planning detected - using weather analysis for optimal timing`);
      return {
        type: "function",
        function: { name: "comprehensive_weather_analysis" }
      };
    } else if (["where", "courts", "facilities", "venues", "places"].some(keyword =>
        lowerMessage.includes(keyword))) {
      console.log(`📍 Venue search detected - using attractions tool`);
      return {
        type: "function",
        function: { name: "local_experiences_and_attractions" }
      };
    }
  }

  // High-confidence location-based queries should use tools
  if (userIntent.locations?.length > 0 && userIntent.primaryIntent.confidence >= 0.4) {
    console.log(`🌍 Location-based query with medium+ confidence - selecting appropriate tool`);

    // Enhanced keyword-to-tool mapping with context
    const contextualMapping = {
      restaurant: {
        keywords: ["food", "restaurant", "eat", "dining", "cuisine"],
        tool: "intelligent_restaurant_discovery"
      },
      accommodation: {
        keywords: ["hotel", "stay", "accommodation", "lodge", "book"],
        tool: "smart_accommodation_finder"
      },
      culture: {
        keywords: ["culture", "people", "custom", "tradition", "etiquette"],
        tool: "cultural_and_travel_insights"
      },
      activities: {
        keywords: ["activities", "attractions", "things to do", "experience", "visit", "see"],
        tool: "local_experiences_and_attractions"
      }
    };

    // Find best matching category
    for (const [category, config] of Object.entries(contextualMapping)) {
      if (config.keywords.some(keyword => lowerMessage.includes(keyword))) {
        console.log(`🎯 Selected ${config.tool} based on ${category} keywords`);
        return {
          type: "function",
          function: { name: config.tool }
        };
      }
    }

    // Default comprehensive approach for travel planning
    if (["travel to", "visit", "trip to", "going to", "plan"].some(phrase => 
        lowerMessage.includes(phrase))) {
      console.log(`🗺️ Comprehensive travel planning detected - using cultural insights as entry point`);
      return {
        type: "function", 
        function: { name: "cultural_and_travel_insights" }
      };
    }

    // Fallback to cultural insights for general location queries
    console.log(`🏛️ General location query - defaulting to cultural insights`);
    return {
      type: "function",
      function: { name: "cultural_and_travel_insights" }
    };
  }

  // Final fallback - let Groq decide
  console.log(`🤖 No specific tool requirement detected - using auto mode`);
  return "auto";
}

// Enhanced API call with adaptive retry logic
async function callGroqAPIWithRetry(
  message,
  context,
  userIntent,
  maxRetries = 2 // Reduced from 3 to avoid long waits
) {
  let lastError;
  const baseDelay = 2000; // Increased base delay to 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add progressive delay before each attempt (including first)
      if (attempt > 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 2), 8000);
        console.log(`⏳ Rate limit backoff: waiting ${delay}ms before attempt ${attempt}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Even add small delay for first attempt to avoid rapid requests
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));
      }

      const response = await callGroqAPI(message, context, userIntent);

      // Enhanced response validation
      if (!response?.data?.choices?.[0]) {
        throw new Error("Invalid API response structure");
      }

      // Check for content or tool calls
      const choice = response.data.choices[0];
      if (!choice.message?.content && !choice.message?.tool_calls) {
        throw new Error("Empty response from API");
      }

      return response;
    } catch (error) {
      lastError = error;
      console.warn(
        `🔄 Groq API attempt ${attempt}/${maxRetries} failed:`,
        error.message
      );

      // Don't retry certain errors
      if (error.message.includes("401") || error.message.includes("403")) {
        console.log("🚫 Authentication error - not retrying");
        break;
      }

      // For rate limits, provide better logging
      if (error.message.includes("429")) {
        console.log(`🚦 Rate limit hit on attempt ${attempt}/${maxRetries}`);
        
        // If this is the last attempt, provide helpful info
        if (attempt === maxRetries) {
          console.log("🔴 Rate limit exceeded - switching to fallback mode");
        }
      }
    }
  }

  throw lastError;
}

// Helper function to provide intent-based fallback guidance
function getIntentBasedFallback(userIntent, context) {
  const location = userIntent.locations?.[0] || "your destination";
  const label = String(location).replace(/\b\w/g, (char) => char.toUpperCase());

  switch (userIntent.primaryIntent.type) {
    case "safety_inquiry":
      return `**Safety notes for ${label}**\n\nUse normal travel awareness and check official government guidance before making fixed plans. Keep documents secure, use trusted transport and save emergency contacts offline.`;

    case "destination_planning":
      return `**Travel guidance for ${label}**\n\nStart with the purpose of the trip, then choose the area, transport and daily pace around that. Confirm entry rules, weather, accommodation reviews and local transport before booking.`;

    case "weather_inquiry":
      return `**Weather planning for ${label}**\n\nCheck a local hourly forecast before outdoor plans. Pack flexible clothing and leave extra travel time if rain, snow, heat or wind may affect transport.`;

    case "accommodation_search":
      return `**Where to stay in ${label}**\n\nChoose the area first and the property second. Compare recent reviews, total price after fees, cancellation rules, transport access and safety of the surrounding area.`;

    case "dining_recommendations":
      return `**Food and dining in ${label}**\n\nMix one or two well-reviewed local restaurants with convenient options near your stay. Check opening hours, reservation needs and recent reviews before going.`;

    default:
      return `**Travel guidance for ${label}**\n\nCheck entry requirements, weather, accommodation reviews, transport options and local customs before confirming plans. Keep the itinerary flexible if your travel dates are close.`;
  }
}

async function callGroqAPI(message, context, userIntent) {
  try {
    // Wait for our turn to make a request (rate limit prevention)
    await requestQueue.waitForTurn();

    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured");
    }

    // Boost confidence for critical intents
    const enhancedUserIntent = IntelligentToolSelector.boostIntentConfidence(userIntent, message);

    const systemPrompt = {
      role: "system",
      content: responseEngine.enhanceSystemPrompt(enhancedUserIntent, context.history),
    };

    // Clean the conversation history - keep more context for better continuity
    const cleanHistory = context.history
      .map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content.substring(0, 1200) // Increased from 1000
            : msg.content,
      }))
      .slice(-6); // Increased from 4 to 6 for better context

    // Enhanced tool choice with comprehensive logging
    const toolChoice = determineToolChoice(message, enhancedUserIntent, context);
    console.log(`🔧 Tool choice decision: ${JSON.stringify(toolChoice)}`);

    const requestData = {
      model: "llama-3.3-70b-versatile",
      messages: [
        systemPrompt,
        ...cleanHistory,
        { role: "user", content: message },
      ],
      tools: toolService.getTools(),
      tool_choice: toolChoice,
      max_tokens: 3000, // Increased for more detailed responses
      temperature: 0.2, // Slightly more deterministic 
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    };

    console.log(
      `🤖 Calling Groq API with ${
        requestData.messages.length
      } messages, tool_choice: ${JSON.stringify(toolChoice)}`
    );

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      requestData,
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 50000, // Increased timeout
        validateStatus: (status) => status < 500, // Don't throw for 4xx errors
      }
    );

    if (response.status >= 400) {
      throw new Error(
        `API returned ${response.status}: ${response.statusText}`
      );
    }

    return response;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error("Request timeout - please try again");
    }
    if (error.response?.status === 429) {
      throw new Error("Rate limit exceeded");
    }
    if (error.response?.status === 401) {
      throw new Error("Authentication failed");
    }
    throw error;
  }
}

function updateContext(
  context,
  message,
  responseContent,
  userIntent,
  toolsUsed
) {
  try {
    context.history.push(
      { role: "user", content: message },
      {
        role: "assistant",
        content: responseContent,
        intent: userIntent.primaryIntent.type,
        toolsUsed,
        timestamp: new Date().toISOString(),
        confidence: userIntent.primaryIntent.confidence
      }
    );

    // Keep more history for better context - increased from 10 to 12
    if (context.history.length > 12) {
      context.history = context.history.slice(-12);
    }

    // Enhanced user profile learning
    const profile = context.userProfile;
    
    // Update interests based on locations and intent
    if (userIntent.locations && userIntent.locations.length > 0) {
      const currentInterests = profile.interests || [];
      const newInterests = [...currentInterests, ...userIntent.locations];
      profile.interests = [...new Set(newInterests)].slice(0, 25); // Increased from 20
    }

    // Learn from travel context
    if (userIntent.travelContext?.purposes) {
      if (!profile.travelPurposes) profile.travelPurposes = [];
      userIntent.travelContext.purposes.forEach(purpose => {
        if (!profile.travelPurposes.includes(purpose)) {
          profile.travelPurposes.push(purpose);
        }
      });
      profile.travelPurposes = profile.travelPurposes.slice(0, 10);
    }

    // Update preferred response complexity based on user behavior
    if (userIntent.complexity === "high" && toolsUsed.length > 1) {
      profile.preferredComplexity = "high";
    } else if (userIntent.complexity === "low") {
      profile.preferredComplexity = "simple";
    }

    // Track tool preferences
    if (toolsUsed.length > 0) {
      if (!profile.preferredTools) profile.preferredTools = {};
      toolsUsed.forEach(tool => {
        profile.preferredTools[tool] = (profile.preferredTools[tool] || 0) + 1;
      });
    }

  } catch (err) {
    console.error("❌ Context update error:", err.message);
  }
}

function handleAPIError(
  groqError,
  message,
  userIntent,
  context,
  res,
  requestId
) {
  console.error("🛠️ Handling API error:", {
    message: groqError.message,
    status: groqError.response?.status,
    requestId,
  });

  const errorTypes = {
    network: ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT"],
    serviceDown: [503],
    rateLimited: [429],
    unauthorized: [401],
    badRequest: [400],
  };

  // Handle 400 Bad Request errors
  if (errorTypes.badRequest.includes(groqError.response?.status)) {
    console.log("⚠️ Bad request to Groq API - using fallback");
    const fallback = fallbackResponses.generateEnhancedFallback(
      message,
      userIntent
    );
    return res.json({
      result:
        fallback.result,
      tools_used: [],
      context_location: context.currentLocation?.formatted_address || null,
      timestamp: new Date().toISOString(),
      fallback: true,
      requestId,
    });
  }

  // Network issues
  if (errorTypes.network.includes(groqError.code)) {
    console.log("🌐 Network connectivity issue detected");
    const fallback = fallbackResponses.generateEnhancedFallback(
      message,
      userIntent
    );
    return res.json({
      result:
        fallback.result,
      tools_used: [],
      context_location: context.currentLocation?.formatted_address || null,
      timestamp: new Date().toISOString(),
      fallback: true,
      networkIssue: true,
      requestId,
    });
  }

  // Service unavailable
  if (errorTypes.serviceDown.includes(groqError.response?.status)) {
    console.log("⚠️ AI service unavailable");
    const fallback = fallbackResponses.generateEnhancedFallback(
      message,
      userIntent
    );
    return res.json({
      result:
        fallback.result,
      tools_used: [],
      context_location: context.currentLocation?.formatted_address || null,
      timestamp: new Date().toISOString(),
      fallback: true,
      requestId,
    });
  }

  // Rate limited or provider capacity limit. Keep the user-facing answer useful and intent-specific.
  const isRateLimited =
    errorTypes.rateLimited.includes(groqError.response?.status) ||
    /429|too many requests|rate limit/i.test(groqError.message || "");

  if (isRateLimited) {
    console.log("⏰ Provider capacity limit - using intent-aware graceful fallback");
    const fallback = fallbackResponses.generateEnhancedFallback(message, userIntent, {
      reason: "live_data_limited",
    });

    return res.json({
      result: fallback.result,
      tools_used: [],
      timestamp: new Date().toISOString(),
      isError: false,
      rateLimited: true,
      fallback: true,
      intent_detected: userIntent.primaryIntent.type,
      confidence: userIntent.primaryIntent.confidence,
      requestId,
    });
  }

  // Authentication error
  if (errorTypes.unauthorized.includes(groqError.response?.status)) {
    console.error("🔒 Authentication failed");
    return res.status(500).json({
      error: "Authentication error",
      message: "Server configuration issue. Please contact support.",
      requestId,
    });
  }

  // Generic API error - provide fallback
  console.log("🔥 Providing fallback for generic API error");
  const fallback = fallbackResponses.generateEnhancedFallback(
    message,
    userIntent
  );
  return res.json({
    result:
      fallback.result,
    tools_used: [],
    context_location: context.currentLocation?.formatted_address || null,
    timestamp: new Date().toISOString(),
    fallback: true,
    requestId,
  });
}


function buildGracefulToolFallback(message, userIntent, toolCalls = []) {
  // When the data collection step succeeded but the final LLM formatting step is unavailable,
  // do not expose that internal failure. Return an intent-aware, trustworthy answer instead.
  return fallbackResponses.generateEnhancedFallback(message, userIntent, {
    reason: "live_data_limited",
    toolCalls: toolCalls.map((tc) => tc.function?.name).filter(Boolean),
  }).result;
}

// Standalone function for processing tools (FIXED: not a method)
async function processWithTools(
  toolCalls,
  assistantMessage,
  message,
  context,
  userIntent,
  startTime,
  res,
  requestId
) {
  try {
    console.log(
      `🔧 Processing ${toolCalls.length} tool calls for request ${requestId}`
    );

    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall, index) => {
        try {
          console.log(
            `🔧 Executing tool ${index + 1}/${toolCalls.length}: ${
              toolCall.function.name
            } - Request ${requestId}`
          );

          const { name, arguments: args } = toolCall.function;
          let parsedArgs;

          try {
            parsedArgs = JSON.parse(args);
          } catch (parseError) {
            console.error(
              `❌ Failed to parse tool arguments for ${name}:`,
              parseError.message
            );
            return {
              role: "tool",
              tool_call_id: toolCall.id,
              name,
              content: JSON.stringify({
                error: `Invalid tool arguments: ${parseError.message}`,
              }),
            };
          }

          // Intent-aware argument correction. The model can choose a hotel search
          // correctly but still pass a broad budget level. For cheap/budget stay
          // requests, force the accommodation tool toward budget lodging so the
          // final answer does not recommend premium hotels as cheap options.
          if (
            name === "smart_accommodation_finder" &&
            /\b(cheap|budget|affordable|low cost|hostel|guesthouse|guest house|homestay|lowest price)\b/i.test(message)
          ) {
            parsedArgs.budget_category = "$";
            parsedArgs.stay_type = "hostel guesthouse homestay simple hotel";
          }

          // Auto-enhance with location data
          if (
            (name.includes("restaurant") ||
              name.includes("accommodation") ||
              name.includes("experiences")) &&
            !parsedArgs.lat &&
            parsedArgs.location_name
          ) {
            try {
              console.log(
                `📍 Getting location data for: ${parsedArgs.location_name}`
              );
              const locationData = await getLocationData(
                parsedArgs.location_name
              );
              parsedArgs = {
                ...parsedArgs,
                lat: locationData.lat,
                lon: locationData.lon,
                country: locationData.country,
              };
              context.currentLocation = locationData;
              console.log(
                `✅ Location enhanced: ${locationData.formatted_address} - Request ${requestId}`
              );
            } catch (locError) {
              console.warn(
                `⚠️ Location enhancement failed for request ${requestId}:`,
                locError.message
              );
            }
          }

          // For multi-tool requests, enhance with detected location if missing
          if (
            userIntent.locations?.length > 0 &&
            !parsedArgs.location &&
            !parsedArgs.country
          ) {
            const primaryLocation = userIntent.locations[0];
            parsedArgs.location = primaryLocation;
            parsedArgs.country = primaryLocation;
            console.log(
              `📍 Enhanced ${name} with location: ${primaryLocation}`
            );
          }

          // Validate and execute tool
          toolService.validateToolArgs(name, parsedArgs);
          const result = await toolService.executeTool(name, parsedArgs);

          // VALIDATION: Check if tool actually returned useful data
          let toolContent = JSON.stringify(result);
          let hasValidData = false;

          if (result && !result.error) {
            if (name === "local_experiences_and_attractions") {
              hasValidData =
                result.recommendations &&
                Array.isArray(result.recommendations) &&
                result.recommendations.length > 0;
            } else if (name === "intelligent_restaurant_discovery") {
              hasValidData =
                result.restaurants &&
                Array.isArray(result.restaurants) &&
                result.restaurants.length > 0;
            } else if (name === "smart_accommodation_finder") {
              hasValidData =
                result.properties &&
                Array.isArray(result.properties) &&
                result.properties.length > 0;
            } else if (name === "comprehensive_safety_intelligence") {
              hasValidData =
                result.safety_assessment ||
                result.current_situation ||
                !result.error;
            } else if (name === "comprehensive_weather_analysis") {
              hasValidData =
                result.current_conditions ||
                result.forecast_summary ||
                !result.error;
            } else if (name === "cultural_and_travel_insights") {
              hasValidData =
                result.cultural_intelligence ||
                result.practical_tips ||
                !result.error;
            }
          }

          // If no valid data, mark it clearly
          if (!hasValidData) {
            console.warn(`⚠️ Tool ${name} returned no valid data`);
            toolContent = JSON.stringify({
              tool_status: "no_data_available",
              message: `No current data available for ${name}. Please provide fallback guidance.`,
              location:
                parsedArgs.location ||
                parsedArgs.location_name ||
                parsedArgs.country,
              tool_name: name,
            });
          } else {
            console.log(`✅ Tool ${name} returned valid data: ${hasValidData}`);
          }

          console.log(`✅ Tool ${name} executed successfully`);

          return {
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: toolContent,
          };
        } catch (toolError) {
          console.error(
            `❌ Tool ${toolCall.function.name} failed for request ${requestId}:`,
            toolError.message
          );
          return {
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({
              error: `Tool execution failed: ${toolError.message}`,
              suggestion:
                "Please provide complete location information for accurate analysis.",
            }),
          };
        }
      })
    );

    console.log(
      `🔄 Generating final response with tool results for request ${requestId}`
    );

    // Implement progressive delay for rate limit management
    const attemptDelay = Math.min(1000 + (Math.random() * 2000), 3000); // Random 1-3 second delay
    await new Promise(resolve => setTimeout(resolve, attemptDelay));

    // Generate final response with enhanced system prompt and better error handling
    const finalResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: responseEngine
              .enhanceSystemPrompt(userIntent, context.history)
              .substring(0, 1200), // Reduced from 1500 to avoid token limits
          },
          { role: "user", content: message },
          assistantMessage,
          ...toolResults,
        ],
        max_tokens: 2500, // Reduced from 3000 to be more conservative
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 45000, // Reduced from 50000 to 45000
      }
    );

    const finalContent = responseEngine.formatProfessionalResponse(
      finalResponse.data.choices[0].message.content,
      toolCalls.map((tc) => tc.function.name),
      userIntent
    );

    // MONITOR RESPONSE QUALITY - Even for tool-based responses
    const qualityAnalysis = ResponseMonitor.analyzeResponseQuality(
      message,
      userIntent,
      finalContent, 
      toolCalls.map((tc) => tc.function.name),
      context
    );

    // Log the analysis
    ResponseMonitor.logResponseAnalysis(qualityAnalysis, requestId);

    updateContext(
      context,
      message,
      finalContent,
      userIntent,
      toolCalls.map((tc) => tc.function.name)
    );

    console.log(
      `✅ Tool-based response completed successfully for request ${requestId} (Quality Score: ${qualityAnalysis.score}/10)`
    );

    return res.json({
      result: finalContent,
      tools_used: [],
      context_location: context.currentLocation?.formatted_address || null,
      timestamp: new Date().toISOString(),
      intent_analysis: {
        primary_intent: userIntent.primaryIntent.type,
        confidence: userIntent.primaryIntent.confidence,
        complexity: userIntent.complexity,
        urgency: userIntent.urgency,
        multi_tool_strategy:
          userIntent.multiToolRequirements?.shouldUseMultipleTools || false,
      },
      response_metadata: {
        tools_executed: toolCalls.length,
        processing_time: Date.now() - startTime,
        is_multi_tool: toolCalls.length > 1,
      },
      requestId,
    });
  } catch (err) {
    console.error(
      `❌ Tool processing error for request ${requestId}:`,
      err.message
    );

    // Handle rate limit on final response generation
    if (err.response?.status === 429) {
      console.log(
        `⚠️ Rate limit on final response - providing enhanced tool summary for request ${requestId}`
      );

      const enhancedFallbackResponse = responseEngine.formatProfessionalResponse(
        buildGracefulToolFallback(message, userIntent, toolCalls),
        toolCalls.map((tc) => tc.function?.name).filter(Boolean),
        userIntent
      );

      return res.json({
        result: enhancedFallbackResponse,
        tools_used: [],
        context_location: context.currentLocation?.formatted_address || null,
        timestamp: new Date().toISOString(),
        rateLimitedFinalResponse: true,
        toolDataCollected: true,
        intent_analysis: {
          primary_intent: userIntent.primaryIntent.type,
          confidence: userIntent.primaryIntent.confidence,
        },
        response_metadata: {
          tools_executed: toolCalls.length,
          processing_time: Date.now() - startTime,
          data_collection_successful: true
        },
        requestId,
      });
    }

    throw err;
  }
}

// Standalone function for processing direct response (FIXED: not a method)
function processDirectResponse(
  content,
  message,
  context,
  userIntent,
  startTime,
  res,
  requestId
) {
  try {
    console.log(`📝 Processing direct response for request ${requestId}`);

    const enhancedContent = responseEngine.formatProfessionalResponse(
      content,
      [],
      userIntent
    );
    updateContext(context, message, enhancedContent, userIntent, []);

    console.log(
      `✅ Direct response completed successfully for request ${requestId}`
    );

    return res.json({
      result: enhancedContent,
      tools_used: [],
      context_location: context.currentLocation?.formatted_address || null,
      timestamp: new Date().toISOString(),
      intent_analysis: {
        primary_intent: userIntent.primaryIntent.type,
        confidence: userIntent.primaryIntent.confidence,
        complexity: userIntent.complexity,
        urgency: userIntent.urgency,
        multi_tool_strategy:
          userIntent.multiToolRequirements?.shouldUseMultipleTools || false,
      },
      response_metadata: {
        tools_executed: 0,
        processing_time: Date.now() - startTime,
        is_multi_tool: false,
      },
      requestId,
    });
  } catch (err) {
    console.error(
      `❌ Direct response processing error for request ${requestId}:`,
      err.message
    );
    throw err;
  }
}

export const chatController = {
  async handleChat(req, res) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      const { message, userId = "anonymous" } = req.body;

      // Enhanced input validation
      const validationErrors = validateInput(message, userId);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: "Validation failed",
          message: validationErrors.join(", "),
          requestId,
        });
      }

      // Sanitize input
      const sanitizedMessage = sanitizeInput(message);

      console.log(
        `📨 Request ${requestId} - User: ${userId}, Message: "${sanitizedMessage.substring(
          0,
          100
        )}..."`
      );

      // Check API key
      if (!process.env.GROQ_API_KEY) {
        console.error("❌ GROQ_API_KEY not configured");
        return res.status(500).json({
          error: "Configuration error",
          message:
            "Server configuration incomplete. Please contact administrator.",
          requestId,
        });
      }

      // Initialize user context using existing profileUtils
      const context = getOrCreateContext(userId);
      const userIntent = responseEngine.analyzeUserIntent(sanitizedMessage);
      userIntent.originalMessage = sanitizedMessage;

      // DEBUG: Log the intent analysis results
      console.log(`🔍 Intent Analysis Results:`, {
        type: userIntent.primaryIntent.type,
        confidence: userIntent.primaryIntent.confidence,
        locations: userIntent.locations,
        messageAnalyzed: sanitizedMessage.substring(0, 50),
        isSystemIdentity: userIntent.primaryIntent.type === "system_identity"
      });

      // Handle conversation continuations (like "Yes please")
      if (userIntent.isConversationContinuation && context.history.length > 0) {
        console.log(
          `💬 Conversation continuation detected for request ${requestId}`
        );

        // Get the last assistant message to understand context
        const lastAssistantMessage = context.history
          .slice()
          .reverse()
          .find((msg) => msg.role === "assistant");

        if (lastAssistantMessage && lastAssistantMessage.content) {
          // Check if the last message was asking for recommendations
          const wasAskingForRecommendations = [
            "recommend",
            "would you like",
            "looking for",
            "tennis courts",
            "facilities",
            "interested in"
          ].some((phrase) =>
            lastAssistantMessage.content.toLowerCase().includes(phrase)
          );

          if (wasAskingForRecommendations) {
            console.log(`🎾 Continuing ${lastAssistantMessage.intent || 'recommendation'} search context`);

            // Extract location from conversation history
            let location = null;
            const lastUserMessage = context.history
              .slice()
              .reverse()
              .find((msg) => msg.role === "user");

            if (lastUserMessage) {
              const extractedLocations = responseEngine.extractLocations(
                lastUserMessage.content
              );
              location =
                extractedLocations[0] ||
                context.currentLocation?.formatted_address;
            }

            if (location) {
              // Modify the user intent based on previous context
              userIntent.primaryIntent = {
                type: lastAssistantMessage.intent || "activity_recommendations",
                confidence: 0.9,
              };
              userIntent.locations = [location];
              userIntent.travelContext = {
                type: "continuation",
                indicators: ["continuation"],
              };
              console.log(
                `📍 Modified intent for continuation search in ${location}`
              );
            }
          }
        }
      }

      console.log(
        `🎯 Intent Analysis - Type: ${userIntent.primaryIntent.type}, Confidence: ${userIntent.primaryIntent.confidence}, Complexity: ${userIntent.complexity}, Multi-tool: ${userIntent.multiToolRequirements?.shouldUseMultipleTools || false}`
      );

      // SPECIAL HANDLING: Identity questions get immediate direct response
      if (userIntent.primaryIntent.type === "system_identity") {
        console.log(`🤖 PROCESSING IDENTITY QUESTION DIRECTLY`);
        
        const identityResponse = `**I am ATLAS** - Advanced Travel & Location Assistant System.

**I was created by Subin Khatiwada**, a talented Mechatronics Engineer and Full-Stack Developer based in Finland.

**ABOUT MY CREATOR - SUBIN KHATIWADA:**

**PROFESSIONAL BACKGROUND:**
• Mechatronics Engineer specializing in mechanical design, control systems, and software development
• Currently pursuing Master of Science (MSc) in Mechatronics System Engineering at Lappeenranta-Lahti University of Technology (LUT)
• Bachelor of Engineering in Mechanical Engineering & Production Technology from Häme University of Applied Sciences
• Former Business Owner & Partner at Subimala Oy (2020-2023)

**TECHNICAL EXPERTISE:**
• Full-Stack Web Development (MERN stack, PostgreSQL, Docker, Kubernetes, AWS)
• Machine Learning and Data Analysis (Python, RNN, CNN, Transformer architectures)
• Programming and Software Development (Python, MATLAB, JavaScript, TypeScript)
• Mechanical Systems Design (CREO, SolidWorks, CAD modeling)

**CURRENT WORK & RESEARCH:**
• Developing control system models for mechatronic machines
• Building machine learning models including deep learning architectures
• Working on hydraulic crane modeling with SolidWorks and Simscape Multibody simulation
• Forecasting models for large sequential data analysis

**CONTACT INFORMATION:**
• Email: subinkhatiwada@gmail.com
• Phone: (+358) 445509013
• Location: Riihimaki, Finland
• LinkedIn: https://www.linkedin.com/in/subin-khatiwada-0278282a4/
• GitHub: https://github.com/Sub1nn

**MY CAPABILITIES:**
• Real-time safety and security intelligence
• Comprehensive weather analysis and forecasting
• Smart accommodation and restaurant discovery
• Cultural insights and travel etiquette guidance
• Local experiences and attraction recommendations
• Multi-tool analysis for complex travel planning

Subin's diverse background in mechatronics, AI/ML, and full-stack development enabled him to create me as a sophisticated travel intelligence system.`;

        updateContext(context, sanitizedMessage, identityResponse, userIntent, []);
        
        return res.json({
          result: identityResponse,
          tools_used: [],
          context_location: null,
          timestamp: new Date().toISOString(),
          intent_analysis: {
            primary_intent: "system_identity",
            confidence: 1.0,
            complexity: "low",
            urgency: "normal"
          },
          response_metadata: {
            tools_executed: 0,
            processing_time: Date.now() - startTime,
            is_identity_response: true
          },
          requestId,
        });
      }

      // Log multi-tool requirements
      if (userIntent.multiToolRequirements?.shouldUseMultipleTools) {
        console.log(
          `🔧 Multi-tool requirements: ${JSON.stringify(
            userIntent.multiToolRequirements
          )}`
        );
      }

      try {
        const response = await callGroqAPIWithRetry(
          sanitizedMessage,
          context,
          userIntent
        );
        const assistantMessage = response.data.choices[0]?.message;
        const toolCalls = assistantMessage?.tool_calls;

        console.log(
          `📊 Groq response received for ${requestId}. Tool calls: ${
            toolCalls?.length || 0
          }`
        );

        if (toolCalls?.length > 0) {
          // FIXED: Call standalone function instead of this.processWithTools
          return await processWithTools(
            toolCalls,
            assistantMessage,
            sanitizedMessage,
            context,
            userIntent,
            startTime,
            res,
            requestId
          );
        } else {
          // If multi-tool was expected but no tools called, this is an issue
          if (userIntent.multiToolRequirements?.shouldUseMultipleTools) {
            console.log(
              "⚠️ Multi-tool expected but no tools called - using fallback"
            );

            const fallback = fallbackResponses.generateEnhancedFallback(
              sanitizedMessage,
              userIntent
            );

            return res.json({
              result:
                fallback.result +
                "\n\n*Note: Comprehensive analysis temporarily unavailable. Basic guidance provided.*",
              tools_used: [],
              context_location:
                context.currentLocation?.formatted_address || null,
              timestamp: new Date().toISOString(),
              fallback: true,
              expectedMultiTool: true,
              requestId,
            });
          }

          // Check if we expected tools but didn't get them
          if (userIntent.primaryIntent.confidence > 0.7 && userIntent.locations?.length > 0) {
            console.log("⚠️ High confidence location query without tools - potential missed opportunity");
          }

          // FIXED: Call standalone function instead of this.processDirectResponse
          return processDirectResponse(
            assistantMessage.content,
            sanitizedMessage,
            context,
            userIntent,
            startTime,
            res,
            requestId
          );
        }
      } catch (groqError) {
        console.error("❌ Groq API Error Details:", {
          message: groqError.message,
          code: groqError.code,
          status: groqError.response?.status,
          statusText: groqError.response?.statusText,
          data: groqError.response?.data,
          requestId,
        });
        return handleAPIError(
          groqError,
          sanitizedMessage,
          userIntent,
          context,
          res,
          requestId
        );
      }
    } catch (err) {
      console.error("❌ Chat handler critical error:", {
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        userId: req.body?.userId,
        messageLength: req.body?.message?.length,
        requestId,
      });
      return res.status(500).json({
        error: "Internal server error",
        message:
          "I'm experiencing technical difficulties. Please try again in a moment.",
        timestamp: new Date().toISOString(),
        requestId,
        ...(process.env.NODE_ENV === "development" && { debug: err.message }),
      });
    }
  },

  async resetContext(req, res) {
    try {
      const { userId } = req.body;

      if (userId) {
        if (conversationContext.has(userId)) {
          conversationContext.delete(userId);
          console.log(`🔄 Context reset for user: ${userId}`);
          res.json({
            message: `Context reset for user ${userId}`,
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(404).json({
            error: "User context not found",
            message: `No context found for user ${userId}`,
          });
        }
      } else {
        const count = conversationContext.size;
        conversationContext.clear();
        console.log(`🔄 All contexts cleared (${count} contexts)`);
        res.json({
          message: "All contexts cleared",
          count,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("❌ Reset context error:", err.message);
      res.status(500).json({
        error: "Failed to reset context",
        message: "Unable to reset conversation context",
      });
    }
  },

  async getContext(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          error: "User ID required",
          message: "Please provide a user ID",
        });
      }

      const context = conversationContext.get(userId);
      if (!context) {
        return res.status(404).json({
          error: "Context not found",
          message: `No context found for user ${userId}`,
        });
      }

      res.json({
        userId,
        context: {
          messageCount: context.history.length,
          currentLocation: context.currentLocation,
          userProfile: context.userProfile,
          lastActivity: new Date(context.lastActive).toISOString(),
          requestCount: context.requestCount || 0,
        },
      });
    } catch (err) {
      console.error("❌ Get context error:", err.message);
      res.status(500).json({
        error: "Failed to get context",
        message: "Unable to retrieve conversation context",
      });
    }
  },

  // Enhanced system stats using existing conversationContext
  async getSystemStats(req, res) {
    try {
      const memoryUsage = process.memoryUsage();
      const contexts = Array.from(conversationContext.values());
      const now = Date.now();

      const stats = {
        system: "ATLAS Travel Assistant",
        status: "operational",
        contexts: {
          total: conversationContext.size,
          activeToday: contexts.filter(
            (context) => now - context.lastActive < 24 * 60 * 60 * 1000
          ).length,
          activeThisHour: contexts.filter(
            (context) => now - context.lastActive < 60 * 60 * 1000
          ).length,
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
          usage:
            Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) +
            "%",
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
        },
        uptime: Math.floor(process.uptime()) + " seconds",
        environment: process.env.NODE_ENV || "development",
        node_version: process.version,
        timestamp: new Date().toISOString(),
        api_keys_configured: {
          groq: !!process.env.GROQ_API_KEY,
          openweather: !!process.env.OPEN_WEATHER_KEY,
          yelp: !!process.env.YELP_API_KEY,
          news: !!process.env.NEWS_API_KEY,
          google: !!process.env.GOOGLE_API_KEY,
        },
      };

      res.json(stats);
    } catch (err) {
      console.error("❌ Stats error:", err.message);
      res.status(500).json({
        error: "Failed to get system stats",
        message: "Unable to retrieve system statistics",
      });
    }
  },

  // NEW: Get response quality analytics
  async getQualityAnalytics(req, res) {
    try {
      const report = ResponseMonitor.getAnalyticsReport();
      
      if (!report) {
        return res.json({
          message: "No response data available yet",
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        ...report,
        timestamp: new Date().toISOString(),
        recommendations: this.generateQualityRecommendations(report)
      });
    } catch (err) {
      console.error("Quality analytics error:", err.message);
      res.status(500).json({
        error: "Failed to get quality analytics",
        message: "Unable to retrieve response quality data"
      });
    }
  },

  // Helper method for quality recommendations
  generateQualityRecommendations(report) {
    const recommendations = [];

    // Check if too many responses don't use tools
    const noToolResponses = report.tool_usage[0] || 0;
    const totalResponses = report.total_responses;
    
    if (noToolResponses / totalResponses > 0.3) {
      recommendations.push({
        type: "INCREASE_TOOL_USAGE",
        message: `${Math.round(noToolResponses / totalResponses * 100)}% of responses don't use tools. Consider lowering confidence thresholds.`,
        priority: "HIGH"
      });
    }

    // Check average quality score
    if (report.average_score < 6) {
      recommendations.push({
        type: "IMPROVE_RESPONSE_QUALITY", 
        message: `Average quality score is ${report.average_score.toFixed(1)}/10. Review system prompts and tool selection logic.`,
        priority: "HIGH"
      });
    }

    // Check for frequent issues
    Object.entries(report.issue_frequency).forEach(([issueType, frequency]) => {
      if (frequency > totalResponses * 0.2) {
        recommendations.push({
          type: "FREQUENT_ISSUE",
          message: `Issue "${issueType}" occurs in ${Math.round(frequency / totalResponses * 100)}% of responses`,
          priority: "MEDIUM"
        });
      }
    });

    return recommendations;
  },
};