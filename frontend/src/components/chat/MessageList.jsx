import React from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

const MessageList = ({
  messages,
  isTyping,
  messagesContainerRef,
  messagesEndRef,
  onScroll,
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 pb-32 sm:px-6 lg:px-8">
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
