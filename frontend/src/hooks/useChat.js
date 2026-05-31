import { useCallback, useEffect, useState } from "react";
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
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);

  const refreshConversations = useCallback(async () => {
    if (!localStorage.getItem("atlas_token")) return;
    try {
      setConversations(await conversationAPI.list());
    } catch (error) {
      console.error("Conversation list error", error);
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    if (!localStorage.getItem("atlas_token")) return;
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

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([{ ...welcomeMessage, timestamp: new Date() }]);
    setInputMessage("");
    setSelectedDocumentIds([]);
  };

  const loadConversation = async (id) => {
    const conversation = await conversationAPI.get(id);
    setActiveConversationId(conversation.id);
    setSelectedDocumentIds((conversation.documentIds || []).map(String));
    const loaded = (conversation.messages || []).map(normalizeMessage);
    setMessages(loaded.length ? loaded : [{ ...welcomeMessage, timestamp: new Date() }]);
  };

  const deleteConversation = async (id) => {
    await conversationAPI.remove(id);
    if (id === activeConversationId) startNewChat();
    await refreshConversations();
  };

  const clearHistory = async () => {
    await conversationAPI.clearAll();
    startNewChat();
    setConversations([]);
  };

  const uploadDocument = async (file) => {
    const doc = await documentAPI.upload(file);
    setDocuments((prev) => [doc, ...prev.filter((item) => item.id !== doc.id)]);
    setSelectedDocumentIds([doc.id]);
    return doc;
  };

  const detachDocument = (id) => {
    setSelectedDocumentIds((prev) => prev.filter((docId) => String(docId) !== String(id)));
  };

  const deleteDocument = async (id) => {
    await documentAPI.remove(id);
    setDocuments((prev) => prev.filter((doc) => String(doc.id) !== String(id)));
    detachDocument(id);
  };

  const sendMessage = async () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isLoading) return;

    if (!localStorage.getItem("atlas_token")) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "welcome"),
        {
          id: `auth-required-${Date.now()}`,
          type: "assistant",
          content: "Please sign in or create an account to use ATLAS chat, save history and upload documents.",
          timestamp: new Date(),
          isError: true,
          tools: [],
        },
      ]);
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: trimmedMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev.filter((m) => m.id !== "welcome"), userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setIsTyping(true);

    try {
      const data = await chatAPI.sendMessage({
        message: trimmedMessage,
        conversationId: activeConversationId,
        documentIds: selectedDocumentIds,
      });

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

      setTimeout(() => setMessages((prev) => [...prev, assistantMessage]), 250);
      refreshConversations();
    } catch (error) {
      setIsTyping(false);
      const authRelated = /auth|session|token|sign in|login/i.test(error.message || "");
      const errorMessage = {
        id: `error-${Date.now()}`,
        type: "assistant",
        content: authRelated
          ? "Your session is not active. Please sign in again to continue using ATLAS."
          : "I could not complete that request right now. Please check the connection and try again.",
        timestamp: new Date(),
        tools: [],
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
    refreshConversations,
    activeConversationId,
    startNewChat,
    loadConversation,
    deleteConversation,
    clearHistory,
    documents,
    refreshDocuments,
    uploadDocument,
    selectedDocumentIds,
    setSelectedDocumentIds,
    detachDocument,
    deleteDocument,
  };
};
