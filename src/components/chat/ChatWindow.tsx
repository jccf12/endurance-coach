"use client";

import { useEffect, useRef } from "react";
import { ChatMessage, TypingIndicator } from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatWindowProps {
  messages: Array<ChatMessageType | { role: "user" | "assistant"; content: string; id: string }>;
  isLoading?: boolean;
  streamingContent?: string;
}

export function ChatWindow({ messages, isLoading, streamingContent }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} role={msg.role as "user" | "assistant"} content={msg.content} />
      ))}

      {/* Streaming message */}
      {streamingContent && (
        <ChatMessage role="assistant" content={streamingContent} isStreaming />
      )}

      {/* Typing indicator */}
      {isLoading && !streamingContent && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
