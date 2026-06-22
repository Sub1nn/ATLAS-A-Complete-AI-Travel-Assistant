import { useCallback, useEffect, useRef, useState } from "react";
import { chatAPI, conversationAPI, documentAPI } from "../services/api";

const welcomeMessage = {
  id: "welcome",
  type: "assistant",
  content: "Welcome to ATLAS",
  timestamp: new Date(),
  tools: [],
};

const normalizeMessage = (message) => ({
  id: message.id || `${message.role}-${Date.now()}-${Math.random()}`,
  type: message.type || (message.role === "user" ? "user" : "assistant"),
  content: message.content,
  timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
  tools: [],
  metadata: message.metadata || {},
  isError: message.isError || false,
});

export const useChat = () => {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [nextConversationCursor, setNextConversationCursor] = useState(null);
  const [nextMessageCursor, setNextMessageCursor] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [chatError, setChatError] = useState("");
  const requestGenerationRef = useRef(0);
  const requestAbortRef = useRef(null);

  const cancelPendingRequest = useCallback(() => {
    requestGenerationRef.current += 1;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setIsLoading(false);
    setIsTyping(false);
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const page = await conversationAPI.listPage();
      setConversations(page.conversations || []);
      setNextConversationCursor(page.nextCursor || null);
    } catch (error) {
      console.error("Conversation list error", error);
    }
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (!nextConversationCursor) return;
    const page = await conversationAPI.listPage({ cursor: nextConversationCursor });
    setConversations((current) => {
      const seen = new Set(current.map((item) => item.id));
      return [...current, ...(page.conversations || []).filter((item) => !seen.has(item.id))];
    });
    setNextConversationCursor(page.nextCursor || null);
  }, [nextConversationCursor]);

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(await documentAPI.list());
    } catch (error) {
      console.error("Document list error", error);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshDocuments();
  }, [refreshConversations, refreshDocuments]);

  useEffect(() => {
    if (!documents.some((doc) => ["queued", "processing"].includes(doc.processingStatus))) return undefined;
    const timer = window.setInterval(refreshDocuments, 3000);
    return () => window.clearInterval(timer);
  }, [documents, refreshDocuments]);

  const startNewChat = () => {
    cancelPendingRequest();
    setActiveConversationId(null);
    setMessages([{ ...welcomeMessage, timestamp: new Date() }]);
    setInputMessage("");
    setSelectedDocumentIds([]);
    setChatError("");
    setNextMessageCursor(null);
  };

  const loadConversation = async (id) => {
    cancelPendingRequest();
    setChatError("");
    try {
      const conversation = await conversationAPI.get(id);
      setActiveConversationId(conversation.id);
      setSelectedDocumentIds((conversation.documentIds || []).map(String));
      const loaded = (conversation.messages || []).map(normalizeMessage);
      setMessages(loaded.length ? loaded : [{ ...welcomeMessage, timestamp: new Date() }]);
      setNextMessageCursor(conversation.nextMessageCursor || null);
    } catch (error) {
      setChatError(error.message || "Could not load this conversation.");
    }
  };

  const loadOlderMessages = async () => {
    if (!activeConversationId || !nextMessageCursor) return;
    try {
      const page = await conversationAPI.get(activeConversationId, { cursor: nextMessageCursor });
      const older = (page.messages || []).map(normalizeMessage);
      setMessages((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...older.filter((item) => !seen.has(item.id)), ...current];
      });
      setNextMessageCursor(page.nextMessageCursor || null);
    } catch (error) {
      setChatError(error.message || "Could not load older messages.");
    }
  };

  const deleteConversation = async (id) => {
    setChatError("");
    try {
      await conversationAPI.remove(id);
      if (id === activeConversationId) startNewChat();
      await refreshConversations();
    } catch (error) {
      setChatError(error.message || "Could not delete this conversation.");
    }
  };

  const clearHistory = async () => {
    setChatError("");
    try {
      await conversationAPI.clearAll();
      startNewChat();
      setConversations([]);
    } catch (error) {
      setChatError(error.message || "Could not clear conversation history.");
    }
  };

  const uploadDocument = async (file) => {
    const doc = await documentAPI.upload(file);
    setDocuments((prev) => [doc, ...prev.filter((item) => item.id !== doc.id)]);
    setChatError("Document uploaded and queued for processing. You can attach it when its status is ready.");
    return doc;
  };

  const detachDocument = (id) => {
    setSelectedDocumentIds((prev) => prev.filter((docId) => String(docId) !== String(id)));
  };

  const toggleDocument = (id) => {
    const document = documents.find((item) => String(item.id) === String(id));
    if (document && document.processingStatus && document.processingStatus !== "ready") {
      setChatError("This document is still processing and cannot be attached yet.");
      return;
    }
    setSelectedDocumentIds((prev) => {
      const key = String(id);
      if (prev.some((docId) => String(docId) === key)) {
        return prev.filter((docId) => String(docId) !== key);
      }
      if (prev.length >= 5) {
        setChatError("Attach at most 5 documents to one chat.");
        return prev;
      }
      setChatError("");
      return [...prev, key];
    });
  };

  const deleteDocument = async (id) => {
    setChatError("");
    try {
      await documentAPI.remove(id);
      setDocuments((prev) => prev.filter((doc) => String(doc.id) !== String(id)));
      detachDocument(id);
    } catch (error) {
      setChatError(error.message || "Could not delete this document.");
    }
  };

  const retryDocument = async (id) => {
    setChatError("");
    try {
      await documentAPI.retry(id);
      await refreshDocuments();
      setChatError("Document processing was queued for another attempt.");
    } catch (error) {
      setChatError(error.message || "Could not retry this document.");
    }
  };

  const sendMessage = async () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: trimmedMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev.filter((m) => m.id !== "welcome"), userMessage]);
    setInputMessage("");
    setChatError("");
    setIsLoading(true);
    setIsTyping(true);

    const requestId = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestId;
    const controller = new AbortController();
    requestAbortRef.current?.abort();
    requestAbortRef.current = controller;

    try {
      const data = await chatAPI.sendMessage({
        clientRequestId: crypto.randomUUID(),
        message: trimmedMessage,
        conversationId: activeConversationId,
        documentIds: selectedDocumentIds,
        signal: controller.signal,
      });

      if (requestGenerationRef.current !== requestId) return;

      setIsTyping(false);
      setActiveConversationId(data.conversationId);

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        content: data.result,
        timestamp: new Date(),
        tools: [],
        metadata: data.response_metadata || {},
      };

      setMessages((prev) => [...prev, assistantMessage]);
      refreshConversations();
    } catch (error) {
      if (controller.signal.aborted || requestGenerationRef.current !== requestId) return;
      setIsTyping(false);
      const authRelated = /auth|session|token|sign in|login/i.test(error.message || "");
      const verificationRequired = /verify your email|email verification/i.test(error.message || "");
      const errorMessage = {
        id: `error-${Date.now()}`,
        type: "assistant",
        content: verificationRequired
          ? "Please verify your email before using ATLAS chat and document features. Use the verification banner above to resend the link."
          : authRelated
          ? "Your session is not active. Please sign in again to continue using ATLAS."
          : "I could not complete that request right now. Please check the connection and try again.",
        timestamp: new Date(),
        tools: [],
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (requestGenerationRef.current === requestId) {
        requestAbortRef.current = null;
        setIsLoading(false);
        setIsTyping(false);
      }
    }
  };

  const resetContext = async () => {
    try {
      if (activeConversationId) await chatAPI.resetContext(activeConversationId);
    } catch (error) {
      console.error(error);
    }
    startNewChat();
    refreshConversations();
  };

  return {
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    isLoading,
    isTyping,
    sendMessage,
    resetContext,
    conversations,
    nextConversationCursor,
    loadMoreConversations,
    refreshConversations,
    activeConversationId,
    startNewChat,
    loadConversation,
    nextMessageCursor,
    loadOlderMessages,
    deleteConversation,
    clearHistory,
    documents,
    refreshDocuments,
    uploadDocument,
    selectedDocumentIds,
    setSelectedDocumentIds,
    toggleDocument,
    detachDocument,
    deleteDocument,
    retryDocument,
    chatError,
    clearChatError: () => setChatError(""),
  };
};
