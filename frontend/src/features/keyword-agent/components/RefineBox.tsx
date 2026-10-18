import React, { useState } from "react";
import { Button, Input, Card, CardBody, Avatar } from "@heroui/react";
import { Send, Sparkles, Bot, User, CornerDownLeft } from "lucide-react";
import { chatRefine } from "../api";

interface Props {
  runId: string;
}

interface Message {
  sender: "user" | "assistant";
  text: string;
  ts: Date;
}

const QUICK_PROMPTS = [
  "Make title more casual & streetwear-focused",
  "Include 'oversized fit' and 'heavyweight cotton' in all titles",
  "Focus on high-volume summer keywords",
  "Shorten Flipkart title to under 65 characters",
];

export const RefineBox: React.FC<Props> = ({ runId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg: Message = { sender: "user", text, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const resp = await chatRefine(runId, text);
      const assistantMsg: Message = {
        sender: "assistant",
        text: resp.reply,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        sender: "assistant",
        text: `Error: ${err?.message || "Could not refine results. Check your OpenRouter key."}`,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-divider/70 bg-content1 shadow-xs">
      <CardBody className="p-3.5 sm:p-4 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 pb-1 border-b border-divider/60">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <h4 className="text-xs font-semibold text-foreground">Interactive Refinement</h4>
          <span className="text-[11px] text-default-400">
            Ask AI to adjust titles, suggest alternative keywords, or customize for specific campaigns
          </span>
        </div>

        {/* Message History */}
        {messages.length > 0 && (
          <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto p-2 rounded-lg bg-default-50/50 dark:bg-default-100/10 border border-divider/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 text-xs leading-relaxed ${
                  m.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.sender === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`p-2.5 rounded-lg max-w-[85%] whitespace-pre-wrap ${
                    m.sender === "user"
                      ? "bg-primary text-white"
                      : "bg-content1 border border-divider text-foreground"
                  }`}
                >
                  {m.text}
                </div>
                {m.sender === "user" && (
                  <div className="w-6 h-6 rounded-full bg-default-200 text-default-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-default-400 italic">
                <Bot className="w-3.5 h-3.5 animate-pulse text-primary" />
                <span>AI is refining your titles...</span>
              </div>
            )}
          </div>
        )}

        {/* Quick Prompt Chips */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              className="text-[10px] px-2 py-1 rounded-full border border-divider text-default-600 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 text-left"
              onClick={() => handleSend(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            placeholder="Type an adjustment (e.g. 'Add 100% Cotton to Amazon title')..."
            value={inputText}
            onValueChange={setInputText}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            isDisabled={isLoading}
            classNames={{ inputWrapper: "h-9 text-xs" }}
          />
          <Button
            size="sm"
            color="primary"
            className="h-9 px-3 shrink-0"
            isLoading={isLoading}
            isDisabled={!inputText.trim() || isLoading}
            onPress={() => handleSend()}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
