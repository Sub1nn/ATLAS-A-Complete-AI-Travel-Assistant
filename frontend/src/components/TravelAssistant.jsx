import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Globe2,
  ShieldCheck,
  Sparkles,
  Map,
  Hotel,
  Utensils,
  Landmark,
  CloudSun,
} from "lucide-react";
import MessageList from "./chat/MessageList";
import InputArea from "./chat/InputArea";
import TripSuggestions from "./features/TripSuggestions";
import { useChat } from "../hooks/useChat";

const features = [
  {
    icon: ShieldCheck,
    title: "Safety context",
    text: "Understand practical risks, local conditions and travel precautions.",
  },
  {
    icon: Map,
    title: "Destination research",
    text: "Compare places using structured local and practical information.",
  },
  {
    icon: Hotel,
    title: "Stay planning",
    text: "Choose areas and accommodation styles based on your trip purpose.",
  },
  {
    icon: Utensils,
    title: "Food and culture",
    text: "Explore dining ideas, local customs and everyday travel expectations.",
  },
  {
    icon: Landmark,
    title: "Business travel",
    text: "Prepare for etiquette, meetings, transport and professional settings.",
  },
  {
    icon: CloudSun,
    title: "Weather-aware planning",
    text: "Plan clothing, timing and activities around practical weather factors.",
  },
];

const TravelAssistant = () => {
  const {
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    isLoading,
    isTyping,
    sendMessage,
  } = useChat();

  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const landingContainerRef = useRef(null);

  const hasStartedChat = messages.length > 1;
  const visibleMessages = hasStartedChat ? messages.slice(1) : [];

  useEffect(() => {
    if (!hasStartedChat) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const latestUserMessage = container.querySelector(
      "[data-latest-user-message='true']"
    );

    if (latestUserMessage) {
      latestUserMessage.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [visibleMessages.length, hasStartedChat]);

  const goHome = () => {
    if (hasStartedChat) {
      setMessages([
        {
          id: 1,
          type: "assistant",
          content: "Welcome to ATLAS",
          timestamp: new Date(),
          tools: [],
        },
      ]);
    }

    setInputMessage("");

    requestAnimationFrame(() => {
      landingContainerRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      messagesContainerRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollButton(scrollHeight - scrollTop > clientHeight + 120);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 antialiased">
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-slate-800 bg-slate-950/95">
          <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={goHome}
              className="group flex items-center gap-4 text-left transition"
              aria-label="Return to ATLAS home"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 transition group-hover:border-sky-400/40 group-hover:bg-sky-500/15">
                <Globe2 className="h-6 w-6 text-sky-300" />
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold tracking-[0.18em] text-white transition group-hover:text-sky-300 sm:text-2xl">
                    ATLAS
                  </h1>
                  <span className="hidden rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 sm:inline-flex">
                    Travel Intelligence
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400 transition group-hover:text-slate-300">
                  Plan safer, clearer and better-informed trips.
                </p>
              </div>
            </button>

            <div className="hidden items-center gap-3 md:flex">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm font-medium text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Online
              </div>

              <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-300">
                <ShieldCheck className="h-4 w-4 text-sky-300" />
                Travel planning workspace
              </div>
            </div>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-hidden">
          {!hasStartedChat ? (
            <div ref={landingContainerRef} className="h-full overflow-y-auto">
              <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 sm:p-10">
                  <div className="max-w-3xl">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm font-medium text-sky-300">
                      <Sparkles className="h-4 w-4" />
                      AI travel workspace
                    </div>

                    <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                      Research, compare and plan better trips with ATLAS.
                    </h2>

                    <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                      ATLAS helps you structure travel decisions using destination
                      research, safety context, weather checks, stay planning and
                      local recommendations.
                    </p>
                  </div>

                  <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map(({ icon: Icon, title, text }) => (
                      <div
                        key={title}
                        className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 transition hover:border-sky-400/30 hover:bg-slate-900"
                      >
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
                          <Icon className="h-5 w-5 text-sky-300" />
                        </div>
                        <h3 className="font-semibold text-slate-100">
                          {title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <TripSuggestions setInputMessage={setInputMessage} />
            </div>
          ) : (
            <MessageList
              messages={visibleMessages}
              isTyping={isTyping}
              messagesContainerRef={messagesContainerRef}
              messagesEndRef={messagesEndRef}
              onScroll={handleScroll}
            />
          )}

          {showScrollButton && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="fixed bottom-28 right-6 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 shadow-xl shadow-black/30 transition hover:border-sky-400/50 hover:bg-slate-800"
              aria-label="Scroll to latest message"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
          )}
        </main>

        <InputArea
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          onKeyPress={handleKeyPress}
        />
      </div>
    </div>
  );
};

export default TravelAssistant;
