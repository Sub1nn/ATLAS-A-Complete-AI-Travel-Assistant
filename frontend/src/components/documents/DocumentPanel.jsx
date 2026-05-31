import React, { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";

const DocumentPanel = ({
  documents,
  selectedDocumentIds,
  onDetachDocument,
  onDeleteDocument,
  onUpload,
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const selectedDocuments = selectedDocumentIds
    .map((id) => documents.find((doc) => String(doc.id) === String(id)))
    .filter(Boolean);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleRemove = async (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    onDetachDocument?.(id);
  };

  const handleDelete = async (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onDeleteDocument) return onDetachDocument?.(id);
    try {
      await onDeleteDocument(id);
    } catch (err) {
      setError(err.message || "Could not delete document");
    }
  };

  return (
    <section className="border-t border-slate-800 bg-slate-950/95 px-5 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-400/40 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {uploading ? "Reading document..." : "Upload PDF/DOCX"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleFile}
          className="hidden"
        />

        {selectedDocuments.map((doc) => (
          <div
            key={doc.id}
            className="inline-flex max-w-[280px] items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-200"
            title="This document is attached to the current chat"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{doc.name}</span>
            <button
              type="button"
              onClick={(event) => handleRemove(event, doc.id)}
              className="rounded-md p-0.5 text-sky-200/70 transition hover:bg-sky-400/10 hover:text-white"
              aria-label={`Remove ${doc.name} from this chat`}
              title="Remove from this chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {selectedDocuments.length > 0 && (
          <span className="text-xs text-slate-500">
            Attached only to this chat. New chat starts without this file.
          </span>
        )}

        {error && <span className="text-sm text-rose-300">{error}</span>}
      </div>
    </section>
  );
};

export default DocumentPanel;
