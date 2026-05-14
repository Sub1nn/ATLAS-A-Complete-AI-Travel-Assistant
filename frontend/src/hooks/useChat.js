import { useState } from "react";
import { chatAPI } from "../services/api";

const welcomeMessage = {
  id: 1,
  type: "assistant",
  content: "Welcome to ATLAS",
  timestamp: new Date(),
  tools: [],
};

export const useChat = () => {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: "user",
      content: trimmedMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setIsTyping(true);

    try {
      const data = await chatAPI.sendMessage(trimmedMessage);
      setIsTyping(false);

      const assistantMessage = {
        id: Date.now() + 1,
        type: "assistant",
        content: data.result,
        timestamp: new Date(),
        tools: [],
        location: data.context_location,
        isError: false,
      };

      setTimeout(() => {
        setMessages((prev) => [...prev, assistantMessage]);
      }, 300);
    } catch (error) {
      setIsTyping(false);
      console.error("Chat error:", error);

      const errorMessage = {
        id: Date.now() + 1,
        type: "assistant",
        content:
          "I could not complete that request right now. Please check your connection and try once more.",
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
      await chatAPI.resetContext();
    } catch (error) {
      console.error("Reset context error:", error);
    } finally {
      setMessages([{ ...welcomeMessage, timestamp: new Date() }]);
      setInputMessage("");
    }
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
  };
};
