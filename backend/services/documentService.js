import { Document } from "../models/Document.js";

const STOP_WORDS = new Set(
  "the a an and or but of to in on for with from by at as is are was were be been this that these those it its into about can should could would i you me my your we our they them please summarize summary explain pdf document file uploaded attached according what where when how why".split(
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

const EMBEDDING_DIMS = 192;

function normalizeText(text = "") {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywords(text = "") {
  return [...new Set(normalizeText(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])]
    .filter((w) => !STOP_WORDS.has(w))
    .slice(0, 180);
}

function hashToken(token = "") {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function embeddingFor(text = "") {
  const vector = new Array(EMBEDDING_DIMS).fill(0);
  const words = keywords(text);

  for (const word of words) {
    const idx = hashToken(word) % EMBEDDING_DIMS;
    vector[idx] += 1;

    // Add light character n-gram features so document retrieval can match similar phrases,
    // names and spelling variants better than pure exact keyword matching.
    for (let i = 0; i < Math.max(0, word.length - 3); i += 1) {
      const gram = word.slice(i, i + 4);
      vector[hashToken(`g:${gram}`) % EMBEDDING_DIMS] += 0.25;
    }
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

function cosine(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) dot += Number(a[i] || 0) * Number(b[i] || 0);
  return dot;
}

function isGenericDocumentQuery(query = "") {
  const text = String(query || "").toLowerCase().trim();
  if (!text) return true;
  if (GENERIC_DOCUMENT_QUERIES.some((phrase) => text.includes(phrase))) return true;
  const qWords = keywords(text);
  return qWords.length <= 2 && /(summari[sz]e|explain|document|pdf|file|this)/i.test(text);
}

function chunkText(text = "", maxChars = 1200) {
  const clean = normalizeText(text);
  const chunks = [];

  for (let i = 0; i < clean.length; i += maxChars) {
    const slice = clean.slice(i, i + maxChars).trim();
    if (!slice) continue;
    chunks.push({ index: chunks.length, text: slice, keywords: keywords(slice), embedding: embeddingFor(slice) });
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
        source: "document_overview",
      }));
    }).slice(0, 12);
  }

  const q = new Set(keywords(query));
  const qEmbedding = embeddingFor(query);
  const scored = [];

  for (const doc of docs) {
    for (const chunk of doc.chunks || []) {
      const keywordScore = (chunk.keywords || []).reduce((sum, word) => sum + (q.has(word) ? 1 : 0), 0);
      const semanticScore = cosine(qEmbedding, chunk.embedding || embeddingFor(chunk.text || ""));
      const score = keywordScore * 1.5 + semanticScore * 6;
      if (score > 0.25) scored.push({ score, doc, chunk, semanticScore, keywordScore });
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
    .slice(0, 10)
    .map(({ doc, chunk, score, semanticScore, keywordScore }) => ({
      documentId: doc._id.toString(),
      name: doc.originalName,
      score: Number(score.toFixed(3)),
      text: chunk.text,
      chunkIndex: chunk.index,
      source: semanticScore > keywordScore ? "embedding_match" : "hybrid_match",
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
      .map((chunk) => `[chunk ${chunk.chunkIndex}, ${chunk.source || "match"}] ${String(chunk.text || "").trim()}`)
      .join("\n\n");
    sections.push(`Document: ${doc.name}\n${body}`);
  }

  return sections.join("\n\n---\n\n").slice(0, maxChars);
}

export const documentService = {
  extractText,
  chunkText,
  keywords,
  embeddingFor,
  isGenericDocumentQuery,
  searchUserDocuments,
  buildDocumentContext,
};
