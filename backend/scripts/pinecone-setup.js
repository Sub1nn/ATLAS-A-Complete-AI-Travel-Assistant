import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Pinecone } from "@pinecone-database/pinecone";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const apiKey = process.env.PINECONE_API_KEY || "";
const indexName = process.env.PINECONE_INDEX_NAME || "atlas-documents";
const mode = String(process.env.PINECONE_INDEX_MODE || "inference").toLowerCase();
const dimension = Number(process.env.PINECONE_EMBEDDING_DIMENSIONS || 1024);
const cloud = process.env.PINECONE_CLOUD || "aws";
const region = process.env.PINECONE_REGION || "us-east-1";

if (!apiKey || /your_|replace_with|change_this/i.test(apiKey)) {
  console.error("PINECONE_API_KEY is missing or still a placeholder.");
  process.exit(1);
}

if (!/^[a-z0-9-]{1,45}$/.test(indexName)) {
  console.error("PINECONE_INDEX_NAME must contain only lowercase letters, numbers, and hyphens.");
  process.exit(1);
}

if (!Number.isInteger(dimension) || dimension < 1) {
  console.error("PINECONE_EMBEDDING_DIMENSIONS must be a positive integer.");
  process.exit(1);
}

const client = new Pinecone({ apiKey });
const indexes = await client.listIndexes();
const existing = indexes.indexes?.find((index) => index.name === indexName);

if (existing) {
  const description = await client.describeIndex(indexName);
  console.log(`Pinecone index '${indexName}' already exists.`);
  console.log(`Host: ${description.host}`);
  console.log(`Dimension: ${description.dimension || "provider-managed"}`);
  process.exit(0);
}

if (mode === "integrated") {
  console.error("Integrated-mode indexes must be created with a model and field mapping in Pinecone, then supplied through PINECONE_INDEX_NAME or PINECONE_INDEX_HOST.");
  console.error("For automatic setup, use PINECONE_INDEX_MODE=inference.");
  process.exit(1);
}

await client.createIndex({
  name: indexName,
  dimension,
  metric: "cosine",
  spec: { serverless: { cloud, region } },
  deletionProtection: "disabled",
  waitUntilReady: true,
  suppressConflicts: true,
});

const description = await client.describeIndex(indexName);
console.log(`Created Pinecone index '${indexName}'.`);
console.log(`Host: ${description.host}`);
console.log(`Dimension: ${description.dimension}`);
