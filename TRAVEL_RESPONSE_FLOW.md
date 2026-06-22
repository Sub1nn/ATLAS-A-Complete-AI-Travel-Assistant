# ATLAS Travel Response Flow

ATLAS is now designed around an intent-first travel pipeline. The backend should not answer every travel message with the same destination template. It should first identify what the user is trying to do, call only the tools needed for that intent, then compose a grounded response with a UI payload that matches the request.

## 1. Intent-first pipeline

The main flow is:

```text
User message
→ deterministic context resolver
→ optional Groq planner for structured intent refinement
→ validated tool plan
→ API orchestration
→ grounded response composer
→ response verifier
→ UI live actions
→ message and memory storage
```

The LLM planner is used to structure the user request, not to directly invent travel facts. The backend still controls tool execution and response verification.

## 2. Dynamic intent families

ATLAS should classify requests into these broad families:

- Destination planning: country, city, weekend trip, first-time visit, itinerary.
- Accommodation: hotels, hostels, motels, lodges, guesthouses, homestays, resorts, apartments, cheap vs luxury.
- Dining and nightlife: restaurants, cafes, coffee, street food, local cuisine, bars, pubs, night clubs and nightlife.
- Activities and attractions: museums, parks, shopping, culture, nature, family-friendly options, sports and local venues.
- Sports and games: tennis, badminton, football, basketball, volleyball, swimming, gyms, padel, pickleball, squash, golf, climbing, bowling, skating and running.
- Route planning: origin, destination, preferred transport mode, walking, driving, transit or cycling.
- Safety: current news signal, official advisory reminder and practical precautions.
- Weather: current conditions, hourly forecast and weather-aware planning.
- Document chat: uploaded PDF, DOCX or TXT as the main source.

## 3. API orchestration rules

### Destination planning

Use:

- NewsAPI for safety/current context.
- OpenWeather for city-level weather only.
- Google Places API New for city-level attractions, restaurants and accommodation leads.
- Cultural/practical guidance from the destination profile and available context.

For country-level queries, ATLAS should not pick one random city. It should ask for the base city before city-level weather and venue searches.

### Accommodation

Use Google Places API New with query expansion based on stay type and budget:

- budget: hostels, guesthouses, cheap hotels, homestays.
- mid-range: hotels, serviced apartments, well-rated hotels.
- luxury: luxury hotels, resorts, five-star hotels.
- type-specific: motel, lodge, apartment, resort, guesthouse.

ATLAS must not claim live booking prices or room availability from Google Places. It should present verified property leads and ask the user to confirm prices on booking platforms or property websites.

### Dining and nightlife

Use Google Places API New and Yelp when configured:

- local/traditional food: local restaurants, traditional restaurants, street food.
- cafes: cafes, coffee shops, local cafes.
- nightlife: bars, pubs, night clubs, nightlife areas.
- family/budget/vegetarian preferences should modify the query plan.

### Sports and local activities

When the user asks to play a sport, ATLAS should search venues immediately. It should not ask permission first.

Example for tennis:

```text
tennis courts
public tennis courts
indoor tennis courts
tennis club
sports centre tennis
local-language variants where useful
```

Weather should support the answer if the activity is outdoor or time-sensitive. Venue leads should appear before generic fallback map searches.

### Route planning

Use Google Directions where possible, plus a Google Maps route link. Always explain that live traffic and transit disruption should be checked before leaving.

### Safety

Safety is not a percentage guarantee. ATLAS uses a news-signal score from 0 to 100 to describe the strength of current safety/disruption signals found in the configured news feed.

- Low current-news signal does not mean a destination is 100% safe.
- Moderate/elevated/high signals should be explained with relevant headlines and official advisory links.
- Official travel advisories should decide final go/no-go decisions.

## 4. Response layout

Responses should be short, clear and structured. Recommended layouts:

### Destination overview

```text
Destination name
Short vibe / context
Safety and current context
Weather and timing
Food, stays and local experience
Simple first-day flow
Practical travel notes
Best next step
```

### Activity or sport

```text
Activity options near location
Verified venue leads
Weather timing
How to use this shortlist
Booking/access note
```

### Hotels/stays

```text
Stay type in location
Verified discovery leads
How to compare
Typical planning range when safe to give as rough guidance
Price / availability note
```

### Dining/nightlife

```text
Dining or nightlife type in location
Verified discovery leads
What to prioritize
Data note
```

## 5. UI payload rules

`liveActions` should show verified places first. Fallback map-search cards should be intent-specific:

- tennis query → tennis courts, public tennis courts, indoor tennis courts, tennis club.
- broad city query → museums, parks, cafes, restaurants, shopping.
- hotels query → hostels, budget hotels, luxury hotels, apartments depending on intent.
- nightlife query → bars, pubs, night clubs, nightlife.

Do not let stale activity memory leak into new destination queries.
