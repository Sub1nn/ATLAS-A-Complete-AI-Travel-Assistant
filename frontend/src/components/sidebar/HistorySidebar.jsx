import React, { useState } from "react";
import { LogOut, MessageSquarePlus, Trash2 } from "lucide-react";

const HistorySidebar = ({
  user,
  conversations,
  activeConversationId,
  onNewChat,
  onLoadConversation,
  onDeleteConversation,
  onClearHistory,
  onLogout,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3500);
      return;
    }

    setConfirmClear(false);
    await onClearHistory?.();
  };

  return (
    <aside className="hidden h-full w-80 shrink-0 border-r border-slate-800 bg-slate-950/95 lg:flex lg:flex-col">
      <div className="border-b border-slate-800 p-4">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between gap-2 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            History
          </p>

          {conversations.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className={`rounded-lg px-2 py-1 text-xs transition ${
                confirmClear
                  ? "bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
                  : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
              }`}
              title={
                confirmClear
                  ? "Click again to clear all history"
                  : "Clear all chat history"
              }
            >
              {confirmClear ? "Confirm clear" : "Clear"}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {conversations.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-sm font-medium text-slate-300">
                No saved chats yet
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Start a conversation and ATLAS will keep it here for later.
              </p>
            </div>
          )}

          {conversations.map((item) => (
            <div
              key={item.id}
              className={`group rounded-2xl border p-3 transition ${
                item.id === activeConversationId
                  ? "border-sky-400/40 bg-sky-500/10"
                  : "border-slate-800 bg-slate-900/50 hover:bg-slate-900"
              }`}
            >
              <button
                type="button"
                onClick={() => onLoadConversation(item.id)}
                className="block w-full text-left"
              >
                <p className="line-clamp-1 text-sm font-medium text-slate-100">
                  {item.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {item.preview || "No messages yet"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onDeleteConversation(item.id)}
                className="mt-2 hidden items-center text-xs text-slate-500 hover:text-rose-300 group-hover:inline-flex"
                title="Delete this chat"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800 p-4">
        <p className="text-sm font-medium text-slate-200">{user?.name}</p>
        <p className="text-xs text-slate-500">{user?.email}</p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default HistorySidebar;
