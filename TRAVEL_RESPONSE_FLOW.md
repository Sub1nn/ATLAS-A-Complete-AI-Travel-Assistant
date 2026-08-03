# ATLAS Hybrid Travel Workflow

ATLAS uses an intent-aware LangGraph supervisor around deterministic travel logic. The graph coordinates specialists, but it does not give a language model unrestricted control over providers, memory, payments or final factual claims.

## Authoritative graph

```text
User request
→ deterministic context resolution
→ optional schema-constrained LangChain planner
→ input guardrails
   ├─ clarification or safe short-circuit
   └─ supervisor decision
      → document retrieval when relevant
      → bounded specialist routing
      → parallel provider execution
      → evidence reconciliation
      → intent-specific response plan
      → grounded composition
      → claim verifier
      → quality gate
         ├─ pass → final response
         └─ evidence-preserving repair
            ├─ pass → final response
            └─ retry once → final response
```

The authoritative graph is request-scoped. Provider payloads, document excerpts and user inputs are not duplicated into LangGraph checkpoint storage. Durable conversation memory is saved by the chat controller only after lease-ownership and fencing checks pass.

## Guardrails before provider spend

The guardrail node handles boundaries that should not wait for an external API:

- missing destinations or route endpoints;
- prompt, credential and private-instruction extraction attempts;
- payment-card data and direct-booking requests;
- high-stakes customs, entry, health and safety signals that require authoritative sources.

ATLAS compares accommodation but does not collect card data, take payments or complete bookings.

## Supervisor and specialists

The supervisor creates a request-scoped specialist plan. It selects only the domains needed by the current intent:

| Specialist | Responsibility |
| --- | --- |
| Experiences | Attractions, recreation, sports and local venues |
| Dining | Food, restaurants, dietary needs and dining shortlists |
| Stays | Accommodation discovery and comparison-only guidance |
| Mobility | Routes, public transport, transfers and walking constraints |
| Weather | Current and forecast conditions tied to the requested date |
| Safety | Destination-specific news, baseline and advisory evidence |
| Culture | Country and city context, etiquette and practical norms |
| Logistics | Customs, packing, transit and official-source checks |
| Documents | User-isolated retrieval from uploaded travel documents |

Specialists do not act as free-running chatbots. They are bounded orchestration lanes over validated tool arguments, provider budgets and deterministic composers.

## Multi-destination behaviour

ATLAS keeps destination evidence separate. A request comparing two cities or countries can fan out weather, safety, dining, stays and experience work per destination. Results carry a destination scope and are reconciled before composition.

This prevents one place’s weather, safety score, venue list or accommodation context from being applied to another. Per-request fan-out is capped by `CHAT_MAX_MULTI_DESTINATION_TOOL_CALLS`.

## Context and memory

The context resolver separates:

- explicit destinations in the current message;
- origin, destination and transit roles;
- portable preferences such as diet, accessibility and pace;
- location-specific details that must be cleared after a destination switch;
- relative dates resolved from the browser’s local calendar and time zone;
- follow-up selections such as “which two” without rerunning unrelated sections.

Short conversation history and structured memory are stored in MongoDB. Redis supports caches, distributed limits and operational state. User-uploaded document vectors remain isolated in a Pinecone namespace derived from the user identity.

## Evidence and factual boundaries

Provider output is classified as verified, limited, unavailable or missing. Required specialist failures become visible evidence warnings rather than silent invention.

- Google Places supplies discovery, not hotel availability or confirmed prices.
- Routes results preserve departure times, transfers and walking distance; preferences are ranked with their trade-offs shown.
- Customs answers keep border rules, airport security and airline battery rules separate.
- Safety comparisons calculate and display a separate caution score for every destination. News attention alone cannot create a severe rating.
- Required Google and third-party attribution remains visible.
- Exact prices, opening status, accessibility and availability are stated only when supported by request-scoped evidence.

## Response contracts and UI

The response planner chooses an intent-specific contract rather than one generic destination template. The final renderer uses one clear title, progressive headings, short paragraphs and bounded lists.

Examples include:

- route: timing, ranked options, transfer/walking trade-offs, live map action;
- customs: usually permitted, declare or check, restricted, transit and official sources;
- safety comparison: one evidence block per destination and a plain conclusion;
- accommodation: requirements, discovery shortlist, total-price checks and booking boundary;
- multi-city itinerary: fair day split and separate activity, food and stay evidence per city.

Stored legacy answers retain their dedicated v1 renderer. New responses use the current structured response envelope and UI action contract.

The web client can export the visible conversation as a styled, multi-page A4 PDF. Export rendering stays in the browser and does not introduce another server-side data processor.

## Resilience, cost and observability

- provider-specific timeouts and bounded retries with jitter;
- circuit breakers and Redis-backed caching;
- per-user and global provider/LLM budgets;
- role-specific Groq routing: GPT-OSS 20B for planning and GPT-OSS 120B for final composition;
- native strict JSON Schema output for GPT-OSS planner and response calls;
- deterministic answer checks followed by one optional, bounded evidence-aware critic pass;
- no more than two evidence-preserving repair attempts for concrete quality failures;
- at most one Llama 3.3 70B compatibility fallback for retryable model failures, followed by deterministic ATLAS rendering;
- bounded specialist and multi-destination concurrency;
- idempotent requests and ownership-fenced conversation persistence;
- sanitized LangSmith structural traces without raw prompts, secrets or provider payloads;
- deterministic canary rollout and fallback to the established response path.

## Rollout flags

```env
ATLAS_AGENT_GRAPH_ENABLED=true
ATLAS_AGENT_HYBRID_ENABLED=true
ATLAS_AGENT_CANARY_PERCENT=10
ATLAS_AGENT_FALLBACK_ENABLED=true
ATLAS_AGENT_MAX_SPECIALISTS=6
ATLAS_AGENT_RESPONSE_REVIEW_ENABLED=false
CHAT_MAX_MULTI_DESTINATION_TOOL_CALLS=12
```

Start with the evaluation suite and a small canary. Increase traffic only after response-quality, provider-error, latency and cost metrics remain within the release thresholds.

## Verification

The repository includes regression coverage for guardrails, specialist routing, evidence reconciliation, long-context destination changes, relative dates, multi-city balance, safety comparisons, customs, accommodation boundaries and UI response contracts.

Run:

```bash
cd backend && npm test
cd ../frontend && npm test && npm run lint && npm run build
cd .. && docker compose config -q
```
