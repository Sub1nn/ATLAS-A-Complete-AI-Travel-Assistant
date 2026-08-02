import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  CloudSun,
  Download,
  Globe2,
  Hotel,
  Landmark,
  Map,
  Menu,
  Info,
  ShieldCheck,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import MessageList from "./chat/MessageList";
import InputArea from "./chat/InputArea";
import TripSuggestions from "./features/TripSuggestions";
import HistorySidebar from "./sidebar/HistorySidebar";
import { useChat } from "../hooks/useChat";
import { chatAPI } from "../services/api";

const features = [
  {
    icon: ShieldCheck,
    title: "Safety-aware planning",
    text: "Check current context, practical risks and travel precautions before committing.",
  },
  {
    icon: Map,
    title: "Live destination research",
    text: "Compare places, routes and local options with context from weather, maps and travel sources.",
  },
  {
    icon: Hotel,
    title: "Stays and budget guidance",
    text: "Plan accommodation areas, realistic price ranges and booking tradeoffs.",
  },
  {
    icon: Utensils,
    title: "Food and culture",
    text: "Understand local dining, etiquette and everyday travel expectations.",
  },
  {
    icon: Landmark,
    title: "Document-aware chat",
    text: "Upload PDF, DOCX or TXT files and ask questions about bookings, itineraries or travel notes.",
  },
  {
    icon: CloudSun,
    title: "Weather-aware timing",
    text: "Use forecasts to choose better times for outdoor plans, family trips and daily activities.",
  },
];

const TravelAssistant = ({ user, onLogout, onResendVerification }) => {
  const {
    messages,
    inputMessage,
    setInputMessage,
    isLoading,
    isTyping,
    sendMessage,
    conversations,
    nextConversationCursor,
    loadMoreConversations,
    activeConversationId,
    startNewChat,
    loadConversation,
    nextMessageCursor,
    loadOlderMessages,
    deleteConversation,
    clearHistory,
    documents,
    uploadDocument,
    selectedDocumentIds,
    toggleDocument,
    detachDocument,
    deleteDocument,
    retryDocument,
    chatError,
    clearChatError,
  } = useChat();

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState("checking");
  const [verificationNotice, setVerificationNotice] = useState("");
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const landingContainerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    let healthController = null;
    const checkHealth = async () => {
      if (inFlight) return;
      inFlight = true;
      healthController = new AbortController();
      try {
        const health = await chatAPI.healthCheck({ signal: healthController.signal });
        if (mounted) setServiceStatus(health.database === "connected" ? "online" : "degraded");
      } catch {
        if (mounted && !healthController.signal.aborted) setServiceStatus("offline");
      } finally {
        inFlight = false;
      }
    };
    checkHealth();
    const timer = window.setInterval(checkHealth, 60000);
    return () => {
      mounted = false;
      healthController?.abort();
      window.clearInterval(timer);
    };
  }, []);

  const hasStartedChat =
    messages.length > 1 || (messages.length === 1 && messages[0].id !== "welcome");
  const visibleMessages = hasStartedChat
    ? messages.filter((message) => message.id !== "welcome")
    : [];

  const handleResendVerification = async () => {
    setVerificationNotice("");
    try {
      const result = await onResendVerification();
      setVerificationNotice(result?.message || "Verification email sent.");
    } catch (error) {
      setVerificationNotice(error.message || "Could not send the verification email.");
    }
  };

  useEffect(() => {
    if (!hasStartedChat) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const latestUserMessage = container.querySelector(
      "[data-latest-user-message='true']"
    );

    latestUserMessage?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [visibleMessages.length, hasStartedChat]);

  const resetWorkspace = () => {
    startNewChat();
    setInputMessage("");
    setShowScrollButton(false);
  };

  const goHome = () => {
    if (hasStartedChat) {
      resetWorkspace();
    } else {
      setInputMessage("");
      setShowScrollButton(false);
    }

    requestAnimationFrame(() => {
      landingContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      messagesContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    setShowScrollButton(
      container.scrollHeight - container.scrollTop > container.clientHeight + 120
    );
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const exportCurrentChat = () => {
    const text = visibleMessages
      .map((message) => `${message.type === "user" ? "You" : "ATLAS"}: ${message.content}`)
      .join("\n\n");

    const blob = new Blob(
      [`ATLAS conversation export\n${new Date().toLocaleString()}\n\n${text}`],
      { type: "text/plain" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `atlas-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen bg-[#171817] text-[#f2f2ee] antialiased">
      <div className="flex h-full">
        <HistorySidebar
          user={user}
          conversations={conversations}
          hasMoreConversations={Boolean(nextConversationCursor)}
          onLoadMoreConversations={loadMoreConversations}
          activeConversationId={activeConversationId}
          onNewChat={resetWorkspace}
          onLoadConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          onClearHistory={clearHistory}
          onLogout={onLogout}
          isMobileOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col bg-[#171817]">
          <header className="shrink-0 border-b border-[#303230] bg-[#1a1b1a]">
            <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="mr-2 rounded-lg p-2 text-[#a5a7a1] transition hover:bg-[#292b29] hover:text-[#f2f2ee] lg:hidden"
                aria-label="Open chat history"
              >
                <Menu className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={goHome}
                className="group flex min-w-0 items-center gap-3 text-left"
                aria-label="Return to ATLAS home"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3a3c3a] bg-[#252725] transition group-hover:border-[#575a56]">
                  <Globe2 className="h-4 w-4 text-[#b9ddc8]" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-[15px] font-semibold tracking-[0.16em] text-[#f2f2ee]">
                      ATLAS
                    </h1>
                    <span className="hidden text-xs text-[#777a75] sm:inline">
                      Travel Intelligence
                    </span>
                  </div>

                  <p className="mt-0.5 truncate text-xs text-[#8e908b]">
                    Travel planning workspace
                  </p>
                </div>
              </button>

              <div className="hidden items-center gap-2 md:flex">
                <div className={`flex items-center gap-2 px-2 py-1 text-xs ${serviceStatus === "online" ? "text-[#9fc8b2]" : serviceStatus === "checking" ? "text-[#858782]" : "text-[#d2b680]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${serviceStatus === "online" ? "bg-[#77b894]" : serviceStatus === "checking" ? "bg-[#747672]" : "bg-[#c49a55]"}`} />
                  {serviceStatus === "online" ? "Online" : serviceStatus === "checking" ? "Checking" : "Degraded"}
                </div>

                <button
                  type="button"
                  onClick={exportCurrentChat}
                  disabled={visibleMessages.length === 0}
                  className="flex items-center gap-2 rounded-lg border border-[#343634] bg-[#222422] px-3 py-2 text-xs font-medium text-[#b3b5af] transition hover:bg-[#2a2c2a] hover:text-[#f2f2ee] disabled:cursor-not-allowed disabled:opacity-40"
                  title="Export current chat"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>
            </div>
          </header>

          {user?.publicPreview && !user?.emailVerified && (
            <div className="border-b border-[#354139] bg-[#1b211d] px-4 py-2 text-xs text-[#aebdb3] sm:px-6">
              <p className="mx-auto flex max-w-4xl items-center justify-center gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 text-[#94b5a1]" aria-hidden="true" />
                <span>
                  <span className="font-medium text-[#d8e3dc]">Public preview</span>
                  <span className="hidden sm:inline"> · Full access is enabled while email verification is optional.</span>
                </span>
              </p>
            </div>
          )}

          {!user?.publicPreview && !user?.emailVerified && (
            <div className="border-b border-[#54462f] bg-[#28231b] px-5 py-3 text-sm text-[#e3cfaa] sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>Please verify your email to keep your ATLAS account production-ready.</span>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="w-fit rounded-md border border-[#665538] px-3 py-1 text-xs font-medium text-[#ead9b8] transition hover:bg-[#332b20]"
                >
                  Resend verification link
                </button>
              </div>
              {verificationNotice && <p className="mx-auto mt-2 max-w-4xl text-xs text-[#cbb98f]">{verificationNotice}</p>}
            </div>
          )}

          {chatError && (
            <div className="border-b border-[#663d3d] bg-[#2b2020] px-5 py-3 text-sm text-[#e6bcbc] sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
                <span>{chatError}</span>
                <button type="button" onClick={clearChatError} className="rounded-md p-1 text-[#d9aaaa] hover:bg-[#3b2929]" aria-label="Dismiss error"><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          <main className="relative min-h-0 flex-1 overflow-hidden">
            {!hasStartedChat ? (
              <div ref={landingContainerRef} className="h-full overflow-y-auto">
                <section className="mx-auto w-full max-w-4xl px-5 pb-5 pt-14 sm:px-8 sm:pt-20">
                  <div className="border-b border-[#303230] pb-10 sm:pb-12">
                    <div className="max-w-3xl">
                      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-[#3c3e3c] bg-[#232523]">
                        <Sparkles className="h-4 w-4 text-[#b9ddc8]" />
                      </div>

                      <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#858782]">
                        ATLAS travel workspace
                      </p>
                      <h2 className="max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-[#f3f3ef] sm:text-5xl">
                        Make every trip feel considered.
                      </h2>

                      <p className="mt-5 max-w-2xl text-base leading-7 text-[#a6a8a2] sm:text-lg">
                        Research destinations, compare stays, check routes and shape
                        a practical plan with live travel context in one conversation.
                      </p>
                    </div>

                    <div className="mt-10 grid border-y border-[#303230] sm:grid-cols-2">
                      {features.map(({ icon: Icon, title, text }) => (
                        <div
                          key={title}
                          className="group flex gap-4 border-b border-[#303230] px-1 py-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-child(odd)]:pr-6 sm:[&:nth-child(even)]:pl-6"
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#252725] text-[#9fc8b2] transition group-hover:bg-[#2b2e2b]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-[#e4e5e0]">{title}</h3>
                            <p className="mt-1.5 text-sm leading-6 text-[#858782]">{text}</p>
                          </div>
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
                hasOlderMessages={Boolean(nextMessageCursor)}
                onLoadOlderMessages={loadOlderMessages}
              />
            )}

            {showScrollButton && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="fixed bottom-28 right-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#414441] bg-[#292b29] text-[#d7d8d3] shadow-lg shadow-black/20 transition hover:bg-[#333633] hover:text-white sm:bottom-32 sm:right-6"
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
            documents={documents}
            selectedDocumentIds={selectedDocumentIds}
            onUploadDocument={uploadDocument}
            onToggleDocument={toggleDocument}
            onDetachDocument={detachDocument}
            onDeleteDocument={deleteDocument}
            onRetryDocument={retryDocument}
          />
        </div>
      </div>
    </div>
  );
};

export default TravelAssistant;
