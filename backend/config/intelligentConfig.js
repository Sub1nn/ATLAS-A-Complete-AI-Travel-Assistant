export const intelligentConfig = {
  // Tool forcing thresholds
  TOOL_CONFIDENCE_THRESHOLDS: {
    FORCE_TOOL: 0.7, // Above this, always force tool usage
    PREFER_TOOL: 0.5, // Above this, prefer tools over direct response
    CONSIDER_TOOL: 0.3, // Above this, consider tools if location present
    NO_TOOL: 0.2, // Below this, likely direct response
  },

  // Intent-specific configurations
  INTENT_CONFIGS: {
    system_identity: {
      always_use_tools: false,
      required_context: [],
      fallback_allowed: false,
      confidence_boost: 0.0, // No boost needed for identity questions
    },
    safety_inquiry: {
      always_use_tools: true,
      required_context: ["location", "country"],
      fallback_allowed: false,
      confidence_boost: 0.2, // Boost confidence for safety queries
    },
    destination_planning: {
      always_use_tools: true,
      required_context: ["location"],
      fallback_allowed: true,
      // Do not force multi-tool for every destination question. Forced multi-tool
      // often produces broad, unfocused answers. Use it only for explicit complex requests.
      multi_tool_preferred: false,
    },
    weather_inquiry: {
      always_use_tools: true,
      required_context: ["location"],
      fallback_allowed: false,
    },
    accommodation_search: {
      always_use_tools: true,
      required_context: ["location"],
      fallback_allowed: true,
    },
    dining_recommendations: {
      always_use_tools: true,
      required_context: ["location"],
      fallback_allowed: true,
    },
    cultural_inquiry: {
      always_use_tools: false, // Can provide general advice
      required_context: ["location"],
      fallback_allowed: true,
    },
    activity_recommendations: {
      always_use_tools: true,
      required_context: ["location"],
      fallback_allowed: true,
    },
  },

  // Keywords that should ALWAYS trigger tools
  FORCE_TOOL_KEYWORDS: [
    "current",
    "now",
    "today",
    "this week",
    "real-time",
    "latest",
    "recommend",
    "find",
    "search",
    "locate",
    "where",
    "safety",
    "security",
    "dangerous",
    "risk",
    "weather",
    "forecast",
    "temperature",
    "climate",
    "restaurant",
    "hotel",
    "accommodation",
    "stay",
  ],

  // Location indicators that boost tool usage
  LOCATION_INDICATORS: [
    "in ",
    "at ",
    "near ",
    "around ",
    "to ",
    "visiting ",
    "traveling to ",
    "going to ",
    "trip to ",
    "vacation in ",
  ],

  // Multi-tool trigger patterns
  MULTI_TOOL_PATTERNS: [
    /plan.*trip.*to/i,
    /comprehensive.*analysis/i,
    /everything.*about/i,
    /complete.*guide/i,
    /tell me about.*visit/i,
    /traveling.*need.*know/i,
  ],

  // Response quality indicators
  QUALITY_INDICATORS: {
    PROFESSIONAL: ["intelligence", "analysis", "assessment", "comprehensive"],
    SPECIFIC: ["specific", "detailed", "exact", "precise"],
    ACTIONABLE: ["recommend", "suggest", "should", "consider"],
  },
};

// Enhanced tool selection logic
export class IntelligentToolSelector {
  static shouldForceTools(message, userIntent) {
    const lowerMessage = message.toLowerCase();

    // Check force keywords. Generic words such as "recommend" should not force
    // tools by themselves unless a location/tool-dependent topic is present.
    const hasForceKeywords = intelligentConfig.FORCE_TOOL_KEYWORDS.some(
      (keyword) => lowerMessage.includes(keyword)
    );

    // Regional/general weather questions such as "Southeast Asia weather" can be
    // answered cleanly without forcing a tool call when no precise city is known.
    if (userIntent.primaryIntent.type === "weather_inquiry" && !userIntent.locations?.length) {
      return false;
    }

    // Check intent configuration
    const intentConfig =
      intelligentConfig.INTENT_CONFIGS[userIntent.primaryIntent.type];
    const shouldAlwaysUseTools = intentConfig?.always_use_tools || false;

    // Check confidence threshold
    const highConfidence =
      userIntent.primaryIntent.confidence >=
      intelligentConfig.TOOL_CONFIDENCE_THRESHOLDS.FORCE_TOOL;

    // Check location presence for location-dependent intents
    const hasRequiredContext = this.hasRequiredContext(
      userIntent,
      intentConfig
    );

    return (
      (hasForceKeywords || shouldAlwaysUseTools || highConfidence) &&
      hasRequiredContext
    );
  }

  static hasRequiredContext(userIntent, intentConfig) {
    if (!intentConfig?.required_context) return true;

    return intentConfig.required_context.every((context) => {
      switch (context) {
        case "location":
          return userIntent.locations && userIntent.locations.length > 0;
        case "country":
          return userIntent.locations && userIntent.locations.length > 0;
        default:
          return true;
      }
    });
  }

  static shouldUseMultipleTools(message, userIntent) {
    const lowerMessage = message.toLowerCase();

    // Check multi-tool patterns
    const hasMultiToolPattern = intelligentConfig.MULTI_TOOL_PATTERNS.some(
      (pattern) => pattern.test(message)
    );

    // Check intent configuration
    const intentConfig =
      intelligentConfig.INTENT_CONFIGS[userIntent.primaryIntent.type];
    const multiToolPreferred = intentConfig?.multi_tool_preferred || false;

    // Check complexity
    const isComplex = userIntent.complexity === "high";

    // Check multiple high-confidence intents
    const highConfidenceIntents = Object.values(
      userIntent.allIntents || {}
    ).filter((intent) => intent.confidence > 0.4).length;

    return (
      hasMultiToolPattern ||
      (multiToolPreferred && (isComplex || highConfidenceIntents > 1)) ||
      isComplex ||
      highConfidenceIntents > 1
    );
  }

  static selectOptimalTool(userIntent, message, context) {
    const lowerMessage = message.toLowerCase();
    const intentType = userIntent.primaryIntent.type;

    // Direct mapping for high-confidence intents
    const toolMapping = {
      safety_inquiry: "comprehensive_safety_intelligence",
      weather_inquiry: "comprehensive_weather_analysis",
      dining_recommendations: "intelligent_restaurant_discovery",
      accommodation_search: "smart_accommodation_finder",
      cultural_inquiry: "cultural_and_travel_insights",
      activity_recommendations: "local_experiences_and_attractions",
    };

    // Context-aware tool selection
    if (toolMapping[intentType]) {
      // Special cases for activity recommendations
      if (intentType === "activity_recommendations") {
        const isWeatherDependent = [
          "outdoor",
          "weather",
          "today",
          "tomorrow",
        ].some((keyword) => lowerMessage.includes(keyword));

        if (isWeatherDependent) {
          return "comprehensive_weather_analysis";
        }
      }

      return toolMapping[intentType];
    }

    // Fallback tool selection based on keywords
    if (lowerMessage.includes("safe") || lowerMessage.includes("security")) {
      return "comprehensive_safety_intelligence";
    }
    if (lowerMessage.includes("weather") || lowerMessage.includes("climate")) {
      return "comprehensive_weather_analysis";
    }
    if (lowerMessage.includes("food") || lowerMessage.includes("restaurant")) {
      return "intelligent_restaurant_discovery";
    }
    if (lowerMessage.includes("hotel") || lowerMessage.includes("stay")) {
      return "smart_accommodation_finder";
    }
    if (lowerMessage.includes("culture") || lowerMessage.includes("custom")) {
      return "cultural_and_travel_insights";
    }

    // Default for location-based queries
    return "cultural_and_travel_insights";
  }

  static generateToolChoice(message, userIntent, context) {
    // Force tools if conditions met
    if (this.shouldForceTools(message, userIntent)) {
      if (this.shouldUseMultipleTools(message, userIntent)) {
        console.log("🔧 Forcing multi-tool analysis");
        return "required";
      } else {
        const selectedTool = this.selectOptimalTool(
          userIntent,
          message,
          context
        );
        console.log(`🎯 Forcing specific tool: ${selectedTool}`);
        return {
          type: "function",
          function: { name: selectedTool },
        };
      }
    }

    // Prefer tools for medium confidence with location
    if (
      userIntent.primaryIntent.confidence >=
        intelligentConfig.TOOL_CONFIDENCE_THRESHOLDS.PREFER_TOOL &&
      userIntent.locations?.length > 0
    ) {
      const selectedTool = this.selectOptimalTool(userIntent, message, context);
      console.log(`🎯 Preferring tool: ${selectedTool}`);
      return {
        type: "function",
        function: { name: selectedTool },
      };
    }

    // Consider tools for lower confidence but with location
    if (
      userIntent.primaryIntent.confidence >=
        intelligentConfig.TOOL_CONFIDENCE_THRESHOLDS.CONSIDER_TOOL &&
      userIntent.locations?.length > 0
    ) {
      console.log("⚖️ Considering tools - using auto mode");
      return "auto";
    }

    // No tools needed
    console.log("💬 Direct response appropriate");
    return "none";
  }

  static boostIntentConfidence(userIntent, message) {
    const intentConfig =
      intelligentConfig.INTENT_CONFIGS[userIntent.primaryIntent.type];
    if (intentConfig?.confidence_boost) {
      const originalConfidence = userIntent.primaryIntent.confidence;
      userIntent.primaryIntent.confidence = Math.min(
        1.0,
        originalConfidence + intentConfig.confidence_boost
      );
      console.log(
        `🚀 Boosted ${userIntent.primaryIntent.type} confidence: ${originalConfidence} -> ${userIntent.primaryIntent.confidence}`
      );
    }
    return userIntent;
  }
}

// Response quality validator
export class ResponseQualityValidator {
  static validateResponseQuality(response, userIntent, toolsUsed) {
    const quality = {
      isProfessional: false,
      isSpecific: false,
      isActionable: false,
      score: 0,
    };

    const lowerResponse = response.toLowerCase();

    // Check professional language
    quality.isProfessional =
      intelligentConfig.QUALITY_INDICATORS.PROFESSIONAL.some((indicator) =>
        lowerResponse.includes(indicator)
      );

    // Check specificity
    quality.isSpecific =
      intelligentConfig.QUALITY_INDICATORS.SPECIFIC.some((indicator) =>
        lowerResponse.includes(indicator)
      ) || toolsUsed.length > 0;

    // Check actionability
    quality.isActionable = intelligentConfig.QUALITY_INDICATORS.ACTIONABLE.some(
      (indicator) => lowerResponse.includes(indicator)
    );

    // Calculate score
    quality.score =
      (quality.isProfessional ? 1 : 0) +
      (quality.isSpecific ? 1 : 0) +
      (quality.isActionable ? 1 : 0);

    // Add bonus for tool usage
    if (toolsUsed.length > 0) {
      quality.score += 1;
    }

    return quality;
  }

  static shouldRetryWithTools(response, userIntent, toolsUsed) {
    const quality = this.validateResponseQuality(
      response,
      userIntent,
      toolsUsed
    );

    // If no tools used and quality is low for location-based query
    if (
      toolsUsed.length === 0 &&
      quality.score < 2 &&
      userIntent.locations?.length > 0
    ) {
      return true;
    }

    // If expected tools but got generic response
    const intentConfig =
      intelligentConfig.INTENT_CONFIGS[userIntent.primaryIntent.type];
    if (intentConfig?.always_use_tools && toolsUsed.length === 0) {
      return true;
    }

    return false;
  }
}
