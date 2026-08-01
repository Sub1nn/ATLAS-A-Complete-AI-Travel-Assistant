import React from "react";
import { Bot } from "lucide-react";

const TypingIndicator = () => {
  return (
    <div className="flex animate-fade-in-up gap-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#3a3c3a] bg-[#242624]">
        <Bot className="h-4 w-4 text-[#a9d0ba]" />
      </div>

      <div className="px-2 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#92948e]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#92948e] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#92948e] [animation-delay:300ms]" />
          </div>
          <span className="text-sm text-[#858782]">
            ATLAS is preparing your answer
          </span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
