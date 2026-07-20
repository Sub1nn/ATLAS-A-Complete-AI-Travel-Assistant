const UNSUPPORTED_PRICE_PATTERNS = [
  /(?:€|\$|£)\s?\d+[\d,.]*(?:\s*[–-]\s*(?:€|\$|£)?\s?\d+[\d,.]*)?(?:\s?(?:per|\/|a)\s?(?:night|person|day|meal|ticket))?/i,
  /\b\d+[\d,.]*\s?(?:EUR|USD|GBP)\b/i,
];

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

function containsUnsupportedPrice(answer = "", evidence = "") {
  return UNSUPPORTED_PRICE_PATTERNS.some((pattern) => pattern.test(answer) && !pattern.test(evidence));
}

function containsUnsupportedAvailability(answer = "", evidence = "") {
  return AVAILABILITY_PATTERNS.some((pattern) => pattern.test(answer) && !pattern.test(evidence));
}

function redactUnsupportedPrices(answer = "") {
  return UNSUPPORTED_PRICE_REDACTIONS.reduce(
    (output, pattern) => output.replace(pattern, "an unverified price estimate"),
    answer,
  );
}

function redactUnsupportedAvailability(answer = "") {
  return answer
    .replace(/\b(?:is|are) available\b/gi, "requires live availability confirmation")
    .replace(/\bhas rooms available\b/gi, "requires live room-availability confirmation")
    .replace(/\btables? available\b/gi, "table availability requires live confirmation")
    .replace(/\bopen from\s+\d[^\n,.]*/gi, "opening time requires direct confirmation")
    .replace(/\bopen until\s+\d[^\n,.]*/gi, "closing time requires direct confirmation");
}

function findVenueLikeLines(answer = "", evidence = "") {
  const lines = answer.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => {
    const candidate = line.replace(/^[-*•\d.)\s]+/, "").replace(/\*\*/g, "").split(/[:–-]/)[0].trim();
    if (candidate.length < 4 || candidate.length > 80) return false;
    if (!/\b(hotel|hostel|inn|restaurant|cafe|bar|museum|park|market|temple|palace|tour|center|centre)\b/i.test(line)) return false;
    return !evidence.includes(candidate.toLowerCase());
  });
}

export function verifyResponse({ answer = "", toolResults = [], documentMatches = [], documentFocused = false } = {}) {
  if (!answer.trim()) return { answer, verification: { modified: false, notes: [] } };

  const notes = [];
  const evidence = evidenceText(toolResults, documentMatches);
  const hasLiveEvidence = toolHasVerifiedLiveData(toolResults);
  let revised = softenGuarantees(answer);

  if (containsUnsupportedPrice(revised, evidence)) {
    revised = redactUnsupportedPrices(revised);
    notes.push("Unsupported exact prices were removed. Confirm current costs directly before booking.");
  }

  if (containsUnsupportedAvailability(revised, evidence)) {
    revised = redactUnsupportedAvailability(revised);
    notes.push("Unsupported live availability or opening-hour claims were removed. Confirm them on the official website or booking platform.");
  }

  const venueLikeLines = findVenueLikeLines(revised, evidence);
  if (venueLikeLines.length && !hasLiveEvidence && !documentFocused) {
    notes.push("Some venue examples may be planning suggestions rather than verified live search results. Check recent reviews, location and opening hours before going.");
  }

  if (/\b(safe|safety|risk|advisory)\b/i.test(revised) && !hasLiveEvidence && !evidence.includes("official advisory")) {
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
