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
  const parts = source.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
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
          className="font-medium text-sky-300 underline decoration-sky-500/40 underline-offset-4 hover:text-sky-200"
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
            className="font-medium text-sky-300 underline decoration-sky-500/40 underline-offset-4 hover:text-sky-200"
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
  /^(data note|price note|availability note|safety note|weather note|booking note|live data note)$/i.test(
    text,
  );

const shouldHideHeading = (text) =>
  /^(next steps|tools used|analysis sources used|\d+ tools? used)$/i.test(text);

const NoteBlock = ({ children }) => (
  <div className="my-4 flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3">
    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700 text-[10px] font-semibold text-slate-400">
      i
    </div>

    <p className="m-0 text-sm leading-6 text-slate-400">{children}</p>
  </div>
);

export const formatMessage = (content) => {
  const cleanContent = cleanMessage(content);

  if (!cleanContent) {
    return (
      <p className="text-slate-300">
        I could not prepare a readable answer for this request.
      </p>
    );
  }

  const lines = cleanContent.split("\n");
  const blocks = [];
  let currentList = [];
  let currentListType = null;
  let pendingNote = false;

  const flushList = (keyBase) => {
    if (currentList.length === 0) return;

    const ListTag = currentListType === "ordered" ? "ol" : "ul";
    blocks.push(
      <ListTag key={`list-${keyBase}`} className="my-4 space-y-2.5">
        {currentList.map((item, index) => (
          <li
            key={index}
            className="flex gap-3 text-[15px] leading-7 text-slate-300"
          >
            {currentListType === "ordered" ? (
              <span className="mt-0.5 w-6 shrink-0 text-right font-semibold text-sky-300">{index + 1}.</span>
            ) : (
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
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

      blocks.push(
        <div key={`heading-${index}`} className="mt-7 first:mt-0">
          <h3 className="text-[15px] font-semibold uppercase tracking-[0.14em] text-sky-300">
            {text}
          </h3>
          <div className="mt-3 h-px w-full bg-gradient-to-r from-sky-400/35 via-slate-700/50 to-transparent" />
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
        className="my-3 text-[15px] leading-7 text-slate-300 sm:text-base"
      >
        {renderInlineBold(line)}
      </p>,
    );
  });

  flushList("end");

  return <div className="space-y-1">{blocks}</div>;
};
