import React from "react";
import { Loader2, Send } from "lucide-react";

const InputArea = ({
  inputMessage,
  setInputMessage,
  isLoading,
  onSendMessage,
  onKeyPress,
}) => {
  const disabled = isLoading || !inputMessage.trim();

  return (
    <footer className="border-t border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-3 shadow-2xl shadow-black/20 focus-within:border-sky-400/50 focus-within:ring-4 focus-within:ring-sky-400/10">
          <div className="flex items-end gap-3">
            <textarea
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              onKeyDown={onKeyPress}
              placeholder="Ask about destinations, hotels, safety, weather, food or local experiences..."
              className="max-h-36 min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-base leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
              rows="1"
              disabled={isLoading}
              maxLength={1000}
            />

            <button
              type="button"
              onClick={onSendMessage}
              disabled={disabled}
              className={`inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition focus:outline-none focus:ring-2 focus:ring-sky-400/40 ${
                disabled
                  ? "cursor-not-allowed bg-slate-800 text-slate-500"
                  : "bg-sky-500 text-white shadow-lg shadow-sky-950/30 hover:bg-sky-400"
              }`}
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-500">
          <span>Enter to send · Shift + Enter for a new line</span>
          <span>{inputMessage.length}/1000</span>
        </div>
      </div>
    </footer>
  );
};

export default InputArea;
