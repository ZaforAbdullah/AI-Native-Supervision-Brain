"use client";
import { useRef, useState, useEffect, FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/components/ui/toast-provider";
import { chatApi, type ChatMessage } from "@/lib/api";
import { Sparkles, Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How many advisors are critical risk?",
  "Which advisors have an active EFM flag?",
  "What risk rules are currently configured?",
];

export default function ChatPage() {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation({
    mutationFn: (text: string) => chatApi.send(text, messages).then((r) => r.data.reply),
    onSuccess: (reply, text) => {
      setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: reply }]);
    },
    onError: () => showToast("Failed to get a response", "error"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sendMutation.isPending]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <AppLayout>
      <div className="space-y-4 h-[calc(100vh-104px)] flex flex-col">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ink-navy" /> AI Assistant
          </h1>
          <p className="text-[13px] text-muted mt-1">Ask questions about advisors, risk findings, and configured rules</p>
        </div>

        <div className="card flex-1 flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-[18px] py-4 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <MessageSquare className="w-8 h-8 text-line mb-3" />
                <p className="text-sm font-semibold text-muted mb-1">Ask me anything about your compliance data</p>
                <p className="text-xs text-muted-faint mb-4">Answers are grounded only in current advisor and rule data</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-[12px] px-3 py-1.5 bg-paper-subtle border border-line-soft rounded-full text-muted-body hover:bg-line-faint transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-ink-navy text-white"
                      : "bg-paper-subtle text-ink border border-line-soft"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-lg bg-paper-subtle border border-line-soft text-[13px] text-muted-faint">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-line-soft px-4 py-3.5 flex items-center gap-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your compliance data…"
              disabled={sendMutation.isPending}
              className="flex-1 border border-line-input rounded-md text-[13px] py-2.5 px-3 outline-none focus:ring-2 focus:ring-ink-navy/20 focus:border-ink-navy bg-white disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || sendMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-ink-navy hover:bg-ink-navy-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md text-[13px] font-semibold transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
