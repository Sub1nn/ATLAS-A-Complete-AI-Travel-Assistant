import React from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

const MessageList = ({
  messages,
  isTyping,
  messagesContainerRef,
  messagesEndRef,
  onScroll,
  hasOlderMessages,
  onLoadOlderMessages,
}) => {
  const latestUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.type === "user")
    .at(-1)?.index;

  return (
    <div
      ref={messagesContainerRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto scroll-smooth"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 pb-24 sm:gap-9 sm:px-8 sm:py-10">
        {hasOlderMessages && (
          <button type="button" onClick={onLoadOlderMessages} className="mx-auto rounded-lg border border-[#3a3c3a] bg-[#202220] px-4 py-2 text-xs text-[#a9d0ba] hover:bg-[#292b29]">
            Load older messages
          </button>
        )}
        {messages.map((message, index) => (
          <div
            key={message.id || index}
            data-latest-user-message={
              index === latestUserIndex ? "true" : "false"
            }
          >
            <MessageBubble message={message} index={index} />
          </div>
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
