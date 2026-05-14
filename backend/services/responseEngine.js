import { systemPrompts } from "../utils/systemPrompts.js";

const INTENT_DEFINITIONS = {
  system_identity: {
    keywords: [
      "who are you",
      "what are you",
      "who created you",
      "who made you",
      "who built you",
      "who developed you",
      "what is atlas",
      "about atlas",
      "your creator",
      "your developer",
      "tell me about yourself",
      "creator name",
      "name of your creator",
      "who is your creator",
      "created by who",
      "made by whom",
    ],
    type: "system_identity",
    priority_keywords: [
      "who are you",
      "what are you",
      "who created",
      "creator name",
      "your creator",
    ],
    context_keywords: ["atlas", "system", "ai", "name"],
    weight: 3.0, // High weight to ensure identity questions are caught
  },
  safety: {
    keywords: [
      "safe",
      "safety",
      "security",
      "dangerous",
      "risk",
      "threat",
      "war",
      "conflict",
      "crime",
      "violence",
      "threat level",
      "advisories",
    ],
    type: "safety_inquiry",
    priority_keywords: ["safe", "security", "dangerous", "risk"],
    context_keywords: ["travel", "visit", "going"],
    weight: 2.0,
  },
  destination_planning: {
    keywords: [
      "travel to",
      "visit",
      "trip to",
      "going to",
      "plan",
      "itinerary",
      "destination",
      "explore",
      "tour",
      "vacation",
      "holiday",
    ],
    type: "destination_planning",
    priority_keywords: ["travel", "visit", "trip", "plan"],
    context_keywords: ["next week", "next month", "planning"],
    weight: 1.5,
  },
  accommodation: {
    keywords: [
      "hotel",
      "stay",
      "accommodation",
      "lodge",
      "resort",
      "hostel",
      "airbnb",
      "booking",
      "where to stay",
      "place to stay",
    ],
    type: "accommodation_search",
    priority_keywords: ["hotel", "stay", "accommodation"],
    context_keywords: ["book", "reservation", "night"],
    weight: 1.8,
  },
  dining: {
    keywords: [
      "restaurant",
      "food",
      "eat",
      "cuisine",
      "dining",
      "meal",
      "lunch",
      "dinner",
      "breakfast",
      "where to eat",
    ],
    type: "dining_recommendations",
    priority_keywords: ["restaurant", "food", "eat"],
    context_keywords: ["traditional", "local", "best"],
    weight: 1.6,
  },
  cultural: {
    keywords: [
      "culture",
      "custom",
      "tradition",
      "etiquette",
      "language",
      "religion",
      "festival",
      "local people",
      "customs",
    ],
    type: "cultural_inquiry",
    priority_keywords: ["culture", "custom", "tradition"],
    context_keywords: ["respect", "appropriate", "should"],
    weight: 1.4,
  },
  weather: {
    keywords: [
      "weather",
      "climate",
      "temperature",
      "rain",
      "sunny",
      "forecast",
      "conditions",
      "season",
      "hot",
      "cold",
      "humid",
    ],
    type: "weather_inquiry",
    priority_keywords: ["weather", "climate", "forecast"],
    context_keywords: ["today", "tomorrow", "this week"],
    weight: 1.7,
  },
  activities: {
    keywords: [
      "activities",
      "attractions",
      "sightseeing",
      "experience",
      "tour",
      "adventure",
      "things to do",
      "places to visit",
      "entertainment",
      "tennis",
      "sports",
      "courts",
      "facilities",
      "venues",
    ],
    type: "activity_recommendations",
    priority_keywords: ["activities", "attractions", "things to do"],
    context_keywords: ["fun", "interesting", "must see"],
    weight: 1.5,
  },
  logistics: {
    keywords: [
      "visa",
      "passport",
      "currency",
      "transport",
      "flight",
      "airport",
      "border",
      "documents",
      "requirements",
      "entry",
    ],
    type: "travel_logistics",
    priority_keywords: ["visa", "passport", "documents"],
    context_keywords: ["need", "required", "must"],
    weight: 1.3,
  },
};

const LOCATION_PATTERNS = [
  /\b(palestine|israel|west bank|gaza|middle east|afghanistan|albania|algeria|argentina|armenia|australia|austria|azerbaijan|bahrain|bangladesh|belarus|belgium|bolivia|bosnia|brazil|bulgaria|cambodia|canada|chile|china|colombia|croatia|cyprus|czechia|denmark|ecuador|egypt|estonia|ethiopia|finland|france|georgia|germany|ghana|greece|guatemala|hungary|iceland|india|indonesia|iran|iraq|ireland|italy|japan|jordan|kazakhstan|kenya|kuwait|kyrgyzstan|latvia|lebanon|libya|lithuania|luxembourg|malaysia|maldives|malta|mexico|moldova|mongolia|montenegro|morocco|myanmar|nepal|netherlands|norway|oman|pakistan|panama|peru|philippines|poland|portugal|qatar|romania|russia|saudi arabia|serbia|singapore|slovakia|slovenia|south africa|south korea|spain|sri lanka|sweden|switzerland|syria|taiwan|tajikistan|thailand|tunisia|turkey|ukraine|united arab emirates|united kingdom|united states|uruguay|uzbekistan|venezuela|vietnam|yemen|zimbabwe)\b/gi,
  /\b(tokyo|paris|london|new york|bangkok|berlin|rome|madrid|barcelona|amsterdam|dubai|singapore|hong kong|sydney|melbourne|toronto|vancouver|los angeles|san francisco|miami|chicago|boston|seattle|helsinki|stockholm|oslo|copenhagen|prague|vienna|zurich|geneva|brussels|budapest|warsaw|krakow|lisbon|porto|dublin|edinburgh|glasgow|manchester|birmingham|liverpool|mumbai|delhi|bangalore|kolkata|chennai|hyderabad|pune|ahmedabad|jaipur|istanbul|ankara|cairo|casablanca|marrakech|jerusalem|tel aviv|ramallah|bethlehem|nablus|hebron)\b/gi,
];

// Conversation continuation patterns
const CONTINUATION_PATTERNS = [
  /^(yes|yeah|yep|sure|ok|okay|please|go ahead|continue|tell me more|that would be great)$/i,
  /^(yes please|yeah please|sure thing|sounds good|perfect)$/i,
  /^(do it|let's do it|let's go|proceed)$/i,
];

const FALLBACK_PROMPT = `You are ATLAS, a professional travel planning assistant. Write concise, useful travel guidance in a calm human tone. Do not mention internal tools, APIs, model names, rate limits, backend systems, tokens or system capacity. Do not claim live prices or availability unless the data explicitly includes them. If price data is missing, say that live prices cannot be verified and provide approximate ranges only as general guidance. Avoid tourism-brochure language. Start with practical advice and use clear headings.`;


function lower(value = "") {
  return String(value || "").toLowerCase();
}

function hasAny(text = "", words = []) {
  const value = lower(text);
  return words.some((word) => value.includes(word));
}

function normalizeDestinationName(value = "") {
  if (!value) return "your destination";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getIntentPriorityProfile(message = "", userIntent = {}) {
  const value = lower(message);
  const indicators = userIntent.travelContext?.indicators || [];
  const purposes = userIntent.travelContext?.purposes || [];
  const primary = userIntent.primaryIntent?.type || "destination_planning";

  const budget = hasAny(value, ["cheap", "budget", "affordable", "low cost", "hostel", "guesthouse", "guest house", "homestay", "lowest price"]) || indicators.includes("budget_conscious");
  const livePrices = hasAny(value, ["live price", "live prices", "realtime", "real-time", "real time", "current price", "availability", "booking"]);
  const family = hasAny(value, ["family", "kids", "children", "baby", "parents"]) || indicators.includes("family_travel") || purposes.includes("family");
  const business = hasAny(value, ["business", "work", "meeting", "conference", "client", "professional"]) || purposes.includes("business");
  const trekking = hasAny(value, ["trek", "trekking", "hiking", "mountain", "trail", "base camp"]);
  const accommodation = primary === "accommodation_search" || hasAny(value, ["hotel", "stay", "accommodation", "hostel", "guesthouse", "where to stay"]);
  const weather = primary === "weather_inquiry" || hasAny(value, ["weather", "rain", "forecast", "temperature", "climate"]);
  const safety = primary === "safety_inquiry" || hasAny(value, ["safe", "safety", "risk", "danger", "security"]);
  const dining = primary === "dining_recommendations" || hasAny(value, ["food", "restaurant", "eat", "dining", "cuisine"]);

  let orderedSections = ["Best approach", "Where to stay", "Budget guidance", "Weather", "Practical tips"];

  if (accommodation) orderedSections = ["Best area to stay", "Budget guidance", "Recommended stay types", "Booking checks", "Practical tips"];
  if (business) orderedSections = ["Best approach", "Business etiquette", "Where to stay", "Transport and timing", "Practical checks"];
  if (family) orderedSections = ["Best approach", "Family-friendly stay areas", "Daily pace", "Safety and comfort", "Practical tips"];
  if (trekking) orderedSections = ["Best approach", "Weather and route checks", "Permits and safety", "Gear", "Practical tips"];
  if (weather && !accommodation) orderedSections = ["Weather overview", "What to wear", "Outdoor planning", "Transport impact", "Practical tips"];
  if (safety && !accommodation) orderedSections = ["Safety overview", "Main precautions", "Areas and movement", "Emergency preparation", "Practical tips"];
  if (dining && !accommodation) orderedSections = ["Best approach", "What to try", "Where to eat", "Food safety", "Practical tips"];

  return { budget, livePrices, family, business, trekking, accommodation, weather, safety, dining, orderedSections };
}

function stripLuxuryBudgetMismatches(text = "") {
  const luxuryNames = [
    "Hotel Shanker",
    "The Soaltee",
    "Soaltee Kathmandu",
    "Autograph Collection",
    "Radisson Hotel Kathmandu",
    "Hotel Himalaya",
    "Hyatt",
    "Marriott",
    "Hilton",
    "Sheraton",
    "InterContinental",
  ];

  let output = text;
  for (const name of luxuryNames) {
    const linePattern = new RegExp(`^\\s*(?:[•\\-*]\\s*)?.*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "gim");
    output = output.replace(linePattern, "");
  }
  return output.replace(/\n{3,}/g, "\n\n").trim();
}


function stripRawToolLeakage(text = "") {
  return String(text || "")
    // OpenAI/Groq function-call style leakage
    .replace(/<function\s*=\s*[^>]+>[\s\S]*?<\/function>/gi, "")
    .replace(/<function[\s\S]*?>[\s\S]*?<\/function>/gi, "")
    .replace(/<tool_call[\s\S]*?>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool-use[\s\S]*?>[\s\S]*?<\/tool-use>/gi, "")
    .replace(/```(?:json|tool-use|tool_call)?[\s\S]*?(?:"tool_calls"|"function"|<function=)[\s\S]*?```/gi, "")
    .replace(/\{\s*"(?:tool_calls|function_call|name|arguments)"[\s\S]*?\}\s*/gi, "")
    // Remove sentences that introduce hidden/internal calls.
    .replace(/(?:To get|For more|I can use|Let me use|I will use|I would use)[^.\n]*(?:function|tool|analysis)[^.\n]*\.?/gi, "")
    .replace(/Here is the tool call[^.\n]*\.?/gi, "")
    .replace(/I need to call[^.\n]*\.?/gi, "")
    .replace(/\bfunction\s*=\s*[a-zA-Z0-9_]+\b/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getPrimaryQuestionIntent(message = "", currentIntent = "destination_planning") {
  const value = lower(message);
  const checks = [
    { type: "weather_inquiry", words: ["weather", "forecast", "temperature", "rain", "monsoon", "climate", "humid", "season"] },
    { type: "accommodation_search", words: ["accommodation", "hotel", "hostel", "guesthouse", "guest house", "homestay", "where to stay", "stay", "room", "booking", "live price", "prices"] },
    { type: "safety_inquiry", words: ["safe", "safety", "security", "risk", "danger", "advisory", "crime"] },
    { type: "dining_recommendations", words: ["food", "restaurant", "eat", "dining", "cuisine", "breakfast", "lunch", "dinner"] },
    { type: "cultural_inquiry", words: ["culture", "custom", "etiquette", "business", "meeting", "dress code", "tradition"] },
    { type: "activity_recommendations", words: ["things to do", "activities", "attractions", "sightseeing", "experience", "places to visit"] },
    { type: "travel_logistics", words: ["visa", "passport", "transport", "airport", "currency", "sim", "entry", "documents"] },
  ];

  // Explicit user wording should override weak model/score based intent.
  for (const item of checks) {
    if (item.words.some((word) => value.includes(word))) return item.type;
  }
  return currentIntent;
}

function getIntentTitle(intent = "destination_planning", location = "") {
  const titleMap = {
    safety_inquiry: "Safety briefing",
    weather_inquiry: "Weather planning",
    cultural_inquiry: "Cultural briefing",
    destination_planning: "Travel guidance",
    accommodation_search: "Where to stay",
    dining_recommendations: "Food and dining",
    activity_recommendations: "Things to do",
    travel_logistics: "Travel logistics",
  };
  return `${titleMap[intent] || "Travel guidance"}${location ? ` for ${normalizeDestinationName(location)}` : ""}`;
}

function removeIrrelevantSections(text = "", intent = "destination_planning") {
  let output = String(text || "");
  const removeSections = (headings) => {
    for (const heading of headings) {
      const pattern = new RegExp(`\\n?(?:#{1,3}\\s+|\\*\\*)${heading}(?:\\*\\*)?\\s*\\n[\\s\\S]*?(?=\\n(?:#{1,3}\\s+|\\*\\*)|$)`, "gi");
      output = output.replace(pattern, "");
    }
  };

  if (intent === "weather_inquiry") {
    removeSections(["Food and dining", "Where to stay", "Accommodation", "Cultural experiences", "Things to do", "Attractions"]);
  }
  if (intent === "accommodation_search") {
    removeSections(["Cultural experiences", "Things to do", "Attractions", "Food and dining"]);
  }
  if (intent === "dining_recommendations") {
    removeSections(["Accommodation", "Where to stay", "Weather planning"]);
  }
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeFirstHeading(text = "", userIntent = {}) {
  const intent = userIntent.primaryIntent?.type || "destination_planning";
  const location = userIntent.locations?.[0] || "";
  const expected = getIntentTitle(intent, location);
  const wrongForIntent = {
    weather_inquiry: /^(Food and dining|Where to stay|Accommodation|Cultural briefing|Things to do)$/i,
    accommodation_search: /^(Food and dining|Weather planning|Cultural experiences|Things to do)$/i,
    dining_recommendations: /^(Weather planning|Where to stay|Accommodation|Safety briefing)$/i,
    cultural_inquiry: /^(Food and dining|Weather planning|Where to stay)$/i,
  };

  const lines = String(text || "").split("\n");
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const raw = lines[i].trim();
    const cleaned = raw.replace(/^#{1,3}\s+/, "").replace(/^\*\*/, "").replace(/\*\*$/, "").trim();
    if (!cleaned) continue;
    if (wrongForIntent[intent]?.test(cleaned)) {
      lines[i] = raw.startsWith("#") ? `**${expected}**` : `**${expected}**`;
    }
    break;
  }
  return lines.join("\n");
}

export const responseEngine = {
  analyzeUserIntent(message) {
    try {
      const lowerMessage = message.toLowerCase().trim();

      // PRIORITY CHECK: deterministic user-intent overrides before weighted scoring.
      // This prevents a weather query from being rendered under a food/accommodation heading.
      const explicitIntent = getPrimaryQuestionIntent(lowerMessage, null);

      // PRIORITY CHECK: System identity questions first (before any other analysis).
      // This must remain strict. Broad checks such as startsWith("what are") cause
      // false positives for normal travel questions, for example:
      // "what are your concerns on travelling to Nepal this weekend?"
      const identityPatterns = [
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

      const isDefinitelyIdentityQuestion = identityPatterns.some((pattern) =>
        pattern.test(message.trim())
      );

      if (isDefinitelyIdentityQuestion) {
        console.log(
          "🤖 IDENTITY QUESTION DETECTED - bypassing travel analysis"
        );
        return {
          primaryIntent: {
            type: "system_identity",
            confidence: 1.0, // Maximum confidence for identity questions
          },
          allIntents: {
            system_identity: { type: "system_identity", confidence: 1.0 },
          },
          locations: [], // No locations for identity questions
          urgency: "normal",
          complexity: "low",
          isConversationContinuation: false,
          multiToolRequirements: {
            shouldUseMultipleTools: false, // Never use tools for identity
            requiredTools: [],
            reasoning: ["Identity question - no tools needed"],
          },
          travelContext: { type: "system", indicators: ["identity"] },
          messageLength: message.length,
          hasQuestions: message.includes("?"),
          hasDates: [],
        };
      }

      // Check for conversation continuation
      const isConversationContinuation = CONTINUATION_PATTERNS.some((pattern) =>
        pattern.test(lowerMessage)
      );

      // Enhanced intent analysis with weighted scoring
      const intents = Object.fromEntries(
        Object.entries(INTENT_DEFINITIONS).map(([key, def]) => {
          let confidence = 0;

          // Primary keyword matching with higher weight
          const primaryMatches = def.priority_keywords.filter((keyword) =>
            lowerMessage.includes(keyword)
          ).length;
          confidence += primaryMatches * def.weight;

          // Secondary keyword matching
          const secondaryMatches = def.keywords.filter(
            (keyword) =>
              !def.priority_keywords.includes(keyword) &&
              lowerMessage.includes(keyword)
          ).length;
          confidence += secondaryMatches * 0.5;

          // Context keyword bonus
          const contextMatches =
            def.context_keywords?.filter((keyword) =>
              lowerMessage.includes(keyword)
            ).length || 0;
          confidence += contextMatches * 0.3;

          // Normalize confidence score
          const maxPossibleScore =
            def.priority_keywords.length * def.weight +
            (def.keywords.length - def.priority_keywords.length) * 0.5 +
            (def.context_keywords?.length || 0) * 0.3;

          return [
            key,
            {
              ...def,
              confidence: Math.min(confidence / maxPossibleScore, 1.0),
              raw_score: confidence,
            },
          ];
        })
      );

      // Get primary intent (highest confidence)
      const primaryIntent = Object.values(intents).sort(
        (a, b) => b.confidence - a.confidence
      )[0];

      // Explicit user wording overrides weak weighted scoring.
      if (explicitIntent && explicitIntent !== primaryIntent.type) {
        const explicitDefinition = Object.values(INTENT_DEFINITIONS).find((intent) => intent.type === explicitIntent);
        if (explicitDefinition) {
          Object.assign(primaryIntent, explicitDefinition, {
            type: explicitIntent,
            confidence: Math.max(primaryIntent.confidence, 0.9),
            raw_score: Math.max(primaryIntent.raw_score || 0, 1),
          });
        } else {
          primaryIntent.type = explicitIntent;
          primaryIntent.confidence = Math.max(primaryIntent.confidence, 0.9);
        }
      }

      // Intent correction for mixed requests. A user may ask a general travel
      // question but clearly care most about accommodation, budget, business,
      // family travel or trekking. Prioritize the section that answers the user's
      // main decision first.
      const budgetAccommodationRequest = /\b(cheap|budget|affordable|low cost|hostel|guesthouse|guest house|homestay|lowest price)\b/.test(lowerMessage) &&
        /\b(hotel|stay|accommodation|room|booking|place to stay|where to stay)\b/.test(lowerMessage);

      if (budgetAccommodationRequest) {
        primaryIntent.type = "accommodation_search";
        primaryIntent.confidence = Math.max(primaryIntent.confidence, 0.88);
      }

      if (/\b(business|work|meeting|conference|client)\b/.test(lowerMessage) && /\b(culture|etiquette|briefing|travel|trip|dubai|uae)\b/.test(lowerMessage)) {
        primaryIntent.type = "cultural_inquiry";
        primaryIntent.confidence = Math.max(primaryIntent.confidence, 0.82);
      }

      // Ensure minimum confidence threshold
      if (primaryIntent.confidence < 0.1) {
        primaryIntent.type = "destination_planning";
        primaryIntent.confidence = 0.3;
      }

      const locations = this.extractLocations(message);
      const urgency = this.assessUrgency(message);
      const complexity = this.assessComplexity(message);

      // Enhanced multi-tool requirements analysis
      const multiToolRequirements = this.analyzeMultiToolRequirements(
        message,
        primaryIntent,
        locations,
        intents
      );

      // Enhanced travel context analysis
      const travelContext = this.analyzeTravelContext(message, primaryIntent);

      return {
        primaryIntent,
        allIntents: intents,
        locations,
        urgency,
        complexity,
        isConversationContinuation,
        multiToolRequirements,
        travelContext,
        messageLength: message.length,
        hasQuestions: message.includes("?"),
        hasDates: this.extractDates(message).length > 0,
      };
    } catch (error) {
      console.error("Intent analysis error:", error.message);
      return {
        primaryIntent: { type: "destination_planning", confidence: 0.5 },
        allIntents: {},
        locations: [],
        urgency: "normal",
        complexity: "medium",
        isConversationContinuation: false,
        multiToolRequirements: { shouldUseMultipleTools: false },
        travelContext: { type: "general", indicators: [] },
      };
    }
  },

  analyzeMultiToolRequirements(message, primaryIntent, locations, intents) {
    const lowerMessage = message.toLowerCase();
    let shouldUseMultipleTools = false;
    const requiredTools = [];
    const reasoning = [];

    // Multi-intent detection (high confidence in multiple areas)
    const highConfidenceIntents = Object.values(intents).filter(
      (intent) => intent.confidence > 0.4
    );

    if (highConfidenceIntents.length > 1) {
      shouldUseMultipleTools = true;
      reasoning.push("Multiple high-confidence intents detected");
      highConfidenceIntents.forEach((intent) => {
        requiredTools.push(this.mapIntentToTool(intent.type));
      });
    }

    // Complex travel planning indicators
    const complexPlanningKeywords = [
      "comprehensive",
      "detailed",
      "complete",
      "full analysis",
      "everything",
      "all information",
      "thorough",
      "in-depth",
      "extensive",
    ];

    if (
      complexPlanningKeywords.some((keyword) => lowerMessage.includes(keyword))
    ) {
      shouldUseMultipleTools = true;
      reasoning.push("Comprehensive analysis requested");
    }

    // Location-based comprehensive requests
    if (
      locations.length > 0 &&
      (lowerMessage.includes("tell me about") ||
        lowerMessage.includes("what should I know") ||
        lowerMessage.includes("plan my trip") ||
        lowerMessage.includes("visiting") ||
        lowerMessage.includes("traveling to"))
    ) {
      shouldUseMultipleTools = true;
      reasoning.push("Comprehensive destination analysis requested");
      requiredTools.push(
        "cultural_and_travel_insights",
        "comprehensive_safety_intelligence"
      );
    }

    // Safety + other concerns
    if (primaryIntent.type === "safety_inquiry" && locations.length > 0) {
      if (
        lowerMessage.includes("weather") ||
        lowerMessage.includes("climate")
      ) {
        shouldUseMultipleTools = true;
        requiredTools.push(
          "comprehensive_safety_intelligence",
          "comprehensive_weather_analysis"
        );
        reasoning.push("Safety inquiry with weather concerns");
      }
    }

    return {
      shouldUseMultipleTools,
      requiredTools: [...new Set(requiredTools)],
      reasoning,
      complexity: shouldUseMultipleTools ? "high" : "standard",
    };
  },

  analyzeTravelContext(message, primaryIntent) {
    const lowerMessage = message.toLowerCase();

    // Detect travel timing
    const timingIndicators = {
      immediate: ["today", "now", "right now", "immediately", "urgent"],
      near_term: ["tomorrow", "this week", "next week", "soon", "shortly"],
      planned: ["next month", "next year", "planning", "future", "later"],
    };

    let timing = "unspecified";
    for (const [timeframe, indicators] of Object.entries(timingIndicators)) {
      if (indicators.some((indicator) => lowerMessage.includes(indicator))) {
        timing = timeframe;
        break;
      }
    }

    // Detect travel purpose
    const purposeIndicators = {
      business: ["business", "work", "conference", "meeting", "professional"],
      leisure: ["vacation", "holiday", "fun", "relax", "leisure", "tourism"],
      family: ["family", "kids", "children", "relatives", "wedding"],
      adventure: ["adventure", "hiking", "extreme", "sports", "outdoor"],
      cultural: ["culture", "history", "museum", "heritage", "traditional"],
      medical: ["medical", "treatment", "health", "doctor", "hospital"],
    };

    const purposes = [];
    for (const [purpose, indicators] of Object.entries(purposeIndicators)) {
      if (indicators.some((indicator) => lowerMessage.includes(indicator))) {
        purposes.push(purpose);
      }
    }

    return {
      timing,
      purposes: purposes.length > 0 ? purposes : ["general"],
      type: primaryIntent.type,
      indicators: this.extractTravelIndicators(message),
    };
  },

  extractTravelIndicators(message) {
    const indicators = [];
    const lowerMessage = message.toLowerCase();

    // Duration indicators
    if (lowerMessage.includes("week")) indicators.push("week_duration");
    if (lowerMessage.includes("month")) indicators.push("month_duration");
    if (lowerMessage.includes("day")) indicators.push("day_duration");

    // Group size indicators
    if (lowerMessage.includes("solo") || lowerMessage.includes("alone"))
      indicators.push("solo_travel");
    if (lowerMessage.includes("family") || lowerMessage.includes("kids"))
      indicators.push("family_travel");
    if (lowerMessage.includes("group") || lowerMessage.includes("friends"))
      indicators.push("group_travel");

    // Budget indicators
    if (lowerMessage.includes("budget") || lowerMessage.includes("cheap"))
      indicators.push("budget_conscious");
    if (lowerMessage.includes("luxury") || lowerMessage.includes("premium"))
      indicators.push("luxury_seeking");

    return indicators;
  },

  mapIntentToTool(intentType) {
    const mapping = {
      safety_inquiry: "comprehensive_safety_intelligence",
      weather_inquiry: "comprehensive_weather_analysis",
      dining_recommendations: "intelligent_restaurant_discovery",
      accommodation_search: "smart_accommodation_finder",
      cultural_inquiry: "cultural_and_travel_insights",
      activity_recommendations: "local_experiences_and_attractions",
    };
    return mapping[intentType] || "cultural_and_travel_insights";
  },

  extractLocations(message) {
    try {
      const locations = [];
      LOCATION_PATTERNS.forEach((pattern) => {
        const matches = message.match(pattern);
        if (matches) {
          locations.push(...matches.map((match) => match.toLowerCase().trim()));
        }
      });

      // Also check for common location prepositions
      const locationPrepositions =
        /\b(?:to|in|at|from|visiting|going to|traveling to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
      let match;
      while ((match = locationPrepositions.exec(message)) !== null) {
        const location = match[1].toLowerCase();
        if (location.length > 2) {
          // Avoid single letters or very short words
          locations.push(location);
        }
      }

      return [...new Set(locations)];
    } catch (error) {
      console.error("Location extraction error:", error.message);
      return [];
    }
  },

  extractDates(message) {
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // MM/DD/YYYY or DD/MM/YYYY
      /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g, // MM-DD-YYYY or DD-MM-YYYY
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{2,4}\b/gi,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{2,4}\b/gi,
      /\b(next|this)\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    ];

    const dates = [];
    datePatterns.forEach((pattern) => {
      const matches = message.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    });

    return dates;
  },

  assessUrgency(message) {
    try {
      const lowerMessage = message.toLowerCase();

      // High urgency indicators
      if (
        lowerMessage.includes("emergency") ||
        lowerMessage.includes("urgent") ||
        lowerMessage.includes("immediately") ||
        lowerMessage.includes("right now") ||
        lowerMessage.includes("asap")
      ) {
        return "high";
      }

      // Medium urgency indicators
      if (
        lowerMessage.includes("soon") ||
        lowerMessage.includes("next week") ||
        lowerMessage.includes("this week") ||
        lowerMessage.includes("tomorrow") ||
        lowerMessage.includes("quickly")
      ) {
        return "medium";
      }

      return "normal";
    } catch (error) {
      return "normal";
    }
  },

  assessComplexity(message) {
    try {
      const complexityFactors = [
        message.includes("itinerary"),
        message.includes("multiple"),
        message.includes("compare"),
        message.includes("comprehensive"),
        message.includes("detailed"),
        message.includes("budget"),
        message.includes("family"),
        message.includes("business"),
        message.split("?").length > 2,
        message.split(",").length > 3,
        message.length > 100,
        this.extractLocations(message).length > 1,
        this.extractDates(message).length > 0,
      ].filter(Boolean).length;

      if (complexityFactors >= 5) return "high";
      if (complexityFactors >= 3) return "medium";
      return "low";
    } catch (error) {
      return "medium";
    }
  },

  enhanceSystemPrompt(userIntent, conversationHistory) {
    try {
      let prompt = systemPrompts?.getMainSystemPrompt?.() || FALLBACK_PROMPT;
      const profile = getIntentPriorityProfile("", userIntent);
      const intent = userIntent.primaryIntent?.type || "destination_planning";
      const sections = profile.orderedSections.join(" → ");

      prompt += `\n\nIntent-weighted response planning:\n- Primary detected intent: ${intent}.\n- Prioritize the user's main decision before secondary travel information.\n- Recommended section order for this request type: ${sections}.\n- Do not give equal space to every available data source. Use irrelevant data only if it directly helps the user's decision.\n- If the user asks for accommodation, lead with areas, stay types, price realism and booking checks. Do not lead with attractions.\n- If the user asks for business travel, lead with etiquette, commute reliability, dress, timing and professional logistics.\n- If the user asks for family travel, lead with safety, comfort, transport and realistic pacing.\n- If the user asks for trekking or outdoor travel, lead with weather, route conditions, permits, safety and gear.\n- If the user asks for food, lead with local dishes, suitable areas, hygiene and booking practicality.
- The first heading must match the primary intent. A weather request must never be titled food/dining, accommodation or attractions.
- Never output raw function calls, XML tags, JSON tool calls, pseudo-code, or text such as <function=...>.</function>.
- If you want more live data but cannot call another tool, simply give the best practical guidance without exposing the missing call.`;

      const intentEnhancements = {
        safety_inquiry:
          (systemPrompts?.getSafetyAnalysisPrompt?.() || "Provide a calm travel safety briefing") +
          "\n\nKeep the advice practical and avoid alarmist wording.",
        cultural_inquiry:
          (systemPrompts?.getCulturalInsightPrompt?.() || "Provide practical cultural guidance") +
          "\n\nUse concrete etiquette examples and avoid stereotypes.",
        destination_planning:
          (systemPrompts?.getLocationAnalysisPrompt?.() || "Provide practical destination guidance") +
          "\n\nPrioritize stay areas, timing, weather, transport, cash/payment, SIM/eSIM and tradeoffs. Avoid generic sightseeing lists unless asked.",
        weather_inquiry:
          "Provide weather guidance with travel impact, clothing advice and practical planning notes. Do not over-explain meteorology.",
        accommodation_search:
          (systemPrompts?.getAccommodationPrompt?.() || "Provide accommodation guidance with honest price handling") +
          "\n\nFor cheap or budget requests, prioritize hostels, guesthouses, homestays, simple hotels and budget areas. Do not list luxury hotels as cheap. If exact live prices are missing, say that clearly and provide approximate ranges only.",
        dining_recommendations:
          "Provide food guidance that balances local culture, convenience, hygiene and practical booking advice.",
        activity_recommendations:
          "Recommend activities by priority and area. Avoid long generic attraction lists.",
      };

      if (intentEnhancements[intent]) {
        prompt += "\n\n" + intentEnhancements[intent];
      }

      if (userIntent.urgency === "high") {
        prompt += "\n\nUrgent request: prioritize immediate, actionable information with clear next steps.";
      }

      if (userIntent.complexity === "high") {
        prompt += "\n\nComplex request: synthesize into clear priorities. Avoid long lists and avoid exposing internal analysis.";
      }

      const indicators = userIntent.travelContext?.indicators || [];
      const purposes = userIntent.travelContext?.purposes || [];
      const timing = userIntent.travelContext?.timing;

      if (indicators.includes("budget_conscious")) {
        prompt += "\n\nBudget request: mention value, location tradeoffs, refundable booking, final price after taxes and recent reviews. Use approximate ranges unless verified prices are supplied.";
      }
      if (indicators.includes("family_travel")) {
        prompt += "\n\nFamily travel: prioritize cleanliness, safety, transport convenience, room comfort, food access and realistic pacing.";
      }
      if (purposes.includes("business")) {
        prompt += "\n\nBusiness travel: prioritize punctuality, commute time, formal dress, meeting etiquette, Wi-Fi, airport transfers and professional practicality.";
      }
      if (timing === "near_term" || timing === "immediate") {
        prompt += "\n\nNear-term travel: include practical checks such as weather, booking confirmation, transport, local cash/payment, SIM/eSIM, insurance and flexible planning.";
      }
      if (userIntent.multiToolRequirements?.shouldUseMultipleTools) {
        prompt += "\n\nIntegrate available context into one natural answer. Never mention tools, tool names, sources used, internal systems or response generation details.";
      }
      if (conversationHistory && conversationHistory.length > 0) {
        prompt += "\n\nContinue the conversation naturally and only reference previous context when it helps.";
      }

      return prompt;
    } catch (error) {
      console.error("System prompt enhancement error:", error.message);
      return FALLBACK_PROMPT;
    }
  },

  formatProfessionalResponse(rawResponse, toolsUsed, userIntent) {
    try {
      let response = String(rawResponse || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      response = this.cleanInternalLanguage(response);

      if (!response) {
        return this.buildConciseFallback(userIntent);
      }

      response = normalizeFirstHeading(response, userIntent);
      response = removeIrrelevantSections(response, userIntent.primaryIntent?.type);
      response = this.applyTravelQualityGuardrails(response, userIntent);
      response = this.rebalanceByIntent(response, userIntent);

      const hasUsefulStructure = /\*\*[^*]+\*\*/.test(response) || /^#{2,3}\s+/m.test(response);
      if (!hasUsefulStructure && response.length > 180) {
        response = this.addResponseStructure(response, userIntent);
      }

      response = normalizeFirstHeading(response, userIntent);
      response = removeIrrelevantSections(response, userIntent.primaryIntent?.type);

      return this.cleanInternalLanguage(response)
        .replace(/\n{3,}/g, "\n\n")
        .trim() || this.buildConciseFallback(userIntent);
    } catch (error) {
      console.error("Response formatting error:", error?.message);
      return this.cleanInternalLanguage(rawResponse || this.buildConciseFallback(userIntent));
    }
  },


  cleanInternalLanguage(text = "") {
    return stripRawToolLeakage(text)
      .replace(/^\s*ATLAS TRAVEL INTELLIGENCE\s*[-–:]?.*$/gim, "")
      .replace(/^\s*(MULTI[- ]TOOL ANALYSIS|INTELLIGENCE GATHERED|TOOLS USED|ANALYSIS SOURCES USED|SYSTEM CAPACITY|HIGH DEMAND MODE|NEXT STEPS)\s*:?\s*$/gim, "")
      .replace(/\b(comprehensive analysis using \d+ intelligence tools|using \d+ intelligence tools|\d+ tools? used|tool calls?|tools? executed|tool data collected|multi-tool analysis|analysis sources used)\b/gi, "")
      .replace(/\b(Groq|API|backend|orchestration|system capacity|token limit|rate limit|formatting step|final response generation|model)\b/gi, "")
      .replace(/Please try your request again[^.]*\./gi, "")
      .replace(/Ask a more specific follow-up such as[^.]*\./gi, "")
      .replace(/All intelligence data has been gathered[^.]*\./gi, "")
      .replace(/High-quality travel intelligence temporarily delayed[^.]*\./gi, "")
      .replace(/^\s*[✅🔧📊📑🎯🛡️🌤️🕌📍]\s*/gm, "")
      .replace(/^[ \t]*(?:undefined|null|NaN)[ \t]*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },
  buildConciseFallback(userIntent = {}) {
    const location = normalizeDestinationName(userIntent.locations?.[0]);
    const intent = userIntent.primaryIntent?.type || "destination_planning";

    if (intent === "accommodation_search") {
      return `**Where to stay in ${location}**\n\nChoose the area first and the property second. For budget travel, compare hostels, guesthouses, homestays and simple hotels before looking at higher-end hotels.\n\n**Booking checks**\n• Confirm the final price after taxes and platform fees.\n• Read recent reviews for cleanliness, noise, Wi-Fi and staff reliability.\n• Prefer a convenient area over the absolute lowest nightly rate.\n\nI cannot verify live booking prices unless exact price data is available for your dates.`;
    }

    if (intent === "weather_inquiry") {
      return `**Weather planning for ${location}**

Check the local forecast close to departure and plan around the conditions that affect your actual activities. For warm or humid destinations, pack breathable clothing and light rain protection. For colder destinations, plan layers and allow extra transport time if conditions are poor.

**Practical tips**
• Keep one indoor backup plan for each outdoor day.
• Check hourly rain, wind and temperature before long transfers.
• For regional trips, compare weather by city rather than assuming the whole region is the same.`;
    }

    if (intent === "cultural_inquiry") {
      return `**Cultural guidance for ${location}**\n\nStart respectful and slightly formal until you understand the setting. Dress neatly, keep communication polite and avoid strong comments about politics, religion or local customs.\n\nFor business travel, confirm meeting location, building entry rules, transport time and expected dress code before the day of the meeting.`;
    }

    return `**Travel guidance for ${location}**\n\nI do not have enough verified live detail to give a full briefing, but the safest practical approach is to confirm weather, transport, entry rules, booking conditions and recent local guidance before finalizing plans.\n\nKeep your itinerary flexible, save offline maps and carry backup payment options.`;
  },

  removeEmptyHeadings(text) {
    if (!text) return text;
    const lines = text.split("\n");
    const cleaned = [];
    const isHead = (ln) => /^(\*\*[^*]+\*\*|#{2,3}\s+.+)$/.test((ln || "").trim());

    for (let i = 0; i < lines.length; i++) {
      const current = lines[i];
      if (isHead(current)) {
        let j = i + 1;
        let hasContent = false;
        while (j < lines.length) {
          const next = (lines[j] || "").trim();
          if (!next) { j++; continue; }
          if (isHead(next)) break;
          hasContent = true;
          break;
        }
        if (!hasContent) continue;
      }
      cleaned.push(current);
    }

    return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  },

  addResponseStructure(response, userIntent) {
    const location = userIntent?.locations?.[0];
    const intent = userIntent?.primaryIntent?.type || "general";
    const title = getIntentTitle(intent, location);
    const paragraphs = response.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const first = paragraphs.shift() || response;
    const rest = paragraphs.join("\n\n");

    let formatted = `**${title}**\n\n${first}`;
    if (rest) formatted += `\n\n${rest}`;
    return this.removeEmptyHeadings(formatted);
  },

  applyTravelQualityGuardrails(response, userIntent = {}) {
    let text = String(response || "").trim();
    const indicators = userIntent.travelContext?.indicators || [];
    const intent = userIntent.primaryIntent?.type || "general";
    const userMessage = userIntent.originalMessage || userIntent.message || "";
    const isAccommodationIntent = intent === "accommodation_search" || /\b(hotel|stay|accommodation|hostel|guesthouse|guest house|homestay|room|booking|where to stay)\b/i.test(text + " " + userMessage);
    const isBudget = isAccommodationIntent && (indicators.includes("budget_conscious") || /\b(cheap|budget|affordable|low cost|hostel|guesthouse|guest house|homestay)\b/i.test(text + " " + userMessage));
    const location = normalizeDestinationName(userIntent.locations?.[0]);

    text = text
      .replace(/Nepal is a wonderful destination with a rich cultural heritage and breathtaking natural beauty\.?/gi,
        "Nepal can be a strong choice if your plan matches the season, transport conditions and the type of trip you want.")
      .replace(/\bwonderful destination\b/gi, "strong destination")
      .replace(/\bbreathtaking natural beauty\b/gi, "notable natural scenery")
      .replace(/\bcomprehensive\b/gi, "detailed")
      .replace(/\bworld[- ]class\b/gi, "well-planned");

    if (isBudget) {
      text = stripLuxuryBudgetMismatches(text);
      const hasBudgetTypes = /hostel|guesthouse|guest house|homestay|simple hotel|budget private/i.test(text);
      if (!hasBudgetTypes) {
        text += `\n\n**Budget stay guidance**\nFor a cheap stay in ${location}, compare hostels, guesthouses, homestays and simple hotels first. A slightly better location with recent reviews is usually better value than the absolute lowest nightly rate.`;
      }
    }

    if (isAccommodationIntent && /real[- ]?time|live prices?|current prices?|prices?|availability/i.test(text + " " + userMessage)) {
      if (!/data note|cannot verify live|approximate|final rates|booking prices/i.test(text)) {
        text += "\n\n**Data note**\nLive hotel prices change by room type, taxes, cancellation policy and booking platform. Treat price guidance as planning ranges and confirm final rates on Booking.com, Agoda, Hostelworld, Google Hotels or the property website before reserving.";
      }
    }

    if (!isAccommodationIntent) {
      text = text.replace(/\n?\*\*Price note\*\*\n[\s\S]*?(?=\n\*\*|$)/gi, "");
      text = text.replace(/\n?\*\*Availability note\*\*\n[^\n]*(?:price|booking|hotel)[^\n]*(?=\n|$)/gi, "");
    }

    return this.removeEmptyHeadings(text);
  },

  rebalanceByIntent(response, userIntent = {}) {
    const intent = userIntent.primaryIntent?.type || "destination_planning";
    const indicators = userIntent.travelContext?.indicators || [];
    const isBudget = indicators.includes("budget_conscious") || /\b(cheap|budget|affordable|hostel|guesthouse|homestay)\b/i.test(response);
    const location = normalizeDestinationName(userIntent.locations?.[0]);

    // If a budget/accommodation response is dominated by attractions, prepend a concise decision layer.
    if ((intent === "accommodation_search" || isBudget) && /Cultural Experiences|Things to do|Attractions/i.test(response)) {
      const lead = `**Best approach for ${location}**\n\nFor this request, accommodation should come first. Choose a practical area, compare realistic budget stay types, and treat any prices as approximate unless live rates are explicitly shown for your dates.\n\n**Where to stay on a budget**\n• Start with walkable, traveler-friendly areas close to food and transport.\n• Compare hostels, guesthouses, homestays and simple hotels before higher-end hotels.\n• Check recent reviews for cleanliness, noise, hot water, Wi-Fi and staff reliability.`;
      response = `${lead}\n\n${response}`;
    }

    // Remove excessive attraction sections if accommodation is the core request.
    if (intent === "accommodation_search" || isBudget) {
      response = response.replace(/\n?\*\*Cultural Experiences[^*]*\*\*[\s\S]*?(?=\n\*\*|$)/gi, "");
      response = response.replace(/\n?\*\*Things to do[^*]*\*\*[\s\S]*?(?=\n\*\*|$)/gi, "");
    }

    return this.removeEmptyHeadings(response);
  },

  extractKeyPoints(response) {
    try {
      const sentences = response
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 20);
      const indicators = [
        "recommend",
        "suggest",
        "important",
        "consider",
        "should",
        "must",
        "essential",
        "critical",
        "key",
        "main",
        "primary",
      ];

      const keyPoints = [];
      sentences.forEach((sentence) => {
        if (
          indicators.some((indicator) =>
            sentence.toLowerCase().includes(indicator)
          ) &&
          keyPoints.length < 3
        ) {
          keyPoints.push(sentence.trim());
        }
      });

      return keyPoints;
    } catch (error) {
      return [];
    }
  },
};
