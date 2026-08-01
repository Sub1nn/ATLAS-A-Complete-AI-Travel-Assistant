import React, { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

const PolicyConsentPage = ({ onAccept, onLogout }) => {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onAccept();
    } catch (err) {
      setError(err.message || "Policy acceptance could not be saved.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#171817] px-5 text-[#f2f2ee]">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-[#3a3c3a] bg-[#222422] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <ShieldCheck className="h-8 w-8 text-[#9fc8b2]" />
        <h1 className="mt-5 text-2xl font-semibold">Review ATLAS data terms</h1>
        <p className="mt-3 text-sm leading-6 text-[#999b95]">ATLAS stores account details, conversations and uploaded document text to provide history and document-aware answers. Review the current documents before continuing.</p>
        <p className="mt-4 text-sm"><a className="text-[#b9ddc8] underline" href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a> · <a className="text-[#b9ddc8] underline" href="/terms.html" target="_blank" rel="noreferrer">Terms of use</a></p>
        <label className="mt-5 flex items-start gap-3 rounded-lg border border-[#3a3c3a] bg-[#1b1c1b] p-4 text-sm leading-6 text-[#bfc1bb]">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required className="mt-1 h-4 w-4 accent-[#8ab79d]" />
          <span>I accept the current privacy policy and terms.</span>
        </label>
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        <button disabled={!accepted || loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e7e8e3] px-4 py-3 font-semibold text-[#202220] transition hover:bg-white disabled:opacity-50">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Continue to ATLAS
        </button>
        <button type="button" onClick={onLogout} className="mt-3 w-full text-sm text-[#8e908b] hover:text-white">Sign out</button>
      </form>
    </main>
  );
};

export default PolicyConsentPage;
