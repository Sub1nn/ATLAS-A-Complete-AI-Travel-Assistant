import React, { useState } from "react";
import { Download, LogOut, MessageSquarePlus, Shield, Trash2, UserX } from "lucide-react";
import { authAPI } from "../../services/api";
import DeleteAccountDialog from "./DeleteAccountDialog";

const plainPreview = (value = "") => String(value || "")
  .replace(/!\[[^\]]*]\([^)]*\)/g, "")
  .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
  .replace(/^\s{0,3}#{1,6}\s+/gm, "")
  .replace(/[*_`~>|]/g, "")
  .replace(/^\s*[-+]\s+/gm, "")
  .replace(/\s+/g, " ")
  .trim();

const relativeTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const HistorySidebar = ({
  user,
  conversations,
  hasMoreConversations,
  onLoadMoreConversations,
  activeConversationId,
  onNewChat,
  onLoadConversation,
  onDeleteConversation,
  onClearHistory,
  onLogout,
  isMobileOpen = false,
  onClose,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [retentionDays, setRetentionDays] = useState(Number(user?.dataRetentionDays || 365));
  const [privacyStatus, setPrivacyStatus] = useState("");

  const handleClearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3500);
      return;
    }

    setConfirmClear(false);
    await onClearHistory?.();
  };

  const exportAccountData = async () => {
    setPrivacyStatus("Preparing export...");
    try {
      const response = await authAPI.exportData();
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `atlas-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setPrivacyStatus("Export downloaded.");
    } catch (error) {
      setPrivacyStatus(error.message || "Export failed.");
    }
  };

  const saveRetention = async () => {
    try {
      await authAPI.updateRetention(retentionDays);
      setPrivacyStatus("Retention preference saved.");
    } catch (error) {
      setPrivacyStatus(error.message || "Could not save retention preference.");
    }
  };

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close history sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      )}
      <aside className={`${isMobileOpen ? "fixed inset-y-0 left-0 z-50 flex" : "hidden"} h-full w-[280px] shrink-0 flex-col border-r border-[#303230] bg-[#202220] lg:relative lg:inset-auto lg:z-auto lg:flex`}>

      <div className="p-3 pb-2">
        <button
          type="button"
          onClick={() => { onNewChat?.(); onClose?.(); }}
          className="flex w-full items-center gap-2.5 rounded-xl border border-[#353835] bg-[#242624] px-3 py-2.5 text-sm font-medium text-[#ecece8] shadow-sm transition hover:border-[#454a46] hover:bg-[#2a2d2a] focus-visible:border-[#769581]"
        >
          <MessageSquarePlus className="h-4 w-4 text-[#a9d0ba]" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-3 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#858782]">
            Recent
          </p>

          {conversations.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className={`rounded-md px-2 py-1 text-xs transition ${
                confirmClear
                  ? "bg-[#432828] text-[#e0a7a7] hover:bg-[#4c2d2d]"
                  : "text-[#747671] hover:bg-[#2b2d2b] hover:text-[#bfc0bb]"
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

        <div className="space-y-0.5">
          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium text-[#b5b7b1]">
                No saved chats yet
              </p>
              <p className="mt-1 text-xs leading-5 text-[#747671]">
                Start a conversation and ATLAS will keep it here for later.
              </p>
            </div>
          )}

          {conversations.map((item) => (
            <div
              key={item.id}
              className={`group relative rounded-xl border px-3 py-2.5 transition ${
                item.id === activeConversationId
                  ? "border-[#454b47] bg-[#313431] shadow-sm"
                  : "border-transparent hover:border-[#303330] hover:bg-[#292b29]"
              }`}
            >
              <button
                type="button"
                onClick={() => { onLoadConversation(item.id); onClose?.(); }}
                className="block w-full text-left"
              >
                <div className="flex items-center gap-2 pr-6">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#e5e6e1]">{item.title}</p>
                  <span className="shrink-0 text-[10px] text-[#898b85]">{relativeTime(item.updatedAt)}</span>
                </div>
                <p className="mt-1 line-clamp-1 pr-4 text-xs text-[#7f817c]">
                  {plainPreview(item.preview) || "No messages yet"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onDeleteConversation(item.id)}
                className="absolute right-2 top-2 rounded-md p-1.5 text-[#777a75] transition hover:bg-[#432828] hover:text-[#e0a7a7] sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                title="Delete this chat"
                aria-label={`Delete ${item.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {hasMoreConversations && (
            <button type="button" onClick={onLoadMoreConversations} className="w-full rounded-lg px-3 py-2 text-xs text-[#9fc8b2] hover:bg-[#292b29]">
              Load older chats
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-[#303230] p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium text-[#dedfda]">{user?.name}</p>
          <p className="truncate text-xs text-[#898b85]">
            {user?.publicPreview && !user?.emailVerified ? "Public preview account" : user?.email}
          </p>
        </div>

        <button type="button" onClick={() => setShowPrivacy((value) => !value)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#a4a6a0] transition hover:bg-[#2b2d2b] hover:text-[#ededE9]">
          <Shield className="h-4 w-4" /> Privacy & data
        </button>

        {showPrivacy && (
          <div className="mx-2 mt-2 space-y-3 rounded-lg border border-[#3a3c3a] bg-[#1b1c1b] p-3 text-xs">
            <button type="button" onClick={exportAccountData} className="flex items-center gap-2 text-[#b5d5c3] hover:text-[#d1eadc]"><Download className="h-3.5 w-3.5" /> Export my data</button>
            <label className="block text-[#a4a6a0]">Retention period
              <select value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} className="mt-1 w-full rounded-md border border-[#414441] bg-[#242624] p-2 text-[#dedfda]">
                <option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option><option value={730}>2 years</option>
              </select>
            </label>
            <button type="button" onClick={saveRetention} className="text-[#b5d5c3] hover:text-[#d1eadc]">Save retention preference</button>
            {privacyStatus && <p className="leading-5 text-[#7f817c]">{privacyStatus}</p>}
          </div>
        )}

        <button type="button" onClick={() => setShowDeleteAccount(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#b98e8e] transition hover:bg-[#382626] hover:text-[#e1aaaa]">
          <UserX className="h-4 w-4" />
          Delete account
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#a4a6a0] transition hover:bg-[#2b2d2b] hover:text-[#ededE9]"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
      <DeleteAccountDialog isOpen={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} />
    </>
  );
};

export default HistorySidebar;
