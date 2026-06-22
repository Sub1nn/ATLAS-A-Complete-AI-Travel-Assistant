import React, { useState } from "react";
import { Download, LogOut, MessageSquarePlus, Shield, Trash2, UserX } from "lucide-react";
import { authAPI } from "../../services/api";

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
  const [retentionDays, setRetentionDays] = useState(Number(user?.dataRetentionDays || 365));
  const [deletePassword, setDeletePassword] = useState("");
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

  const deleteAccount = async () => {
    if (!deletePassword) return setPrivacyStatus("Enter your password to confirm deletion.");
    try {
      const deletion = await authAPI.deleteAccount(deletePassword);
      if (deletion.trackingToken) sessionStorage.setItem("atlas_deletion_token", deletion.trackingToken);
      window.location.replace(`/account-deletion-status.html${deletion.trackingToken ? `#token=${encodeURIComponent(deletion.trackingToken)}` : ""}`);
    } catch (error) {
      setPrivacyStatus(error.message || "Account deletion failed.");
    }
  };

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close history sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}
      <aside className={`${isMobileOpen ? "fixed inset-y-0 left-0 z-50 flex" : "hidden"} h-full w-80 shrink-0 flex-col border-r border-slate-800 bg-slate-950/95 lg:relative lg:inset-auto lg:z-auto lg:flex`}>

      <div className="border-b border-slate-800 p-4">
        <button
          type="button"
          onClick={() => { onNewChat?.(); onClose?.(); }}
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
                onClick={() => { onLoadConversation(item.id); onClose?.(); }}
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
                className="mt-2 inline-flex items-center text-xs text-slate-500 hover:text-rose-300 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus:opacity-100"
                title="Delete this chat"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </button>
            </div>
          ))}
          {hasMoreConversations && (
            <button type="button" onClick={onLoadMoreConversations} className="w-full rounded-xl border border-slate-800 px-3 py-2 text-xs text-sky-300 hover:bg-slate-900">
              Load older chats
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 p-4">
        <p className="text-sm font-medium text-slate-200">{user?.name}</p>
        <p className="text-xs text-slate-500">{user?.email}</p>

        <button type="button" onClick={() => setShowPrivacy((value) => !value)} className="mt-3 flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100">
          <Shield className="h-4 w-4" /> Privacy & data
        </button>

        {showPrivacy && (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
            <button type="button" onClick={exportAccountData} className="flex items-center gap-2 text-sky-300 hover:text-sky-200"><Download className="h-3.5 w-3.5" /> Export my data</button>
            <label className="block text-slate-400">Retention period
              <select value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-200">
                <option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option><option value={730}>2 years</option>
              </select>
            </label>
            <button type="button" onClick={saveRetention} className="text-sky-300 hover:text-sky-200">Save retention preference</button>
            <input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Password to delete account" className="w-full rounded-lg border border-rose-900/60 bg-slate-950 p-2 text-slate-200" />
            <button type="button" onClick={deleteAccount} className="flex items-center gap-2 text-rose-300 hover:text-rose-200"><UserX className="h-3.5 w-3.5" /> Permanently delete account</button>
            {privacyStatus && <p className="leading-5 text-slate-500">{privacyStatus}</p>}
          </div>
        )}

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
    </>
  );
};

export default HistorySidebar;
