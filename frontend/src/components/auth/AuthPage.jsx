import React, { useEffect, useState } from "react";
import { FileText, Globe2, History, Loader2, ShieldCheck } from "lucide-react";

const benefits = [
  {
    icon: History,
    title: "Saved planning history",
    text: "Continue trip planning later without losing the previous context.",
  },
  {
    icon: FileText,
    title: "Document-aware chat",
    text: "Upload travel PDFs, bookings or DOCX files and ask questions about them.",
  },
  {
    icon: ShieldCheck,
    title: "Private workspace",
    text: "Your account keeps conversations and uploaded files tied to your session.",
  },
];

const AuthPage = ({ onLogin, onSignup, initialError = "", onClearInitialError }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(initialError || "");
  }, [initialError]);

  const switchMode = () => {
    setMode((current) => (current === "signup" ? "login" : "signup"));
    setError("");
    onClearInitialError?.();
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    onClearInitialError?.();
    setLoading(true);

    try {
      if (mode === "signup") {
        await onSignup({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      } else {
        await onLogin({
          email: form.email.trim(),
          password: form.password,
        });
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10">
              <Globe2 className="h-7 w-7 text-sky-300" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-[0.18em] text-white">ATLAS</p>
              <p className="text-sm text-slate-400">Travel Intelligence</p>
            </div>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
            Account required for the planning workspace
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Plan trips with memory, history and document-aware guidance.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
            Sign in to use ATLAS with persistent chat history, follow-up memory and document upload support. This keeps your travel context available across sessions.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
                  <Icon className="h-4 w-4 text-sky-300" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">
              {mode === "signup" ? "Create your ATLAS account" : "Sign in to ATLAS"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {mode === "signup"
                ? "Create an account to save chats, upload documents and continue planning later."
                : "Use your account to access saved history and continue previous trip plans."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="text-sm text-slate-300">Name</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Password</span>
              <input
                type="password"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </label>

            {error && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={switchMode}
            className="mt-5 text-sm font-medium text-sky-300 hover:text-sky-200"
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New to ATLAS? Create an account"}
          </button>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
