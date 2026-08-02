import React, { useEffect, useRef, useState } from "react";
import { Compass, FileText, Globe2, History, Info, Loader2 } from "lucide-react";

const benefits = [
  {
    icon: History,
    title: "Continue where you left off",
    text: "Return to saved trips without repeating destinations, preferences or earlier decisions.",
  },
  {
    icon: FileText,
    title: "Plan with your documents",
    text: "Ask questions about bookings, itineraries, PDFs and DOCX files.",
  },
  {
    icon: Compass,
    title: "Use current travel context",
    text: "Check places, routes, weather and practical travel details as your plan changes.",
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
  publicPreview = false,
  passwordRecoveryEnabled = true,
}) => {
  const [mode, setMode] = useState(initialMode || "login");
  const [form, setForm] = useState({ name: "", email: "", password: "", privacyAccepted: false });
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
          privacyAccepted: form.privacyAccepted,
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
    <div className="min-h-screen bg-[#171817] text-[#f2f2ee]">
      <div className="mx-auto grid min-h-screen max-w-6xl content-center gap-8 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-10">
        <section className="lg:col-start-1 lg:row-start-1">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3a3c3a] bg-[#242624]">
              <Globe2 className="h-[18px] w-[18px] text-[#b9ddc8]" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-[0.16em] text-[#f2f2ee]">
                ATLAS
              </p>
              <p className="text-xs text-[#7f817c]">Travel Intelligence</p>
            </div>
          </div>

          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8e908b]">
            Your AI travel planning workspace
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.06] tracking-[-0.04em] text-[#f3f3ef] sm:text-[3.35rem] lg:text-5xl xl:text-[3.35rem]">
            Plan better trips with an assistant that remembers.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#a9aba5]">
            ATLAS keeps your destinations, preferences, conversations and
            travel documents together, with current information on places,
            routes, weather and safety. Sign in to continue without starting
            over.
          </p>

        </section>

        <section className="rounded-2xl border border-[#3a3c3a] bg-[#222422] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          {publicPreview && mode !== "reset" && mode !== "verify" && (
            <div className="mb-5 flex gap-3 rounded-xl border border-[#496052] bg-[#1c2921] px-4 py-3 text-sm leading-6 text-[#c5d9cc]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#9fc8b2]" />
              <p>
                <span className="font-medium text-[#e0eee5]">Public preview.</span>{" "}
                Full access is enabled. Use a password you can remember
                {!passwordRecoveryEnabled && "; password recovery is temporarily unavailable"}.
              </p>
            </div>
          )}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#f2f2ee]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#999b95]">{subtitle}</p>
          </div>

          {mode !== "verify" && (
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <label className="block">
                  <span className="text-sm text-[#bfc1bb]">Name</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[#414441] bg-[#1b1c1b] px-4 py-3 text-[#f0f0ec] outline-none transition placeholder:text-[#666863] focus:border-[#698474]"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              {mode !== "reset" && (
                <label className="block">
                  <span className="text-sm text-[#bfc1bb]">Email</span>
                  <input
                    type="email"
                    className="mt-2 w-full rounded-xl border border-[#414441] bg-[#1b1c1b] px-4 py-3 text-[#f0f0ec] outline-none transition placeholder:text-[#666863] focus:border-[#698474]"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    autoComplete="email"
                    required
                  />
                  {mode === "signup" && (
                    <span className="mt-2 block text-xs leading-5 text-[#777a75]">
                      Use an address from a domain that can receive email.
                    </span>
                  )}
                </label>
              )}

              {mode !== "forgot" && (
                <label className="block">
                  <span className="text-sm text-[#bfc1bb]">Password</span>
                  <input
                    type="password"
                    className="mt-2 w-full rounded-xl border border-[#414441] bg-[#1b1c1b] px-4 py-3 text-[#f0f0ec] outline-none transition placeholder:text-[#666863] focus:border-[#698474]"
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

              {mode === "signup" && (
                <label className="flex items-start gap-3 rounded-lg border border-[#3a3c3a] bg-[#1b1c1b] p-3 text-sm leading-6 text-[#999b95]">
                  <input
                    type="checkbox"
                    checked={form.privacyAccepted}
                    onChange={(event) => setForm({ ...form, privacyAccepted: event.target.checked })}
                    className="mt-1 h-4 w-4 accent-[#8ab79d]"
                    required
                  />
                  <span>
                    I accept the <a href="/privacy.html" target="_blank" rel="noreferrer" className="text-[#b9ddc8] underline">privacy policy</a> and <a href="/terms.html" target="_blank" rel="noreferrer" className="text-[#b9ddc8] underline">terms</a>.
                  </span>
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e7e8e3] px-4 py-3 font-semibold text-[#202220] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
                <p className="flex items-center gap-2 text-sm text-[#bfc1bb]">
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

          <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium text-[#b9ddc8]">
            {mode !== "login" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="hover:text-[#d1eadc]"
              >
                Back to sign in
              </button>
            )}
            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="hover:text-[#d1eadc]"
              >
                New to ATLAS? Create an account
              </button>
            )}
            {mode === "login" && passwordRecoveryEnabled && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="hover:text-[#d1eadc]"
              >
                Forgot password?
              </button>
            )}
          </div>
        </section>

        <section aria-label="Why use ATLAS" className="grid gap-3 sm:grid-cols-3 lg:col-start-1 lg:row-start-2 lg:grid-cols-1 xl:grid-cols-3">
          {benefits.map(({ icon: Icon, title: itemTitle, text }) => (
            <div
              key={itemTitle}
              className="flex min-h-[164px] flex-col rounded-xl border border-[#343734] bg-[#1c1e1c] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)] lg:min-h-0 lg:flex-row xl:min-h-[164px] xl:flex-col"
            >
              <div className="mb-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#343734] bg-[#242624] lg:mb-0 lg:mr-4 xl:mb-4 xl:mr-0">
                <Icon className="h-4 w-4 text-[#9fc8b2]" />
              </div>
              <div>
                <h3 className="text-[15px] font-medium leading-5 text-[#e7e8e3]">
                  {itemTitle}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#a1a39d]">{text}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
