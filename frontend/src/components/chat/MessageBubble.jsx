import React from "react";
import { Bot, Clock, ExternalLink, MapPin, Navigation, Star, User } from "lucide-react";
import { formatMessage } from "../../utils/formatMessage";

const ratingLabel = (item) => {
  if (!item.rating) return null;
  const reviews = item.review_count ? ` · ${item.review_count} reviews` : "";
  return `${item.rating}/5${reviews}`;
};

const LiveActions = ({ actions = [] }) => {
  const visible = actions.filter((item) => item?.url && item?.name).slice(0, 6);
  if (!visible.length) return null;
  const hasVerifiedPlaces = visible.some((item) => item.verified && !item.is_search);

  return (
    <div className="mt-5 rounded-2xl border border-sky-400/15 bg-slate-950/45 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Navigation className="h-4 w-4 text-sky-300" />
          {hasVerifiedPlaces ? "Verified places" : "Live map searches"}
        </div>
        <span className="text-xs text-slate-500">Open in Maps</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((item, index) => (
          <a
            key={`${item.name}-${index}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-slate-800 bg-slate-900/70 p-3 transition hover:border-sky-400/40 hover:bg-slate-900"
            title={`Open ${item.name} in Google Maps`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium text-slate-100 group-hover:text-sky-200">
                  {item.name}
                </p>
                {item.address && (
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.address}</p>
                )}
                {ratingLabel(item) ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400">
                    <Star className="h-3 w-3 fill-sky-300/20 text-sky-300" />
                    {ratingLabel(item)}
                  </p>
                ) : item.is_search ? (
                  <p className="mt-2 text-xs text-slate-500">Search result page</p>
                ) : null}
              </div>
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-sky-300" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

const MessageBubble = ({ message, index }) => {
  const isUser = message.type === "user";
  const liveActions = !isUser ? message.metadata?.liveActions || message.metadata?.live_actions || [] : [];

  return (
    <div
      className={`flex animate-fade-in-up gap-4 ${
        isUser ? "justify-end" : "justify-start"
      }`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.24)}s` }}
    >
      {!isUser && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
          <Bot className="h-5 w-5 text-sky-300" />
        </div>
      )}

      <div
        className={`min-w-0 max-w-[900px] flex-1 ${
          isUser ? "flex justify-end" : ""
        }`}
      >
        <article
          className={`w-full rounded-3xl border p-5 shadow-sm sm:p-6 ${
            isUser
              ? "max-w-2xl border-sky-400/25 bg-sky-500/10 text-slate-100"
              : message.isError
              ? "border-rose-400/25 bg-rose-500/10 text-rose-50"
              : "border-slate-800 bg-slate-900/85 text-slate-100"
          }`}
        >
          {message.location && !isUser && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm font-medium text-slate-300">
              <MapPin className="h-4 w-4 text-sky-300" />
              {message.location}
            </div>
          )}

          <div className="message-content prose prose-invert max-w-none text-slate-200">
            {formatMessage(message.content)}
          </div>

          <LiveActions actions={liveActions} />

          <footer className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>{message.timestamp.toLocaleTimeString()}</span>
            </div>
          </footer>
        </article>
      </div>

      {isUser && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900">
          <User className="h-5 w-5 text-slate-300" />
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
