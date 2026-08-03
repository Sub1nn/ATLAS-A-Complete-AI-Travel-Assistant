const GUARANTEE_PATTERNS = [
  /\bguaranteed\b/gi,
  /\bdefinitely available\b/gi,
  /\balways safe\b/gi,
  /\bcompletely safe\b/gi,
  /\bno risk\b/gi,
];

const AVAILABILITY_PATTERNS = [
  /\b(?:is|are) available\b/i,
  /\bhas rooms available\b/i,
  /\btables? available\b/i,
  /\bopen from\s+\d/i,
  /\bopen until\s+\d/i,
  /\bare operational\b/i,
];

const UNSUPPORTED_PRICE_REDACTIONS = [
  /(?:€|\$|£)\s?\d+[\d,.]*(?:\s*[–-]\s*(?:€|\$|£)?\s?\d+[\d,.]*)?(?:\s?(?:per|\/|a)\s?(?:night|person|day|meal|ticket))?/gi,
  /\b\d+[\d,.]*\s?(?:EUR|USD|GBP)\b/gi,
];

function flattenValues(value, output = []) {
  if (value === null || value === undefined) return output;
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => flattenValues(item, output));
  else if (typeof value === "object") Object.values(value).forEach((item) => flattenValues(item, output));
  return output;
}

function evidenceText(toolResults = [], documentMatches = []) {
  return [
    ...flattenValues(toolResults),
    ...documentMatches.map((doc) => `${doc.name || ""} ${doc.text || ""}`),
  ].join("\n").toLowerCase();
}

function toolHasVerifiedLiveData(toolResults = []) {
  return toolResults.some((item) => {
    const result = item?.result || item || {};
    return result?.data_quality?.verified === true || result?.data_quality?.status === "verified" || result?.hourly_forecast?.length || result?.current_weather;
  });
}

function appendNote(answer, note) {
  if (answer.toLowerCase().includes(note.toLowerCase().slice(0, 50))) return answer;
  return `${answer.trim()}\n\n**Verification note**\n${note}`;
}

function softenGuarantees(answer) {
  let output = answer;
  for (const pattern of GUARANTEE_PATTERNS) {
    output = output.replace(pattern, (match, offset, fullText) => {
      const prefix = fullText.slice(Math.max(0, offset - 8), offset).toLowerCase();
      if (/\bnot\s+$/.test(prefix)) return match;
      if (/safe|risk/i.test(match)) return "lower-risk based on available information";
      return "likely";
    });
  }
  return output;
}

function containsUnsupportedAvailability(answer = "", evidence = "") {
  return AVAILABILITY_PATTERNS.some((pattern) => pattern.test(answer) && !pattern.test(evidence));
}

function redactUnsupportedPrices(answer = "", evidence = "", requestConstraints = {}) {
  const allowedBudget = Number(requestConstraints?.maxBudget);
  return UNSUPPORTED_PRICE_REDACTIONS.reduce(
    (output, pattern) => output.replace(pattern, (match) => {
      const numericAmount = Number(String(match).replace(/[^\d.]/g, ""));
      const isUserBudget = Number.isFinite(allowedBudget)
        && allowedBudget > 0
        && numericAmount === allowedBudget;
      const supportedByEvidence = evidence.includes(String(match).toLowerCase());
      return isUserBudget || supportedByEvidence ? match : "an unverified price estimate";
    }),
    answer,
  );
}

function redactUnsupportedAvailability(answer = "") {
  return answer
    .replace(/\b(?:is|are) available\b/gi, "requires live availability confirmation")
    .replace(/\bhas rooms available\b/gi, "requires live room-availability confirmation")
    .replace(/\btables? available\b/gi, "table availability requires live confirmation")
    .replace(/\bopen from\s+\d[^\n,.]*/gi, "opening time requires direct confirmation")
    .replace(/\bopen until\s+\d[^\n,.]*/gi, "closing time requires direct confirmation")
    .replace(/\bare operational\b/gi, "have an operational status that requires direct confirmation");
}

function qualifyUnsupportedAccessibility(answer = "", requestConstraints = {}) {
  const accessibilitySensitive = Boolean(
    requestConstraints?.accessible
    || requestConstraints?.senior
    || requestConstraints?.minimalWalking,
  );
  if (!accessibilitySensitive) return answer;

  return answer
    .replace(/\b(?:two|three|four|five)?\s*suitable (viewpoints?|places?|options?|venues?) (?:are|include)\b/gi, (match, noun) => `${noun} to verify include`)
    .replace(/\b(?:two|three|four|five)?\s*(viewpoints?|places?|options?|venues?) are recommended\b/gi, (match, noun) => `${noun} to verify are`)
    .replace(/\bviewpoints? that are suitable\b/gi, "viewpoint candidates whose access must be verified")
    .replace(/\bAccessible Viewpoints\b/gi, "Viewpoint access to verify")
    .replace(/\bViewpoints with Minimal Walking\b/gi, "Viewpoint access to verify")
    .replace(/:\s*(?:an?\s+)?viewpoint with an? (?:elevator|lift)[^\n.]*(?:\.|$)/gi, ": a viewpoint. Step-free access and the route from the drop-off point need direct confirmation.")
    .replace(/:\s*(?:an?\s+)?flat promenade[^\n.]*(?:\.|$)/gi, ": a viewpoint. Slope, surfaces and step-free access need direct confirmation.")
    .replace(/\bare easily accessible\b/gi, "require direct accessibility confirmation")
    .replace(/\bare accessible without requiring steep walking\b/gi, "need direct confirmation for slopes, surfaces and step-free access")
    .replace(/\bhas an? (?:elevator|lift)\b/gi, "may have lift access, but this needs direct confirmation")
    .replace(/\bis an? flat promenade\b/gi, "is a promenade whose slope and surfaces need direct confirmation")
    .replace(/\bmaking it accessible for those with mobility issues\b/gi, "so confirm the full step-free route directly")
    .replace(/\bmaking it easy to walk around\b/gi, "so confirm slopes, surfaces and resting points directly")
    .replace(/\bwith minimal walking required\b/gi, "with walking distance and slope requiring direct confirmation")
    .replace(/\bwith accessible walking paths\b/gi, "with path accessibility requiring direct confirmation")
    .replace(/\bis (?:easily )?accessible with minimal walking\b/gi, "needs direct confirmation for walking distance, slopes and steps")
    .replace(/\bare (?:easily )?accessible with minimal walking\b/gi, "need direct confirmation for walking distance, slopes and steps")
    .replace(/\bis suitable for (?:someone|those|travell?ers?) avoiding steep walking\b/gi, "needs direct confirmation for walking distance, slopes and steps")
    .replace(/\brequires? (?:little|minimal|no) walking\b/gi, "has walking requirements that need direct confirmation")
    .replace(/\bis accessible by (?:car|taxi|public (?:transport|transportation))[^\n.,;]*/gi, "needs direct confirmation for drop-off and public-transport access")
    .replace(/\bis located in an? flat area[^\n.]*/gi, "has a route whose slope, surfaces and walking distance need direct confirmation")
    .replace(/\b(?:visitors?\s+)?can take an? (?:taxi|ride[- ]hailing service)[^\n.]*to avoid walking\b/gi, "confirm a suitable door-to-door drop-off point; a vehicle ride does not prove the final approach is step-free")
    .replace(/^(\s*[-*•]\s*[^:\n]{2,120}):[^\n]*(?:accessible|minimal walking|flat area|steep walking)[^\n]*$/gim, "$1: live viewpoint candidate; confirm walking distance, slopes, steps, surfaces and drop-off access directly")
    .replace(/\b(?:is|are) (?:fully )?(?:wheelchair[- ]accessible|step[- ]free)\b/gi, "requires direct accessibility confirmation");
}

function qualifyUnsupportedFoundingDates(answer = "", evidence = "") {
  return answer.replace(/\b(?:was\s+)?founded in (\d{4})\b/gi, (match, year) => (
    evidence.includes(String(year).toLowerCase()) ? match : "developed during its early history"
  ));
}

function findVenueLikeLines(answer = "", evidence = "") {
  const lines = answer.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => {
    const candidate = line.replace(/^[-*•\d.)\s]+/, "").replace(/\*\*/g, "").split(/[:–-]/)[0].trim();
    if (candidate.length < 4 || candidate.length > 80) return false;
    // Planning instructions can contain words such as “hotel”, “park” or
    // “restaurant” without naming a venue. Do not attach a noisy verification
    // disclaimer to these action-led generic sentences.
    if (/^(?:choose|compare|confirm|check|search|look|use|keep|prioriti[sz]e|ask|stay|book|avoid|favour|favor|for|in|at|near)\b/i.test(candidate)) return false;
    if (!/\b(hotel|hostel|inn|restaurant|cafe|bar|museum|park|market|temple|palace|tour|center|centre)\b/i.test(line)) return false;
    return !evidence.includes(candidate.toLowerCase());
  });
}

export function verifyResponse({
  answer = "",
  toolResults = [],
  documentMatches = [],
  documentFocused = false,
  requestConstraints = {},
  allowAuthoritativeAmounts = false,
} = {}) {
  if (!answer.trim()) return { answer, verification: { modified: false, notes: [] } };

  const notes = [];
  const evidence = evidenceText(toolResults, documentMatches);
  const hasLiveEvidence = toolHasVerifiedLiveData(toolResults);
  let revised = softenGuarantees(answer);
  revised = qualifyUnsupportedFoundingDates(revised, evidence);

  const priceChecked = allowAuthoritativeAmounts
    ? revised
    : redactUnsupportedPrices(revised, evidence, requestConstraints);
  if (priceChecked !== revised) {
    revised = priceChecked;
    notes.push("Unsupported exact prices were removed. Confirm current costs directly before booking.");
  }

  if (containsUnsupportedAvailability(revised, evidence)) {
    revised = redactUnsupportedAvailability(revised);
    notes.push("Unsupported live availability or opening-hour claims were removed. Confirm them on the official website or booking platform.");
  }

  const accessibilityChecked = qualifyUnsupportedAccessibility(revised, requestConstraints);
  if (accessibilityChecked !== revised) {
    revised = accessibilityChecked;
  }

  const venueLikeLines = findVenueLikeLines(revised, evidence);
  if (venueLikeLines.length && !hasLiveEvidence && !documentFocused) {
    notes.push("Some venue examples may be planning suggestions rather than verified live search results. Check recent reviews, location and opening hours before going.");
  }

  const destinationSafetyContext = /\b(?:travel|personal|destination|local|current)\s+safety\b|\b(?:crime|conflict|unrest|terrorism|official travel advisory|risk score)\b/i.test(revised);
  if (destinationSafetyContext && !hasLiveEvidence && !evidence.includes("official advisory")) {
    notes.push("Safety information should be checked against official travel advisories before travel. Lack of matching news is not proof that a destination is safe.");
  }

  if (notes.length) {
    revised = appendNote(revised, [...new Set(notes)].join(" "));
  }

  return {
    answer: revised,
    verification: {
      modified: revised !== answer,
      notes: [...new Set(notes)],
    },
  };
}
