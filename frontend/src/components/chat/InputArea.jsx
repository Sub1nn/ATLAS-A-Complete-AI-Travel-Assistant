import React, { useMemo, useRef, useState } from "react";
import { FileText, Files, Loader2, Paperclip, RefreshCw, Send, Trash2, X } from "lucide-react";

const CHAT_MESSAGE_MAX_LENGTH = 3000;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const InputArea = ({
  inputMessage,
  setInputMessage,
  isLoading,
  onSendMessage,
  onKeyPress,
  documents = [],
  selectedDocumentIds = [],
  onUploadDocument,
  onToggleDocument,
  onDetachDocument,
  onDeleteDocument,
  onRetryDocument,
}) => {
  const disabled = isLoading || !inputMessage.trim();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showDocuments, setShowDocuments] = useState(false);

  const selectedDocuments = useMemo(
    () =>
      selectedDocumentIds
        .map((id) => documents.find((doc) => String(doc.id) === String(id)))
        .filter(Boolean),
    [documents, selectedDocumentIds],
  );

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadDocument) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Files must be 12 MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploadError("");
    setUploading(true);

    try {
      await onUploadDocument(file);
    } catch (error) {
      setUploadError(error.message || "Could not upload this file.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <footer className="border-t border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-3 shadow-2xl shadow-black/20 focus-within:border-sky-400/50 focus-within:ring-4 focus-within:ring-sky-400/10">
          {showDocuments && (
            <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Uploaded documents</p>
                  <p className="text-xs text-slate-500">Select up to five files for this chat.</p>
                </div>
                <button type="button" onClick={() => setShowDocuments(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Close document list">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {documents.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded yet.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {documents.map((doc) => {
                    const selected = selectedDocumentIds.some((id) => String(id) === String(doc.id));
                    const ready = !doc.processingStatus || doc.processingStatus === "ready";
                    return (
                      <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                        <button
                          type="button"
                          onClick={() => onToggleDocument?.(doc.id)}
                          disabled={!ready}
                          className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm transition disabled:cursor-wait disabled:opacity-60 ${selected ? "bg-sky-500/15 text-sky-100" : "text-slate-300 hover:bg-slate-800"}`}
                          aria-pressed={selected}
                        >
                          <span className="block truncate">{doc.name}</span>
                          <span className="text-[11px] text-slate-500">{selected ? "Attached" : ready ? "Click to attach" : doc.processingStatus} · {doc.vectorStatus || "local"}</span>
                        </button>
                        {doc.processingStatus === "failed" && (
                          <button
                            type="button"
                            onClick={() => onRetryDocument?.(doc.id)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-sky-500/10 hover:text-sky-300"
                            aria-label={`Retry processing ${doc.name}`}
                            title={doc.processingError || "Retry document processing"}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete ${doc.name}? This cannot be undone.`)) onDeleteDocument?.(doc.id);
                          }}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                          aria-label={`Delete ${doc.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedDocuments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 px-1">
              {selectedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="inline-flex max-w-[300px] items-center gap-2 rounded-xl border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-100"
                  title="This file is attached to the current chat"
                >
                  <FileText className="h-4 w-4 shrink-0 text-sky-300" />
                  <span className="truncate">{doc.name}</span>
                  {doc.vectorStatus && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        doc.vectorStatus === "indexed"
                          ? "bg-emerald-400/10 text-emerald-200"
                          : doc.vectorStatus === "failed"
                            ? "bg-amber-400/10 text-amber-200"
                            : "bg-slate-700/70 text-slate-300"
                      }`}
                      title={doc.indexingError || `Vector status: ${doc.vectorStatus}`}
                    >
                      {doc.vectorStatus === "indexed" ? "semantic" : doc.vectorStatus}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDetachDocument?.(doc.id)}
                    className="rounded-md p-0.5 text-sky-200/70 transition hover:bg-sky-400/10 hover:text-white"
                    aria-label={`Remove ${doc.name} from this chat`}
                    title="Remove from this chat"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => setShowDocuments((value) => !value)}
              disabled={isLoading}
              title="Manage uploaded documents"
              aria-label="Manage uploaded documents"
              className="mb-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-sky-400/50 hover:bg-slate-800 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Files className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || uploading}
              title="Upload file (PDF/DOCX/TXT)"
              aria-label="Upload file PDF, DOCX or TXT"
              className="mb-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-sky-400/50 hover:bg-slate-800 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileUpload}
              className="hidden"
            />

            <textarea
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              onKeyDown={onKeyPress}
              placeholder="Ask about destinations, hotels, safety, weather, food, sports, routes or uploaded documents..."
              className="max-h-36 min-h-[52px] flex-1 resize-none border-0 bg-transparent px-1 py-3 text-base leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70 sm:px-3"
              rows="1"
              disabled={isLoading}
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
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

        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
          <span>
            {uploadError ? (
              <span className="text-rose-300">{uploadError}</span>
            ) : uploading ? (
              "Reading document..."
            ) : selectedDocuments.some((doc) => doc.vectorStatus === "failed") ? (
              "Document uploaded, but Pinecone indexing failed. ATLAS will use local fallback search."
            ) : selectedDocuments.some((doc) => doc.vectorStatus === "indexed") ? (
              "Attached file is indexed with Pinecone semantic search"
            ) : selectedDocuments.length > 0 ? (
              "Attached file is used only in this chat"
            ) : (
              "Enter to send · Shift + Enter for a new line"
            )}
          </span>
          <span className={inputMessage.length > CHAT_MESSAGE_MAX_LENGTH * 0.9 ? "text-amber-300" : ""}>{inputMessage.length}/{CHAT_MESSAGE_MAX_LENGTH}</span>
        </div>
      </div>
    </footer>
  );
};

export default InputArea;
