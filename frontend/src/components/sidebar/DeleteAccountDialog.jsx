import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { authAPI } from "../../services/api";

const CONFIRMATION_PHRASE = "DELETE";

const DeleteAccountDialog = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isDeleting) onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, isOpen, onClose]);

  if (!isOpen) return null;

  const confirmed = password.length > 0 && confirmation === CONFIRMATION_PHRASE;

  const deleteAccount = async (event) => {
    event.preventDefault();
    if (!confirmed || isDeleting) return;
    setError("");
    setIsDeleting(true);
    try {
      const deletion = await authAPI.deleteAccount(password);
      if (deletion.trackingToken) sessionStorage.setItem("atlas_deletion_token", deletion.trackingToken);
      const hash = deletion.trackingToken ? `#token=${encodeURIComponent(deletion.trackingToken)}` : "";
      window.location.replace(`/account-deletion-status.html${hash}`);
    } catch (requestError) {
      setError(requestError.message || "ATLAS could not start account deletion. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 py-8" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isDeleting) onClose?.();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-[#48413d] bg-[#202220] p-5 shadow-2xl shadow-black/50 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#432828] text-[#e8aaaa]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <button type="button" onClick={onClose} disabled={isDeleting} aria-label="Close account deletion dialog" className="rounded-lg p-2 text-[#8d8f89] transition hover:bg-[#2b2d2b] hover:text-[#e8e9e4] disabled:cursor-not-allowed disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 id="delete-account-title" className="mt-4 text-xl font-semibold text-[#f0f1ec]">Delete your ATLAS account?</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#a4a6a0]">
          This is permanent. You will be signed out immediately while ATLAS safely completes deletion in the background.
        </p>

        <div className="mt-4 rounded-xl border border-[#393b39] bg-[#1a1c1a] p-3.5">
          <p className="text-sm font-medium text-[#dedfda]">ATLAS will delete your:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-5 text-[#9b9d97] marker:text-[#b98e8e]">
            <li>Account, preferences, sessions and usage records</li>
            <li>Conversations, messages and agent memory checkpoints</li>
            <li>Uploaded files, extracted text and document metadata</li>
            <li>Document vectors from your private Pinecone namespace</li>
          </ul>
        </div>

        <p className="mt-3 text-xs leading-5 text-[#7f817c]">
          ATLAS keeps a pseudonymous deletion-status receipt for up to 30 days. Infrastructure backups, security logs and external providers may complete deletion under their own limited retention schedules.
        </p>

        <form onSubmit={deleteAccount} className="mt-4 space-y-3">
          <label className="block text-sm text-[#c7c8c3]">
            Password
            <input autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isDeleting} className="mt-2 w-full rounded-lg border border-[#414441] bg-[#181a18] px-3 py-2.5 text-[#eeeeea] outline-none transition focus:border-[#777a75] disabled:opacity-60" />
          </label>
          <label className="block text-sm text-[#c7c8c3]">
            Type <span className="font-semibold text-[#e5b0b0]">DELETE</span> to confirm
            <input type="text" autoComplete="off" spellCheck="false" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isDeleting} className="mt-2 w-full rounded-lg border border-[#573838] bg-[#211b1b] px-3 py-2.5 text-[#eeeeea] outline-none transition focus:border-[#936060] disabled:opacity-60" />
          </label>

          {error && <p role="alert" className="rounded-lg border border-[#663d3d] bg-[#321f1f] px-3 py-2.5 text-sm leading-5 text-[#efb7b7]">{error}</p>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={isDeleting} className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#b8bab4] transition hover:bg-[#2b2d2b] disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={!confirmed || isDeleting} className="flex items-center justify-center gap-2 rounded-lg bg-[#a94747] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#bc5050] disabled:cursor-not-allowed disabled:bg-[#4e3636] disabled:text-[#957c7c]">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeleting ? "Starting deletion…" : "Permanently delete account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default DeleteAccountDialog;
