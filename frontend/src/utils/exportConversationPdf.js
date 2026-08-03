const CANVAS_WIDTH = 1240;
const CANVAS_HEIGHT = 1754;
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const PAGE_MARGIN = 92;
const PAGE_BOTTOM = CANVAS_HEIGHT - 105;
const CONTENT_WIDTH = CANVAS_WIDTH - (PAGE_MARGIN * 2);
const FONT_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

const COLORS = {
  background: "#f7f7f3",
  ink: "#20221f",
  muted: "#6f746d",
  rule: "#d9ddd6",
  accent: "#507a64",
  accentSoft: "#e2ece5",
  user: "#3f4540",
};

const encodeText = (value) => new window.TextEncoder().encode(value);

const concatBytes = (parts) => {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
};

const decodeBase64 = (value) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/=+$/, "");
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
};

const canvasToJpeg = (canvas) => {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return decodeBase64(dataUrl.slice(dataUrl.indexOf(",") + 1));
};

const cleanInlineMarkdown = (value) => String(value || "")
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 — $2")
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/(\*\*|__)(.*?)\1/g, "$2")
  .replace(/(\*|_)(.*?)\1/g, "$2")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

const splitLongWord = (context, word, maxWidth) => {
  const pieces = [];
  let piece = "";

  for (const character of word) {
    const candidate = piece + character;
    if (piece && context.measureText(candidate).width > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  }

  if (piece) pieces.push(piece);
  return pieces;
};

const wrapText = (context, text, maxWidth) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let line = "";

  words.forEach((word) => {
    const pieces = context.measureText(word).width > maxWidth
      ? splitLongWord(context, word, maxWidth)
      : [word];

    pieces.forEach((piece) => {
      const candidate = line ? `${line} ${piece}` : piece;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = piece;
      } else {
        line = candidate;
      }
    });
  });

  if (line) lines.push(line);
  return lines;
};

const parseBlocks = (content) => String(content || "")
  .replace(/\r\n?/g, "\n")
  .split("\n")
  .map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return { type: "space", text: "" };

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      return {
        type: heading[1].length <= 2 ? "heading" : "subheading",
        text: cleanInlineMarkdown(heading[2]),
      };
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) return { type: "bullet", text: cleanInlineMarkdown(bullet[1]) };

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      return {
        type: "numbered",
        marker: `${numbered[1]}.`,
        text: cleanInlineMarkdown(numbered[2]),
      };
    }

    const quote = line.match(/^>\s*(.+)$/);
    if (quote) return { type: "quote", text: cleanInlineMarkdown(quote[1]) };

    if (/^\*\*[^*]+\*\*:?$/.test(line)) {
      return { type: "subheading", text: cleanInlineMarkdown(line) };
    }

    return { type: "paragraph", text: cleanInlineMarkdown(line) };
  });

const formatTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new window.Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const buildPdf = (images) => {
  const objectCount = 2 + (images.length * 3);
  const pageReferences = images.map((_, index) => `${3 + (index * 3)} 0 R`).join(" ");
  const objects = new Map();

  objects.set(1, [encodeText("<< /Type /Catalog /Pages 2 0 R >>")]);
  objects.set(2, [encodeText(`<< /Type /Pages /Count ${images.length} /Kids [${pageReferences}] >>`)]);

  images.forEach((image, index) => {
    const pageId = 3 + (index * 3);
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const stream = encodeText(`q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/Im0 Do\nQ\n`);

    objects.set(pageId, [encodeText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] `
      + `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    )]);
    objects.set(imageId, [
      encodeText(
        `<< /Type /XObject /Subtype /Image /Width ${CANVAS_WIDTH} /Height ${CANVAS_HEIGHT} `
        + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`
      ),
      image,
      encodeText("\nendstream"),
    ]);
    objects.set(contentId, [
      encodeText(`<< /Length ${stream.length} >>\nstream\n`),
      stream,
      encodeText("endstream"),
    ]);
  });

  const parts = [encodeText("%PDF-1.4\n")];
  const offsets = new Array(objectCount + 1).fill(0);
  let byteLength = parts[0].length;

  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = byteLength;
    const objectParts = [encodeText(`${id} 0 obj\n`), ...objects.get(id), encodeText("\nendobj\n")];
    objectParts.forEach((part) => {
      parts.push(part);
      byteLength += part.length;
    });
  }

  const crossReferenceOffset = byteLength;
  const crossReference = [
    `xref\n0 ${objectCount + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`,
  ].join("");

  parts.push(encodeText(crossReference));
  return concatBytes(parts);
};

export const createConversationPdf = async (messages, { exportedAt = new Date() } = {}) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("There is no conversation to export.");
  }

  await document.fonts?.ready;

  const pages = [];
  let canvas;
  let context;
  let cursorY;
  let currentSpeaker = "";

  const createPage = () => {
    canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not create the PDF canvas.");

    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.textBaseline = "alphabetic";

    context.fillStyle = COLORS.ink;
    context.font = `600 27px ${FONT_FAMILY}`;
    context.fillText("ATLAS", PAGE_MARGIN, 72);
    context.fillStyle = COLORS.accent;
    context.font = `500 16px ${FONT_FAMILY}`;
    context.fillText("TRAVEL INTELLIGENCE", PAGE_MARGIN + 115, 71);

    context.strokeStyle = COLORS.rule;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(PAGE_MARGIN, 96);
    context.lineTo(CANVAS_WIDTH - PAGE_MARGIN, 96);
    context.stroke();

    cursorY = 142;
  };

  const closePage = () => {
    context.strokeStyle = COLORS.rule;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(PAGE_MARGIN, CANVAS_HEIGHT - 74);
    context.lineTo(CANVAS_WIDTH - PAGE_MARGIN, CANVAS_HEIGHT - 74);
    context.stroke();
    context.fillStyle = COLORS.muted;
    context.font = `400 15px ${FONT_FAMILY}`;
    context.fillText("ATLAS conversation export", PAGE_MARGIN, CANVAS_HEIGHT - 42);
    context.textAlign = "right";
    context.fillText(`Page ${pages.length + 1}`, CANVAS_WIDTH - PAGE_MARGIN, CANVAS_HEIGHT - 42);
    context.textAlign = "left";
    pages.push(canvasToJpeg(canvas));
  };

  const nextPage = () => {
    closePage();
    createPage();
    if (currentSpeaker) {
      context.fillStyle = COLORS.muted;
      context.font = `600 15px ${FONT_FAMILY}`;
      context.fillText(`${currentSpeaker.toUpperCase()} · CONTINUED`, PAGE_MARGIN, cursorY);
      cursorY += 34;
    }
  };

  const ensureSpace = (height) => {
    if (cursorY + height > PAGE_BOTTOM) nextPage();
  };

  const drawWrapped = (text, {
    font = `400 24px ${FONT_FAMILY}`,
    color = COLORS.ink,
    lineHeight = 36,
    indent = 0,
    marker = "",
    spacingAfter = 13,
  } = {}) => {
    context.font = font;
    const markerWidth = marker ? 34 : 0;
    const lines = wrapText(context, text, CONTENT_WIDTH - indent - markerWidth);
    if (!lines.length) return;

    lines.forEach((line, lineIndex) => {
      ensureSpace(lineHeight);
      context.font = font;
      context.fillStyle = color;
      if (marker && lineIndex === 0) context.fillText(marker, PAGE_MARGIN + indent, cursorY);
      context.fillText(line, PAGE_MARGIN + indent + markerWidth, cursorY);
      cursorY += lineHeight;
    });
    cursorY += spacingAfter;
  };

  createPage();
  context.fillStyle = COLORS.ink;
  context.font = `650 44px ${FONT_FAMILY}`;
  context.fillText("Conversation", PAGE_MARGIN, cursorY);
  cursorY += 43;
  context.fillStyle = COLORS.muted;
  context.font = `400 18px ${FONT_FAMILY}`;
  context.fillText(`Exported ${formatTimestamp(exportedAt)}`, PAGE_MARGIN, cursorY);
  cursorY += 62;

  messages.forEach((message, messageIndex) => {
    const isUser = message.type === "user";
    currentSpeaker = isUser ? "You" : message.isError ? "ATLAS notice" : "ATLAS";
    ensureSpace(92);

    if (messageIndex > 0) {
      context.strokeStyle = COLORS.rule;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(PAGE_MARGIN, cursorY);
      context.lineTo(CANVAS_WIDTH - PAGE_MARGIN, cursorY);
      context.stroke();
      cursorY += 35;
    }

    context.fillStyle = isUser ? COLORS.user : COLORS.accent;
    context.font = `650 17px ${FONT_FAMILY}`;
    context.fillText(currentSpeaker.toUpperCase(), PAGE_MARGIN, cursorY);

    const timestamp = formatTimestamp(message.timestamp || message.createdAt);
    if (timestamp) {
      context.fillStyle = COLORS.muted;
      context.font = `400 15px ${FONT_FAMILY}`;
      context.textAlign = "right";
      context.fillText(timestamp, CANVAS_WIDTH - PAGE_MARGIN, cursorY);
      context.textAlign = "left";
    }
    cursorY += 42;

    parseBlocks(message.content).forEach((block) => {
      if (block.type === "space") {
        cursorY += 11;
        return;
      }

      if (block.type === "heading") {
        ensureSpace(62);
        drawWrapped(block.text, {
          font: `650 31px ${FONT_FAMILY}`,
          lineHeight: 42,
          spacingAfter: 17,
        });
        return;
      }

      if (block.type === "subheading") {
        ensureSpace(52);
        drawWrapped(block.text, {
          font: `650 25px ${FONT_FAMILY}`,
          lineHeight: 36,
          spacingAfter: 12,
        });
        return;
      }

      if (block.type === "bullet" || block.type === "numbered") {
        drawWrapped(block.text, {
          marker: block.type === "bullet" ? "•" : block.marker,
          indent: 12,
          spacingAfter: 9,
        });
        return;
      }

      if (block.type === "quote") {
        drawWrapped(block.text, {
          color: COLORS.muted,
          indent: 24,
          font: `italic 400 23px ${FONT_FAMILY}`,
        });
        return;
      }

      drawWrapped(block.text);
    });

    cursorY += 16;
  });

  closePage();
  return new Blob([buildPdf(pages)], { type: "application/pdf" });
};

export const downloadConversationPdf = async (messages, { exportedAt = new Date() } = {}) => {
  const blob = await createConversationPdf(messages, { exportedAt });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = exportedAt.toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `atlas-conversation-${date}.pdf`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
