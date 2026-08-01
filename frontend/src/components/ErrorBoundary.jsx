import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("ATLAS UI error", error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#171817] px-6 text-[#f2f2ee]">
        <div className="w-full max-w-lg rounded-2xl border border-[#3a3c3a] bg-[#222422] p-8 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9fc8b2]">ATLAS</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-[#999b95]">
            The workspace hit an unexpected interface error. Your saved conversations are kept on the server after sign-in.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-lg border border-[#414441] bg-[#1b1c1b] px-4 py-2 text-sm font-medium text-[#d6d7d2] transition hover:bg-[#292b29] hover:text-white"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-[#e7e8e3] px-4 py-2 text-sm font-semibold text-[#202220] transition hover:bg-white"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
