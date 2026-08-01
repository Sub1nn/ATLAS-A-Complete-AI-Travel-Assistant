import React from "react";

const cleanMessage = (content = "") =>
  String(content || "")
    .replace(/<function\s*=\s*[^>]+>[\s\S]*?<\/function>/gi, "")
    .replace(/<function[\s\S]*?>[\s\S]*?<\/function>/gi, "")
    .replace(/<tool_call[\s\S]*?>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/(?:```json|```tool-use|```tool_call)[\s\S]*?```/g, "")
    .replace(/<\/?tool-use[\s\S]*?>/g, "")
    .replace(/{[^}]*"tool_calls"[^}]*}/g, "")
    .replace(/^\s*(Analysis sources used|\d+ tools? used|Tools used).*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const renderInlineBold = (text) => {
  const source = String(text);
  const parts = source.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*|_[^_\n]+_)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-[#f0f0ec]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <em key={index} className="text-[#a1a39d]">
          {part.slice(1, -1)}
        </em>
      );
    }

    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (markdownLink) {
      return (
        <a
          key={index}
          href={markdownLink[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[#b9ddc8] underline decoration-[#668474] underline-offset-4 hover:text-[#d1eadc]"
        >
          {markdownLink[1]}
        </a>
      );
    }

    if (/^https?:\/\//.test(part)) {
      const cleanUrl = part.replace(/[),.;:!?]+$/, "");
      const suffix = part.slice(cleanUrl.length);
      return (
        <React.Fragment key={index}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#b9ddc8] underline decoration-[#668474] underline-offset-4 hover:text-[#d1eadc]"
          >
            source
          </a>
          {suffix}
        </React.Fragment>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

const isHeading = (line) =>
  /^\s*(#{1,3}\s+.+|\*\*[^*]+\*\*)\s*$/.test(line);

const headingText = (line) =>
  line
    .replace(/^#{1,3}\s+/, "")
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .trim();

const isNoteHeading = (text) =>
  /^(data note|planning note|price note|availability note|safety note|weather note|booking note|route note|live data note)$/i.test(
    text,
  );

const shouldHideHeading = (text) =>
  /^(next steps|tools used|analysis sources used|\d+ tools? used)$/i.test(text);

const isCompactSubheading = (text) =>
  /^(what to do|food|food to try|where to stay|good base areas|local notes|local habits and logistics|experiences worth planning|experiences worth planning around|customs and packing checks|how to choose|map checks|before you go|budget note|price note|typical planning range)(?:\b|$)/i.test(
    text,
  );

const NoteBlock = ({ children }) => (
  <div className="my-4 rounded-lg border-l-2 border-[#688474] bg-[#202320] px-4 py-3">
    <p className="m-0 text-sm leading-6 text-[#bfc1bb]">{children}</p>
  </div>
);

export const formatMessage = (content) => {
  const cleanContent = cleanMessage(content);

  if (!cleanContent) {
    return (
      <p className="text-[#bfc1bb]">
        I could not prepare a readable answer for this request.
      </p>
    );
  }

  const lines = cleanContent.split("\n");
  const blocks = [];
  let currentList = [];
  let currentListType = null;
  let pendingNote = false;
  let headingCount = 0;

  const flushList = (keyBase) => {
    if (currentList.length === 0) return;

    const ListTag = currentListType === "ordered" ? "ol" : "ul";
    blocks.push(
      <ListTag key={`list-${keyBase}`} className="my-4 space-y-2.5">
        {currentList.map((item, index) => (
          <li
            key={index}
            className="flex gap-3 text-[15px] leading-7 text-[#c8c9c3]"
          >
            {currentListType === "ordered" ? (
              <span className="mt-0.5 w-6 shrink-0 text-right font-medium text-[#9fc8b2]">{index + 1}.</span>
            ) : (
              <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[#9fc8b2]" />
            )}
            <span>{renderInlineBold(item)}</span>
          </li>
        ))}
      </ListTag>,
    );

    currentList = [];
    currentListType = null;
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(index);
      return;
    }

    if (/^[•\-*]\s+/.test(line)) {
      if (currentListType && currentListType !== "unordered") flushList(index);
      currentListType = "unordered";
      currentList.push(line.replace(/^[•\-*]\s+/, "").trim());
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (currentListType && currentListType !== "ordered") flushList(index);
      currentListType = "ordered";
      currentList.push(line.replace(/^\d+\.\s+/, "").trim());
      return;
    }

    flushList(index);

    if (isHeading(line)) {
      const text = headingText(line);

      if (!text || shouldHideHeading(text)) return;

      if (isNoteHeading(text)) {
        pendingNote = true;
        return;
      }

      const isFirstHeading = headingCount === 0;
      headingCount += 1;
      const compactSubheading = !isFirstHeading && isCompactSubheading(text);

      blocks.push(
        <div
          key={`heading-${index}`}
          className={
            isFirstHeading
              ? "mb-4 mt-0"
              : compactSubheading
              ? "mt-5 first:mt-0"
              : "mt-7 first:mt-0"
          }
        >
          {isFirstHeading ? (
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#f2f2ee] sm:text-2xl">
              {text}
            </h2>
          ) : compactSubheading ? (
            <h4 className="text-sm font-semibold text-[#e7e8e3]">
              {text}
            </h4>
          ) : (
            <h3 className="text-[15px] font-semibold tracking-tight text-[#e4e5e0] sm:text-base">
              {text}
            </h3>
          )}
          {!isFirstHeading && !compactSubheading && (
            <div className="mt-3 h-px w-full bg-[#303230]" />
          )}
        </div>,
      );

      return;
    }

    if (pendingNote) {
      blocks.push(
        <NoteBlock key={`note-${index}`}>{renderInlineBold(line)}</NoteBlock>,
      );
      pendingNote = false;
      return;
    }

    blocks.push(
      <p
        key={`p-${index}`}
        className="my-3 text-[15px] leading-7 text-[#c8c9c3] sm:text-base"
      >
        {renderInlineBold(line)}
      </p>,
    );
  });

  flushList("end");

  return <div className="space-y-1">{blocks}</div>;
};
