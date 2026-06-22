import fs from "fs/promises";

const [filePath, mimeType = "", originalName = "document"] = process.argv.slice(2);
const maxTextChars = Math.max(1000, Number(process.env.MAX_DOCUMENT_TEXT_CHARS || 250000));
const maxPages = Math.max(1, Number(process.env.MAX_DOCUMENT_PAGES || 300));

if (!filePath) throw new Error("Document path is required");

let text = "";
if (mimeType.includes("pdf") || originalName.toLowerCase().endsWith(".pdf")) {
  const pdf = (await import("pdf-parse")).default;
  const parsed = await pdf(await fs.readFile(filePath));
  if (Number(parsed.numpages || 0) > maxPages) throw new Error(`PDF exceeds the ${maxPages}-page limit`);
  text = parsed.text || "";
} else if (mimeType.includes("word") || originalName.toLowerCase().endsWith(".docx")) {
  const mammoth = await import("mammoth");
  const parsed = await mammoth.extractRawText({ path: filePath });
  text = parsed.value || "";
} else if (mimeType.includes("text") || originalName.toLowerCase().endsWith(".txt")) {
  text = await fs.readFile(filePath, "utf8");
} else {
  throw new Error("Unsupported document type");
}

process.stdout.write(String(text).slice(0, maxTextChars));
