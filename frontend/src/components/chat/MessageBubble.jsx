import React from "react";
import { Bot, Clock, MapPin, User } from "lucide-react";
import { formatMessage } from "../../utils/formatMessage";

const MessageBubble = ({ message, index }) => {
  const isUser = message.type === "user";

  return (
    <div
      className={`flex animate-fade-in-up gap-4 ${
        isUser ? "justify-end" : "justify-start"
      }`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.24)}s` }}
    >
      {!isUser && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
          <Bot className="h-5 w-5 text-sky-300" />
        </div>
      )}

      <div
        className={`min-w-0 max-w-[900px] flex-1 ${
          isUser ? "flex justify-end" : ""
        }`}
      >
        <article
          className={`w-full rounded-3xl border p-5 shadow-sm sm:p-6 ${
            isUser
              ? "max-w-2xl border-sky-400/25 bg-sky-500/10 text-slate-100"
              : message.isError
              ? "border-rose-400/25 bg-rose-500/10 text-rose-50"
              : "border-slate-800 bg-slate-900/85 text-slate-100"
          }`}
        >
          {message.location && !isUser && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm font-medium text-slate-300">
              <MapPin className="h-4 w-4 text-sky-300" />
              {message.location}
            </div>
          )}

          <div className="message-content prose prose-invert max-w-none text-slate-200">
            {formatMessage(message.content)}
          </div>

          <footer className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>{message.timestamp.toLocaleTimeString()}</span>
            </div>
          </footer>
        </article>
      </div>

      {isUser && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900">
          <User className="h-5 w-5 text-slate-300" />
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
