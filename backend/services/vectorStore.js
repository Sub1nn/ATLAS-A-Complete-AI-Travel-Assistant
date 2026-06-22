import { logger } from "../utils/logger.js";
import { usageService } from "./usageService.js";

const DEFAULT_INDEX_NAME = "atlas-documents";
const DEFAULT_NAMESPACE_PREFIX = "atlas-user";
const DEFAULT_EMBEDDING_MODEL = "llama-text-embed-v2";
const DEFAULT_TOP_K = 8;
const DEFAULT_MIN_SCORE = 0.35;
const DEFAULT_TEXT_FIELD = "text";
const DEFAULT_INDEX_MODE = "inference"; // "inference" uses Pinecone Inference + vector upsert/query. "integrated" uses upsertRecords/searchRecords.
const UPSERT_BATCH_SIZE = 64;
const EMBED_BATCH_SIZE = 32;

let pineconeClientPromise;
let pineconeImportPromise;

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function explicitlyDisabled() {
  return /^(0|false|no|off)$/i.test(String(process.env.PINECONE_ENABLED || "").trim());
}

function hasApiKey() {
  return Boolean(process.env.PINECONE_API_KEY && !/your_|replace_with|change_this/i.test(process.env.PINECONE_API_KEY));
}

function indexName() {
  return process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || DEFAULT_INDEX_NAME;
}

function indexHost() {
  return process.env.PINECONE_INDEX_HOST || "";
}

function indexMode() {
  const mode = String(process.env.PINECONE_INDEX_MODE || DEFAULT_INDEX_MODE).toLowerCase().trim();
  return mode === "integrated" ? "integrated" : "inference";
}

function embeddingModel() {
  return process.env.PINECONE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

function textField() {
  return process.env.PINECONE_TEXT_FIELD || DEFAULT_TEXT_FIELD;
}

function minScore() {
  return Number(process.env.PINECONE_MIN_SCORE || DEFAULT_MIN_SCORE);
}

function topKDefault() {
  return Number(process.env.PINECONE_TOP_K || DEFAULT_TOP_K);
}

function configured() {
  if (explicitlyDisabled()) return false;
  if (!hasApiKey()) return false;
  return Boolean(indexName() || indexHost());
}

function configurationIssue() {
  if (explicitlyDisabled()) return "Pinecone is disabled by PINECONE_ENABLED=false";
  if (!hasApiKey()) return "PINECONE_API_KEY is missing or is still a placeholder";
  if (!indexName() && !indexHost()) return "PINECONE_INDEX_NAME or PINECONE_INDEX_HOST is required";
  return "Pinecone is configured";
}

export function namespaceFor(userId) {
  const prefix = process.env.PINECONE_NAMESPACE_PREFIX || DEFAULT_NAMESPACE_PREFIX;
  const safeUserId = String(userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "");
  return `${prefix}-${safeUserId}`;
}

function vectorId({ userId, documentId, chunkIndex }) {
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "");
  return `user:${safeUserId}:doc:${documentId}:chunk:${chunkIndex}`;
}

function sanitizeMetadata(metadata = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      clean[key] = value.filter((item) => typeof item === "string").slice(0, 20);
    } else if (["string", "number", "boolean"].includes(typeof value)) {
      clean[key] = value;
    } else if (value instanceof Date) {
      clean[key] = value.toISOString();
    }
  }
  return clean;
}

function chunkMetadata({ document, chunk }) {
  const text = String(chunk.text || "").slice(0, 3000);
  return sanitizeMetadata({
    userId: String(document.userId),
    documentId: String(document._id),
    chunkIndex: Number(chunk.index || 0),
    documentName: String(document.originalName || "uploaded-document").slice(0, 180),
    sourceType: "uploaded_document",
    chunkText: text,
    preview: text.slice(0, 500),
    createdAt: document.createdAt ? new Date(document.createdAt).toISOString() : new Date().toISOString(),
    embeddingModel: embeddingModel(),
  });
}

async function loadPinecone() {
  if (!pineconeImportPromise) {
    pineconeImportPromise = import("@pinecone-database/pinecone");
  }
  return pineconeImportPromise;
}

async function getClient() {
  if (!configured()) throw new Error(configurationIssue());
  if (!pineconeClientPromise) {
    pineconeClientPromise = loadPinecone().then(({ Pinecone }) => new Pinecone({ apiKey: process.env.PINECONE_API_KEY }));
  }
  return pineconeClientPromise;
}

async function getIndex() {
  const pc = await getClient();
  const options = { name: indexName() };
  if (indexHost()) options.host = indexHost();
  return pc.index(options);
}

function embeddingParameters(inputType) {
  const params = {
    inputType,
    truncate: process.env.PINECONE_EMBEDDING_TRUNCATE || "END",
  };

  // llama-text-embed-v2 supports configurable dimensions on recent Pinecone API versions.
  // Only pass this when the developer explicitly configures it so we do not accidentally
  // mismatch an existing index dimension.
  if (process.env.PINECONE_EMBEDDING_DIMENSIONS) {
    params.dimension = Number(process.env.PINECONE_EMBEDDING_DIMENSIONS);
  }

  return params;
}

async function reservePineconeCall(userId) {
  if (!userId) return;
  const budget = await usageService.reserveExternalCall(userId);
  if (!budget.allowed) {
    const error = new Error("Daily external-provider call budget reached before Pinecone request");
    error.code = "PROVIDER_BUDGET_EXCEEDED";
    error.status = 429;
    throw error;
  }
}

async function embedTexts(texts = [], inputType = "passage", { userId, shouldContinue } = {}) {
  if (!texts.length) return [];
  const pc = await getClient();
  const vectors = [];

  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    await shouldContinue?.();
    await reservePineconeCall(userId);
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE).map((text) => String(text || "").slice(0, 8000));
    const result = await pc.inference.embed({
      model: embeddingModel(),
      inputs: batch,
      parameters: embeddingParameters(inputType),
    });

    const batchVectors = (result?.data || []).map((item) => item?.values || []).filter((values) => Array.isArray(values) && values.length);
    if (batchVectors.length !== batch.length) {
      throw new Error(`Embedding provider returned ${batchVectors.length} vectors for ${batch.length} inputs`);
    }
    vectors.push(...batchVectors);
  }

  return vectors;
}

function normalizeVectorMatches(matches = []) {
  return matches
    .map((match) => ({
      id: match.id,
      documentId: match.metadata?.documentId,
      chunkIndex: Number(match.metadata?.chunkIndex || 0),
      score: Number(match.score || 0),
      text: match.metadata?.chunkText || match.metadata?.preview || "",
      name: match.metadata?.documentName || "Uploaded document",
      source: "pinecone_semantic_match",
      provider: "pinecone",
    }))
    .filter((match) => match.documentId && match.score >= minScore());
}

function normalizeIntegratedHits(hits = []) {
  return hits
    .map((hit) => {
      const fields = hit.fields || {};
      return {
        id: hit._id,
        documentId: fields.documentId,
        chunkIndex: Number(fields.chunkIndex || 0),
        score: Number(hit._score || 0),
        text: fields.chunkText || fields[textField()] || fields.preview || "",
        name: fields.documentName || "Uploaded document",
        source: "pinecone_integrated_semantic_match",
        provider: "pinecone",
      };
    })
    .filter((match) => match.documentId && match.score >= minScore());
}

async function upsertWithInferenceIndex(document, namespace, options = {}) {
  const chunks = (document.chunks || []).filter((chunk) => String(chunk.text || "").trim());
  if (!chunks.length) return { stored: false, provider: "pinecone", reason: "No chunks to index" };

  const index = await getIndex();
  let stored = 0;

  for (let start = 0; start < chunks.length; start += UPSERT_BATCH_SIZE) {
    const batch = chunks.slice(start, start + UPSERT_BATCH_SIZE);
    const embeddings = await embedTexts(batch.map((chunk) => chunk.text), "passage", { userId: document.userId, ...options });
    const records = batch.map((chunk, idx) => ({
      id: vectorId({ userId: document.userId, documentId: document._id, chunkIndex: chunk.index }),
      values: embeddings[idx],
      metadata: chunkMetadata({ document, chunk }),
    }));

    await options.shouldContinue?.();
    await reservePineconeCall(document.userId);
    await index.upsert({ records, namespace });
    stored += records.length;
  }

  return { stored: true, provider: "pinecone", mode: "inference", count: stored };
}

async function upsertWithIntegratedIndex(document, namespace, options = {}) {
  const chunks = (document.chunks || []).filter((chunk) => String(chunk.text || "").trim());
  if (!chunks.length) return { stored: false, provider: "pinecone", reason: "No chunks to index" };

  const index = await getIndex();
  let stored = 0;

  for (let start = 0; start < chunks.length; start += UPSERT_BATCH_SIZE) {
    const batch = chunks.slice(start, start + UPSERT_BATCH_SIZE);
    const records = batch.map((chunk) => ({
      _id: vectorId({ userId: document.userId, documentId: document._id, chunkIndex: chunk.index }),
      [textField()]: String(chunk.text || "").slice(0, 8000),
      ...chunkMetadata({ document, chunk }),
    }));

    await options.shouldContinue?.();
    await reservePineconeCall(document.userId);
    await index.upsertRecords({ records, namespace });
    stored += records.length;
  }

  return { stored: true, provider: "pinecone", mode: "integrated", count: stored };
}

export const vectorStore = {
  isConfigured: configured,
  configurationIssue,
  namespaceFor,
  indexMode,
  embeddingModel,
  indexName,

  async upsertDocumentChunks(document, options = {}) {
    if (!configured()) {
      return { stored: false, provider: "none", status: "skipped", reason: configurationIssue() };
    }

    const namespace = namespaceFor(document.userId);

    try {
      const result = indexMode() === "integrated"
        ? await upsertWithIntegratedIndex(document, namespace, options)
        : await upsertWithInferenceIndex(document, namespace, options);

      return { ...result, namespace, indexName: indexName(), embeddingModel: embeddingModel() };
    } catch (error) {
      logger.warn("Pinecone document upsert failed", { reason: error.message });
      return {
        stored: false,
        provider: "pinecone",
        status: "failed",
        namespace,
        indexName: indexName(),
        embeddingModel: embeddingModel(),
        reason: error.message,
      };
    }
  },

  async queryDocumentChunks({ userId, query, topK = topKDefault(), documentIds = [] }) {
    if (!configured() || !String(query || "").trim()) return [];

    const namespace = namespaceFor(userId);
    const filter = { userId: { $eq: String(userId) } };
    if (Array.isArray(documentIds) && documentIds.length) {
      filter.documentId = { $in: documentIds.map(String) };
    }

    try {
      const index = await getIndex();

      if (indexMode() === "integrated") {
        await reservePineconeCall(userId);
        const response = await index.searchRecords({
          namespace,
          query: {
            topK,
            inputs: { [textField()]: String(query).slice(0, 8000) },
            filter,
          },
          fields: ["documentId", "chunkIndex", "documentName", "chunkText", "preview", textField()],
        });
        return normalizeIntegratedHits(response?.result?.hits || []);
      }

      const [queryVector] = await embedTexts([query], "query", { userId });
      if (!queryVector?.length) return [];
      await reservePineconeCall(userId);
      const response = await index.query({
        namespace,
        vector: queryVector,
        topK,
        includeMetadata: true,
        includeValues: false,
        filter,
      });

      return normalizeVectorMatches(response?.matches || []);
    } catch (error) {
      logger.warn("Pinecone document query failed", { reason: error.message });
      return [];
    }
  },

  async deleteDocumentChunks({ userId, documentId, chunkCount = 0 }) {
    if (!configured()) return { deleted: false, provider: "none", reason: configurationIssue() };

    const namespace = namespaceFor(userId);
    const ids = Array.from({ length: Number(chunkCount || 0) }, (_, index) => vectorId({ userId, documentId, chunkIndex: index }));

    try {
      const index = await getIndex();
      if (ids.length) {
        await index.deleteMany({ ids, namespace });
      } else {
        await index.deleteMany({ namespace, filter: { documentId: { $eq: String(documentId) } } });
      }
      return { deleted: true, provider: "pinecone", namespace, count: ids.length };
    } catch (error) {
      logger.warn("Pinecone document delete failed", { reason: error.message });
      return { deleted: false, provider: "pinecone", namespace, reason: error.message };
    }
  },

  async deleteUserNamespace(userId) {
    if (!configured()) return { deleted: false, provider: "none", reason: configurationIssue() };
    const namespace = namespaceFor(userId);
    try {
      const index = await getIndex();
      await index.deleteAll({ namespace });
      return { deleted: true, provider: "pinecone", namespace };
    } catch (error) {
      logger.warn("Pinecone user namespace delete failed", { reason: error.message });
      return { deleted: false, provider: "pinecone", namespace, reason: error.message };
    }
  },

  // Exported for tests and future index setup checks. It does not call Pinecone.
  _test: {
    vectorId,
    sanitizeMetadata,
    chunkMetadata,
    configured,
    configurationIssue,
  },
};
