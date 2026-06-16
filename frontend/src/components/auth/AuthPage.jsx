import React, { useEffect, useRef, useState } from "react";
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

const AuthPage = ({
  onLogin,
  onSignup,
  onVerifyEmail,
  onForgotPassword,
  onResetPassword,
  initialMode = "login",
  actionToken = "",
  initialError = "",
  initialNotice = "",
  onClearInitialError,
  onClearInitialNotice,
}) => {
  const [mode, setMode] = useState(initialMode || "login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);
  const [loading, setLoading] = useState(false);
  const verifiedTokenRef = useRef("");

  useEffect(() => setError(initialError || ""), [initialError]);
  useEffect(() => setNotice(initialNotice || ""), [initialNotice]);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialMode !== "verify" || !actionToken) return;
    if (verifiedTokenRef.current === actionToken) return;

    verifiedTokenRef.current = actionToken;

    setError("");
    setNotice("");
    setLoading(true);

    const verify = async () => {
      try {
        const data = await onVerifyEmail(actionToken);

        setNotice(
          data.message ||
            "Email verified successfully. Opening your ATLAS workspace...",
        );
        setError("");
        setLoading(false);

        // Remove the single-use verification token from the browser URL before
        // navigating. This prevents repeated verification calls when React
        // re-renders or the user refreshes the page.
        window.history.replaceState({}, "", "/");

        // Force a clean app reload so App.jsx re-checks the verified session
        // from localStorage and opens the main workspace. Do not guard this
        // with a mounted flag because React StrictMode can run effect cleanup
        // during development before the request resolves.
        window.setTimeout(() => {
          window.location.replace("/");
        }, 600);
      } catch (err) {
        setLoading(false);
        setError(err.message || "Email verification failed.");
        setMode("login");
        window.history.replaceState({}, "", "/");
      }
    };

    verify();
  }, [actionToken, initialMode, onVerifyEmail]);

  const switchMode = (nextMode) => {
    setLoading(false);
    setMode(nextMode || (mode === "signup" ? "login" : "signup"));
    setError("");
    setNotice("");
    onClearInitialError?.();
    onClearInitialNotice?.();
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    onClearInitialError?.();
    onClearInitialNotice?.();
    setLoading(true);

    try {
      if (mode === "signup") {
        const data = await onSignup({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        if (data?.message) setNotice(data.message);
      } else if (mode === "forgot") {
        const data = await onForgotPassword(form.email.trim());
        setNotice(
          data.message || "If the email exists, a reset link has been sent.",
        );
      } else if (mode === "reset") {
        const data = await onResetPassword({
          token: actionToken,
          password: form.password,
        });
        setNotice(
          data.message || "Password reset successfully. You can sign in now.",
        );
        setMode("login");
        window.history.replaceState({}, "", "/");
      } else {
        await onLogin({ email: form.email.trim(), password: form.password });
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signup"
      ? "Create your ATLAS account"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Choose a new password"
          : mode === "verify"
            ? "Verify your email"
            : "Sign in to ATLAS";

  const subtitle =
    mode === "signup"
      ? "Create an account to save chats, upload documents and continue planning later."
      : mode === "forgot"
        ? "Enter your email and ATLAS will send a secure password reset link."
        : mode === "reset"
          ? "Enter a new password for your ATLAS account."
          : mode === "verify"
            ? "We are checking your verification link."
            : "Use your account to access saved history and continue previous trip plans.";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10">
              <Globe2 className="h-7 w-7 text-sky-300" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-[0.18em] text-white">
                ATLAS
              </p>
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
            Sign in to use ATLAS with persistent chat history, follow-up memory
            and document upload support. This keeps your travel context
            available across sessions.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {benefits.map(({ icon: Icon, title: itemTitle, text }) => (
              <div
                key={itemTitle}
                className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
                  <Icon className="h-4 w-4 text-sky-300" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {itemTitle}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
          </div>

          {mode !== "verify" && (
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

              {mode !== "reset" && (
                <label className="block">
                  <span className="text-sm text-slate-300">Email</span>
                  <input
                    type="email"
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    autoComplete="email"
                    required
                  />
                </label>
              )}

              {mode !== "forgot" && (
                <label className="block">
                  <span className="text-sm text-slate-300">Password</span>
                  <input
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    autoComplete={
                      mode === "signup" || mode === "reset"
                        ? "new-password"
                        : "current-password"
                    }
                    minLength={10}
                    required
                  />
                </label>
              )}

              {error && (
                <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-200">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Reset password"
                      : "Sign in"}
              </button>
            </form>
          )}

          {mode === "verify" && (
            <div className="space-y-4">
              {loading && (
                <p className="flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying
                  email...
                </p>
              )}
              {error && (
                <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-200">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
                  {notice}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium text-sky-300">
            {mode !== "login" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="hover:text-sky-200"
              >
                Back to sign in
              </button>
            )}
            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="hover:text-sky-200"
              >
                New to ATLAS? Create an account
              </button>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="hover:text-sky-200"
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="hover:text-sky-200"
              >
                Forgot password?
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
