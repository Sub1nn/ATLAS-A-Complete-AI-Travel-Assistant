import React, { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";

const InputArea = ({
  inputMessage,
  setInputMessage,
  isLoading,
  onSendMessage,
  onKeyPress,
  documents = [],
  selectedDocumentIds = [],
  onUploadDocument,
  onDetachDocument,
}) => {
  const disabled = isLoading || !inputMessage.trim();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
              placeholder="Ask about destinations, hotels, safety, weather, food or local experiences..."
              className="max-h-36 min-h-[52px] flex-1 resize-none border-0 bg-transparent px-1 py-3 text-base leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70 sm:px-3"
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

        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
          <span>
            {uploadError ? (
              <span className="text-rose-300">{uploadError}</span>
            ) : uploading ? (
              "Reading document..."
            ) : selectedDocuments.length > 0 ? (
              "Attached file is used only in this chat"
            ) : (
              "Enter to send · Shift + Enter for a new line"
            )}
          </span>
          <span>{inputMessage.length}/1000</span>
        </div>
      </div>
    </footer>
  );
};

export default InputArea;
