import React from "react";
import { Bot } from "lucide-react";

const TypingIndicator = () => {
  return (
    <div className="flex animate-fade-in-up gap-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
        <Bot className="h-5 w-5 text-sky-300" />
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/85 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
          <span className="text-sm font-medium text-slate-400">
            Preparing a clear travel answer...
          </span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
