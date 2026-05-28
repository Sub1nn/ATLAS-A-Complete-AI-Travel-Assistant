import { Document } from "../models/Document.js";

const STOP_WORDS = new Set(
  "the a an and or but of to in on for with from by at as is are was were be been this that these those it its into about can should could would i you me my your we our they them please summarize summary explain pdf document file uploaded attached".split(
    " "
  )
);

const GENERIC_DOCUMENT_QUERIES = [
  "summarize",
  "summary",
  "summarise",
  "explain",
  "what is this",
  "what does this say",
  "this pdf",
  "this document",
  "uploaded file",
  "attached file",
  "can you please summarize this",
];

function keywords(text = "") {
  return [...new Set(String(text).toLowerCase().match(/[a-z0-9]{3,}/g) || [])]
    .filter((w) => !STOP_WORDS.has(w))
    .slice(0, 100);
}

function isGenericDocumentQuery(query = "") {
  const text = String(query || "").toLowerCase().trim();
  if (!text) return true;
  if (GENERIC_DOCUMENT_QUERIES.some((phrase) => text.includes(phrase))) return true;
  const qWords = keywords(text);
  return qWords.length <= 2 && /(summari[sz]e|explain|document|pdf|file|this)/i.test(text);
}

function chunkText(text = "", maxChars = 1200) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const chunks = [];

  for (let i = 0; i < clean.length; i += maxChars) {
    const slice = clean.slice(i, i + maxChars);
    chunks.push({ index: chunks.length, text: slice, keywords: keywords(slice) });
  }

  return chunks.slice(0, 300);
}

async function extractText(file) {
  if (!file) throw new Error("No file uploaded");

  const mime = file.mimetype || "";
  const name = file.originalname || "document";

  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
    const pdf = (await import("pdf-parse")).default;
    const parsed = await pdf(file.buffer);
    return parsed.text || "";
  }

  if (mime.includes("word") || name.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return parsed.value || "";
  }

  if (mime.includes("text") || name.toLowerCase().endsWith(".txt")) {
    return file.buffer.toString("utf8");
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX or TXT files.");
}

async function searchUserDocuments(userId, query = "", documentIds = []) {
  const filter = { userId };
  if (documentIds?.length) filter._id = { $in: documentIds };

  const docs = await Document.find(filter).limit(20).lean();
  if (!docs.length) return [];

  const genericQuery = isGenericDocumentQuery(query);

  if (genericQuery) {
    return docs.flatMap((doc) => {
      const chunks = doc.chunks || [];
      const firstChunks = chunks.slice(0, 8);
      const sampledChunks = chunks.length > 10 ? [chunks[Math.floor(chunks.length / 2)], chunks[chunks.length - 1]].filter(Boolean) : [];
      return [...firstChunks, ...sampledChunks].map((chunk, order) => ({
        documentId: doc._id.toString(),
        name: doc.originalName,
        score: 1 / (order + 1),
        text: chunk.text,
        chunkIndex: chunk.index,
        source: genericQuery ? "document_overview" : "keyword_match",
      }));
    }).slice(0, 10);
  }

  const q = new Set(keywords(query));
  const scored = [];

  for (const doc of docs) {
    for (const chunk of doc.chunks || []) {
      const score = (chunk.keywords || []).reduce((sum, word) => sum + (q.has(word) ? 1 : 0), 0);
      if (score > 0) scored.push({ score, doc, chunk });
    }
  }

  if (!scored.length) {
    return docs.flatMap((doc) => (doc.chunks || []).slice(0, 4).map((chunk, index) => ({
      documentId: doc._id.toString(),
      name: doc.originalName,
      score: 0.1 / (index + 1),
      text: chunk.text,
      chunkIndex: chunk.index,
      source: "fallback_overview",
    }))).slice(0, 6);
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ doc, chunk, score }) => ({
      documentId: doc._id.toString(),
      name: doc.originalName,
      score,
      text: chunk.text,
      chunkIndex: chunk.index,
      source: "keyword_match",
    }));
}

function buildDocumentContext(matches = [], maxChars = 5000) {
  if (!matches.length) return "";

  const byDoc = new Map();
  for (const match of matches) {
    if (!byDoc.has(match.documentId)) byDoc.set(match.documentId, { name: match.name, chunks: [] });
    byDoc.get(match.documentId).chunks.push(match);
  }

  const sections = [];
  for (const doc of byDoc.values()) {
    const body = doc.chunks
      .slice(0, 8)
      .map((chunk) => `[chunk ${chunk.chunkIndex}] ${String(chunk.text || "").trim()}`)
      .join("\n\n");
    sections.push(`Document: ${doc.name}\n${body}`);
  }

  return sections.join("\n\n---\n\n").slice(0, maxChars);
}

export const documentService = {
  extractText,
  chunkText,
  keywords,
  isGenericDocumentQuery,
  searchUserDocuments,
  buildDocumentContext,
};
