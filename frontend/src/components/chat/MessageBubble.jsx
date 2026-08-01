import React from "react";
import { Bot, Clock, ExternalLink, MapPin, Navigation, Star, User } from "lucide-react";
import { formatMessage } from "../../utils/formatMessage";

const ratingLabel = (item) => {
  if (!item.rating) return null;
  const reviews = item.review_count ? ` · ${item.review_count} reviews` : "";
  return `${item.rating}/5${reviews}`;
};

const ActionCard = ({ item, index }) => (
  <a
    key={`${item.name}-${index}`}
    href={item.url}
    target="_blank"
    rel="noreferrer"
    className="group rounded-xl border border-[#343634] bg-[#202220] p-3 transition hover:border-[#4b4e4a] hover:bg-[#252725]"
    title={`Open ${item.name} in Maps`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium text-[#e5e6e1] group-hover:text-white">
          {item.name}
        </p>
        {item.address && !item.is_search && (
          <p className="mt-1 line-clamp-2 text-xs text-[#7f817c]">{item.address}</p>
        )}
        {ratingLabel(item) ? (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#a1a39d]">
            <Star className="h-3 w-3 fill-[#b9ddc8]/20 text-[#9fc8b2]" />
            {ratingLabel(item)}
          </p>
        ) : item.is_search ? (
          <p className="mt-2 text-xs text-[#7f817c]">Open live map search</p>
        ) : null}
      </div>
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#6f716c] transition group-hover:text-[#b9ddc8]" />
    </div>
  </a>
);

const LiveActions = ({ actions = [] }) => {
  const visible = actions.filter((item) => item?.url && item?.name).slice(0, 6);
  if (!visible.length) return null;
  const primary = visible.slice(0, 4);
  const additional = visible.slice(4);
  const hasVerifiedPlaces = visible.some((item) => item.verified && !item.is_search);
  const hasGoogleData = visible.some((item) => String(item.source || "").includes("google"));

  return (
    <div className="mt-5 rounded-xl border border-[#343634] bg-[#1c1e1c] p-3 sm:mt-6 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[#e5e6e1]">
          <Navigation className="h-4 w-4 text-[#9fc8b2]" />
          {hasVerifiedPlaces ? "Open place details" : "Map searches"}
        </div>
        <span className="text-xs text-[#777a75]">{hasGoogleData ? "Google Maps" : "ATLAS links"}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {primary.map((item, index) => <ActionCard key={`${item.name}-${index}`} item={item} index={index} />)}
      </div>
      {additional.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-[#a9d0ba] hover:text-[#d1eadc]">
            Show {additional.length} more map {additional.length === 1 ? "option" : "options"}
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {additional.map((item, index) => (
              <ActionCard key={`${item.name}-${index + primary.length}`} item={item} index={index + primary.length} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

const MessageBubble = ({ message, index }) => {
  const isUser = message.type === "user";
  const liveActions = !isUser ? message.metadata?.liveActions || message.metadata?.live_actions || [] : [];

  return (
    <div
      className={`flex animate-fade-in-up gap-2 sm:gap-4 ${
        isUser ? "justify-end" : "justify-start"
      }`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.24)}s` }}
    >
      {!isUser && (
        <div className="mt-0.5 hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#3a3c3a] bg-[#242624] sm:flex">
          <Bot className="h-4 w-4 text-[#a9d0ba]" />
        </div>
      )}

      <div
        className={`min-w-0 flex-1 ${
          isUser ? "flex justify-end" : ""
        }`}
      >
        <article
          className={`${
            isUser
              ? "max-w-[680px] rounded-2xl bg-[#2b2d2b] px-4 py-3 text-[#e6e7e2] sm:px-5 sm:py-4"
              : message.isError
              ? "w-full rounded-xl border border-[#633d3d] bg-[#2a2020] p-4 text-[#efcccc] sm:p-5"
              : "w-full px-1 pb-2 text-[#e8e9e4] sm:px-2"
          }`}
        >
          {message.location && !isUser && (
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-[#9fa19b]">
              <MapPin className="h-3.5 w-3.5 text-[#9fc8b2]" />
              {message.location}
            </div>
          )}

          <div className="message-content prose prose-invert max-w-none text-[#c8c9c3]">
            {formatMessage(message.content)}
          </div>

          <LiveActions actions={liveActions} />

          <footer className={`${isUser ? "mt-3 border-t border-[#3a3c3a] pt-3" : "mt-4"} flex items-center justify-between text-[11px] text-[#686a66]`}>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>{message.timestamp.toLocaleTimeString()}</span>
            </div>
          </footer>
        </article>
      </div>

      {isUser && (
        <div className="mt-0.5 hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#3a3c3a] bg-[#242624] sm:flex">
          <User className="h-4 w-4 text-[#aeb0aa]" />
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
