function titleCase(value = "") {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lower(message = "") {
  return String(message || "").toLowerCase();
}

function hasAny(message = "", words = []) {
  const value = lower(message);
  return words.some((word) => value.includes(word));
}

function detectDestination(message = "", userIntent = {}) {
  const value = lower(message);
  const known = [
    ["kathmandu", "Kathmandu"],
    ["thamel", "Thamel, Kathmandu"],
    ["nepal", "Nepal"],
    ["pokhara", "Pokhara"],
    ["istanbul", "Istanbul"],
    ["turkey", "Turkey"],
    ["tokyo", "Tokyo"],
    ["japan", "Japan"],
    ["dubai", "Dubai"],
    ["helsinki", "Helsinki"],
    ["paris", "Paris"],
    ["bangkok", "Bangkok"],
    ["southeast asia", "Southeast Asia"],
  ];

  for (const [needle, label] of known) {
    if (value.includes(needle)) return label;
  }

  const location = userIntent.locations?.[0];
  return location ? titleCase(location) : "your destination";
}

function getIntent(message = "", userIntent = {}) {
  const value = lower(message);
  const primary = userIntent.primaryIntent?.type || "destination_planning";

  if (hasAny(value, ["hotel", "stay", "accommodation", "hostel", "guesthouse", "guest house", "room", "booking", "prices", "price per night", "where to stay"])) return "accommodation_search";
  if (hasAny(value, ["restaurant", "food", "eat", "dining", "cuisine", "breakfast", "lunch", "dinner", "local dishes"])) return "dining_recommendations";
  if (hasAny(value, ["weather", "forecast", "rain", "temperature", "climate", "monsoon", "humid", "season"])) return "weather_inquiry";
  if (hasAny(value, ["safe", "safety", "security", "danger", "risk", "advisory", "crime"])) return "safety_inquiry";
  if (hasAny(value, ["visa", "airport", "transport", "sim", "currency", "passport", "entry", "documents"])) return "travel_logistics";
  if (hasAny(value, ["culture", "custom", "etiquette", "business", "meeting", "dress code", "tradition"])) return "cultural_inquiry";
  if (hasAny(value, ["things to do", "activities", "attractions", "sightseeing", "experience", "places to visit"])) return "activity_recommendations";

  return primary;
}

function isBudgetRequest(message = "") {
  return hasAny(message, ["cheap", "budget", "affordable", "low cost", "hostel", "guesthouse", "guest house", "homestay", "lowest price"]);
}

function asksForLivePrices(message = "") {
  return hasAny(message, ["live price", "live prices", "real-time", "realtime", "real time", "current price", "availability", "booking", "price per night", "prices"]);
}

function limitationNote(intent, message = "") {
  switch (intent) {
    case "accommodation_search":
      return asksForLivePrices(message)
        ? "**Data note**\nLive hotel prices can change by room type, taxes, cancellation policy and booking platform. I can give realistic planning ranges, but confirm final rates and availability on Booking.com, Agoda, Hostelworld, Google Hotels or the property website before reserving."
        : "**Data note**\nHotel availability and final prices can change quickly, so check recent reviews and final booking conditions before reserving.";
    case "dining_recommendations":
      return "**Data note**\nLive restaurant availability and reservation data may be limited right now, so these suggestions rely more on established local dining patterns and practical traveler guidance.";
    case "weather_inquiry":
      return "**Data note**\nSome live forecast sources may be delayed right now, so treat this as travel-planning guidance and check an hourly local forecast before outdoor plans.";
    case "safety_inquiry":
      return "**Data note**\nFor time-sensitive safety issues, verify the latest official local or government travel advisories before making critical decisions.";
    case "travel_logistics":
      return "**Data note**\nTransport schedules, entry rules and local services can change, so confirm final details with official sources close to departure.";
    case "cultural_inquiry":
      return "**Data note**\nLocal customs can vary by setting, so use this as practical guidance and adjust based on your host, venue and formality level.";
    default:
      return "**Data note**\nSome live sources may be temporarily limited, so I am giving practical guidance rather than pretending to know exact real-time availability.";
  }
}

function thamelBudgetPriceFallback(message = "") {
  return `**Approximate budget stay prices in Thamel**\n\nFor your travel date, treat these as planning ranges only. Final prices can change by room type, taxes, cancellation policy, breakfast and booking platform fees.\n\n• **Hotel Encounter Nepal**: usually around $20–45/night for a basic private room. Good if you want a simple hotel-style stay near Thamel.\n• **Hotel Blue Horizon**: usually around $18–40/night. Practical for a budget private room close to tourist services.\n• **Alobar1000 Hostel**: usually around $5–12/night for dorms and $18–35/night for simple private rooms, when available. Better for solo or social budget travel.\n• **Zostel Kathmandu**: usually around $6–15/night for dorms and $25–50/night for private rooms. Good if you prefer a hostel atmosphere.\n• **Hotel Buddha Land or similar simple Thamel hotels**: usually around $15–35/night for basic private rooms. Check recent reviews for noise, hot water and cleanliness.\n\n**How I would compare them**\nIf you want the lowest cost, start with hostels such as Alobar1000 or Zostel. If you want a private room and quieter stay, compare Hotel Encounter Nepal, Hotel Blue Horizon and similar simple hotels. In Kathmandu, recent reviews about noise, hot water and Wi-Fi matter as much as the nightly price.\n\n${limitationNote("accommodation_search", message)}`;
}

function nepalBudgetFallback(message = "") {
  return `**Nepal budget travel guidance**\n\nNepal can be a good choice if you keep the plan realistic and flexible. For a budget trip, Kathmandu and Pokhara are the easiest bases because they have many guesthouses, hostels, simple hotels, restaurants and transport connections.\n\n**Where to stay cheaply**\n• **Kathmandu**: start with Thamel for the widest budget selection and easiest tourist services.\n• **Patan**: better if you want a quieter cultural area, though transport may take longer.\n• **Boudha**: calmer and good for monasteries and local food, but less central for nightlife.\n• **Pokhara**: Lakeside is convenient for first-time visitors and has many budget guesthouses.\n\n**Typical planning ranges**\n• Hostel dorms: about $5–15/night.\n• Budget private rooms: about $15–35/night.\n• Simple mid-range hotels: about $35–70/night.\n\n**Practical tips**\n• Carry some cash because smaller shops, taxis and local restaurants may not accept cards.\n• Buy a local SIM or eSIM after arrival for maps and transport coordination.\n• Leave extra time for Kathmandu traffic and domestic travel delays.\n• Pack light rain protection and comfortable walking shoes.\n\n${limitationNote("accommodation_search", message)}`;
}

export const fallbackResponses = {
  generateEnhancedFallback(message, userIntent = {}, options = {}) {
    const intent = getIntent(message, userIntent);
    const location = detectDestination(message, userIntent);
    const value = lower(message);

    if (intent === "accommodation_search" && (value.includes("thamel") || (value.includes("kathmandu") && isBudgetRequest(message)))) {
      return { result: thamelBudgetPriceFallback(message), needsLocation: false, confidence: "medium", fallbackReason: options.reason || "live_data_limited" };
    }

    if (intent === "accommodation_search" && (value.includes("nepal") || value.includes("kathmandu"))) {
      return { result: nepalBudgetFallback(message), needsLocation: false, confidence: "medium", fallbackReason: options.reason || "live_data_limited" };
    }

    switch (intent) {
      case "accommodation_search":
        return this.generateAccommodationFallback(message, location, options);
      case "dining_recommendations":
        return this.generateDiningFallback(message, location, options);
      case "weather_inquiry":
        return this.generateWeatherFallback(message, location, options);
      case "safety_inquiry":
        return this.generateSafetyFallback(message, location, options);
      case "travel_logistics":
        return this.generateLogisticsFallback(message, location, options);
      case "cultural_inquiry":
        return this.generateCulturalFallback(message, location, options);
      case "activity_recommendations":
        return this.generateActivityFallback(message, location, options);
      default:
        return this.generateDestinationFallback(message, location, options);
    }
  },

  generateAccommodationFallback(message, location) {
    const budget = isBudgetRequest(message);
    return {
      result: budget
        ? `**Budget stays in ${location}**\n\nFor a cheaper stay, focus on hostels, guesthouses, homestays and simple hotels first. The best value is usually not the absolute lowest price, but a clean place in a convenient area with recent reviews.\n\n**How to compare options**\n• Choose an area near transport, food and your main activities.\n• Check recent reviews for cleanliness, noise, hot water, Wi-Fi and staff reliability.\n• Compare the final price after taxes, service fees and cancellation rules.\n• Prefer refundable booking if your travel dates may change.\n\n${limitationNote("accommodation_search", message)}`
        : `**Where to stay in ${location}**\n\nChoose the area first and the property second. The right location will usually save more time and stress than a slightly cheaper room far away.\n\n**What to prioritize**\n• Short trips: stay near the places you will visit most.\n• Business travel: prioritize commute time, Wi-Fi, breakfast and late check-in.\n• Family travel: check room size, noise, elevator access and nearby food options.\n• Longer stays: compare apartments with hotels after checking cancellation rules.\n\n${limitationNote("accommodation_search", message)}`,
      needsLocation: location === "your destination",
    };
  },

  generateDiningFallback(message, location) {
    const istanbul = lower(location).includes("istanbul") || lower(message).includes("istanbul");
    const result = istanbul
      ? `**Dining experience in Istanbul**\n\nIstanbul is best experienced by mixing one traditional meal, one casual street-food stop and one Bosphorus or old-city dining setting. This gives a better sense of the city than choosing only highly rated tourist restaurants.\n\n**What to try**\n• Start with Turkish breakfast if you have a relaxed morning.\n• Try kebab, pide, meze, grilled fish or mantı depending on the area.\n• Leave room for baklava, künefe or Turkish tea and coffee.\n\n**Where to look**\n• **Karaköy and Galata**: good for modern cafes and casual restaurants.\n• **Kadıköy**: strong local food scene and better value than many tourist-heavy areas.\n• **Sultanahmet**: convenient near major sights, but compare reviews carefully.\n• **Bosphorus areas**: better for atmosphere, usually higher prices.\n\n**Practical tips**\nAvoid choosing only by Instagram photos. Check recent reviews, opening hours and whether the place is mainly tourist-focused. For popular restaurants, reserve ahead if you are going for dinner.\n\n${limitationNote("dining_recommendations", message)}`
      : `**Food and dining in ${location}**\n\nA good dining plan should balance local experience, convenience and food safety. Pick one or two established local places, then keep the rest flexible around your daily route.\n\n**How to choose well**\n• Ask hotel staff or locals for current recommendations.\n• Check recent reviews, opening hours and reservation needs.\n• For busy local places, shorter menus and high turnover are usually good signs.\n• If you have dietary restrictions, keep the wording saved in the local language.\n\n${limitationNote("dining_recommendations", message)}`;
    return { result, needsLocation: location === "your destination" };
  },

  generateWeatherFallback(message, location) {
    return {
      result: `**Weather planning for ${location}**\n\nPlan around the season and the activities you care about most. Weather affects outdoor sightseeing, beaches, trekking, traffic and clothing choices more than hotel comfort.\n\n**Best approach**\n• Check the local hourly forecast before outdoor plans.\n• Keep one indoor backup plan for rain or heat.\n• Pack breathable clothing, comfortable shoes and light rain protection when conditions are uncertain.\n• Leave extra travel time if heavy rain, snow, heat or wind may affect transport.\n\n${limitationNote("weather_inquiry", message)}`,
      needsLocation: location === "your destination",
    };
  },

  generateSafetyFallback(message, location) {
    return {
      result: `**Safety notes for ${location}**\n\nUse normal travel awareness and check official guidance before making fixed plans. Most travel risk is reduced by planning transport, documents and late-night movement carefully.\n\n**Main precautions**\n• Keep passport copies, insurance details and emergency contacts available offline.\n• Use licensed taxis, trusted ride-hailing apps or hotel-arranged transfers when possible.\n• Be careful with valuables in crowded places, stations, nightlife areas and tourist zones.\n• Ask your hotel or host about current local conditions before visiting unfamiliar areas.\n\n${limitationNote("safety_inquiry", message)}`,
      needsLocation: location === "your destination",
    };
  },

  generateLogisticsFallback(message, location) {
    return {
      result: `**Travel logistics for ${location}**\n\nStart with the practical details that can affect the whole trip: entry rules, airport transfer, local transport, payment methods, SIM or eSIM access and backup documents.\n\n**Before you go**\n• Check passport validity and entry requirements from official sources.\n• Save your accommodation address and offline maps.\n• Confirm airport transfer options before arrival.\n• Carry at least one backup payment method and some local cash where card acceptance may vary.\n\n${limitationNote("travel_logistics", message)}`,
      needsLocation: location === "your destination",
    };
  },

  generateCulturalFallback(message, location) {
    return {
      result: `**Cultural guidance for ${location}**\n\nA respectful, slightly conservative approach works well until you understand the local setting. Match the formality of the place, especially in business, religious or family environments.\n\n**Practical etiquette**\n• Use polite greetings and avoid being too casual at first.\n• Dress more modestly for religious sites, formal meetings and traditional areas.\n• Avoid strong jokes or comments about politics, religion or sensitive local issues.\n• Watch how locals behave in the setting and adjust calmly.\n\n${limitationNote("cultural_inquiry", message)}`,
      needsLocation: location === "your destination",
    };
  },

  generateActivityFallback(message, location) {
    return {
      result: `**Things to do in ${location}**\n\nChoose activities by area so you do not lose too much time moving around. A good travel day usually combines one main attraction, one local food stop and one flexible activity nearby.\n\n**How to plan**\n• Group nearby sights into the same half-day.\n• Book popular timed attractions in advance when possible.\n• Keep one flexible option for weather or tiredness.\n• Check opening hours, local holidays and transport before leaving.\n\n${limitationNote("destination_planning", message)}`,
      needsLocation: location === "your destination",
    };
  },

  generateDestinationFallback(message, location) {
    return {
      result: `**Travel guidance for ${location}**\n\nStart with the purpose of the trip, then choose the area, daily pace and transport around that. This usually gives a better plan than trying to see everything.\n\n**Best approach**\n• Choose accommodation close to your main activities, not only the cheapest option.\n• Keep one flexible half-day for weather, delays or rest.\n• Check entry rules, local holidays and transport options before booking.\n• Save your hotel address, emergency contacts and offline maps before arrival.\n\n${limitationNote("destination_planning", message)}`,
      needsLocation: location === "your destination",
    };
  },

  generateNoLocationFallback(message) {
    return {
      result: `**Which destination should I check?**\n\nTell me the city or country, your travel dates and your main purpose. Then I can give a much more useful recommendation.\n\n${limitationNote("destination_planning", message)}`,
      needsLocation: true,
    };
  },
};
