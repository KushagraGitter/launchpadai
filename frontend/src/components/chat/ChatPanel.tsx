"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Rocket,
  CheckCircle2,
  PartyPopper,
  ArrowRight,
  Flag,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, chatApi, ChatMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  questions?: ClarifyingQuestion[];
  contextMessage?: string;
  questionSetId?: string;
  phaseCompleted?: string;
  nextPhase?: string;
}

interface ChatPanelProps {
  projectId: string;
  onPhaseStarted?: (phase: string) => void;
}

const PHASE_ORDER = ["validation", "prd", "coding_context", "gtm"];

const PHASE_LABELS: Record<string, string> = {
  validation: "Idea Validation",
  prd: "PRD Generation",
  coding_context: "Coding Context",
  gtm: "Go-to-Market",
};

export default function ChatPanel({ projectId, onPhaseStarted }: ChatPanelProps) {
  const { getToken } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [activeQuestionSetId, setActiveQuestionSetId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const phaseStatusRef = useRef<Record<string, string>>({});
  const notifiedPhasesRef = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  useEffect(() => {
    const interval = setInterval(pollPhaseStatus, 4000);
    return () => clearInterval(interval);
  }, [projectId]);

  async function pollPhaseStatus() {
    const token = getToken();
    if (!token) return;
    try {
      const phases = await api.phases.list(token, projectId);
      for (const phase of phases) {
        const prevStatus = phaseStatusRef.current[phase.phase_type];
        if (prevStatus && prevStatus !== "completed" && phase.status === "completed" && !notifiedPhasesRef.current.has(phase.phase_type)) {
          notifiedPhasesRef.current.add(phase.phase_type);
          const phaseIdx = PHASE_ORDER.indexOf(phase.phase_type);
          const nextPhaseType = phaseIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[phaseIdx + 1] : undefined;

          const notification: LocalMessage = {
            id: `phase-done-${phase.phase_type}-${Date.now()}`,
            role: "system",
            content: `**${PHASE_LABELS[phase.phase_type] || phase.phase_type}** has been completed successfully! Check the canvas to view and edit the output cards.`,
            phaseCompleted: phase.phase_type,
            nextPhase: nextPhaseType,
          };
          setMessages((prev) => [...prev, notification]);
          onPhaseStarted?.(phase.phase_type);
        }
        phaseStatusRef.current[phase.phase_type] = phase.status;
      }
    } catch {
      // polling failure is non-critical
    }
  }

  async function loadHistory() {
    const token = getToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const [history, phases] = await Promise.all([
        chatApi.history(token, projectId),
        api.phases.list(token, projectId),
      ]);

      for (const p of phases) {
        phaseStatusRef.current[p.phase_type] = p.status;
        if (p.status === "completed") {
          notifiedPhasesRef.current.add(p.phase_type);
        }
      }

      if (history.messages.length === 0) {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Hey! I'm your **AI co-founder**. I've reviewed your idea and I'm ready to help you take it from concept to production.\n\nWe'll work through **4 phases** together:\n\n1. **Idea Validation** — Market research, feasibility, user personas\n2. **PRD Generation** — Requirements, features, UX flows\n3. **Coding Context** — Architecture, schemas, task breakdown\n4. **Go-to-Market** — Positioning, channels, launch plan\n\nBefore we dive in, I'll ask you a few quick questions to understand your idea better. This helps my AI agents produce much more relevant results.\n\n**Ready to get started?** Just say the word and I'll kick things off!`,
          },
        ]);
      } else {
        const chatMsgs: LocalMessage[] = history.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));

        const completedPhases = phases.filter((p) => p.status === "completed");
        for (const cp of completedPhases) {
          const phaseIdx = PHASE_ORDER.indexOf(cp.phase_type);
          const nextPhaseType = phaseIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[phaseIdx + 1] : undefined;
          const isNextAlreadyDone = nextPhaseType ? phases.some((p) => p.phase_type === nextPhaseType && (p.status === "completed" || p.status === "running" || p.status === "queued")) : true;

          if (!isNextAlreadyDone) {
            chatMsgs.push({
              id: `phase-done-${cp.phase_type}`,
              role: "system",
              content: `**${PHASE_LABELS[cp.phase_type] || cp.phase_type}** has been completed! Check the canvas to view and edit the output cards.`,
              phaseCompleted: cp.phase_type,
              nextPhase: nextPhaseType,
            });
          }
        }

        setMessages(chatMsgs);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend(messageOverride?: string) {
    const token = getToken();
    const userMessage = (messageOverride || input).trim();
    if (!token || !userMessage || isSending) return;

    if (!messageOverride) setInput("");
    setIsSending(true);
    setActiveQuestionSetId(null);

    const userMsg: LocalMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
    };

    const assistantMsg: LocalMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      for await (const chunk of chatApi.sendMessage(token, projectId, userMessage)) {
        if (chunk.type === "token" && chunk.content) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + chunk.content,
              };
            }
            return updated;
          });
        } else if (chunk.type === "questions") {
          const questionData = chunk as unknown as {
            type: string;
            context_message: string;
            questions: ClarifyingQuestion[];
          };
          const qSetId = `qs-${Date.now()}`;
          setActiveQuestionSetId(qSetId);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                questions: questionData.questions,
                contextMessage: questionData.context_message,
                questionSetId: qSetId,
              };
            }
            return updated;
          });
        } else if (chunk.type === "action" && chunk.action === "phase_started" && chunk.phase) {
          onPhaseStarted?.(chunk.phase);
        } else if (chunk.type === "done") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = { ...last, isStreaming: false };
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      toast.add("error", "Failed to send message. Please try again.");
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && last.isStreaming) {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, something went wrong. Please try again.",
            isStreaming: false,
          };
        }
        return updated;
      });
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleSelectOption(questionId: string, option: string) {
    setSelectedAnswers((prev) => {
      const current = prev[questionId] || [];
      const exists = current.includes(option);
      return {
        ...prev,
        [questionId]: exists
          ? current.filter((o) => o !== option)
          : [...current, option],
      };
    });
  }

  function handleSubmitAnswers(questions: ClarifyingQuestion[]) {
    const answerLines = questions.map((q) => {
      const answers = selectedAnswers[q.id];
      const answer = answers && answers.length > 0 ? answers.join(", ") : "Not specified";
      return `**${q.question}**: ${answer}`;
    });
    const compiledAnswer = answerLines.join("\n");
    setSelectedAnswers({});
    handleSend(compiledAnswer);
  }

  function handleQuickReply(text: string) {
    handleSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const showQuickReplies = messages.length <= 2 && !isSending;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-brand-500 to-purple-600">
          <Rocket className="h-4 w-4 text-white -rotate-45" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Co-founder</h2>
          <p className="text-xs text-muted-foreground">
            {isSending ? "Thinking..." : "Guiding your idea to production"}
          </p>
        </div>
        {isSending && (
          <div className="ml-auto">
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "system" ? (
              <PhaseCompletionNotification
                message={msg}
                onProceed={(nextPhase) => handleSend(`Let's proceed with ${PHASE_LABELS[nextPhase] || nextPhase}`)}
                isSending={isSending}
              />
            ) : (
              <>
                <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "user"
                        ? "bg-brand-600"
                        : "bg-gradient-to-br from-purple-600 to-brand-600"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-brand-600 text-white"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-headings:text-foreground prose-strong:text-foreground prose-code:text-brand-300 prose-code:bg-accent prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-a:text-brand-400">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.isStreaming && !msg.questions && (
                          <span className="inline-block ml-1 h-4 w-1.5 animate-pulse bg-brand-400 rounded-sm" />
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-strong:text-white [&_*]:text-white">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {msg.questions && msg.questions.length > 0 && (
                  <QuestionCards
                    questions={msg.questions}
                    contextMessage={msg.contextMessage}
                    selectedAnswers={selectedAnswers}
                    onSelect={handleSelectOption}
                    onSubmit={() => handleSubmitAnswers(msg.questions!)}
                    disabled={isSending}
                    isActive={!isSending && activeQuestionSetId === msg.questionSetId}
                  />
                )}
              </>
            )}
          </div>
        ))}

        {showQuickReplies && (
          <div className="flex flex-wrap gap-2 ml-11">
            {[
              "Let's start with Idea Validation",
              "Tell me more about the phases",
              "I have questions about my idea first",
            ].map((text) => (
              <button
                key={text}
                onClick={() => handleQuickReply(text)}
                disabled={isSending}
                className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground hover:border-brand-500/50 hover:bg-accent transition-all disabled:opacity-50"
              >
                {text}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2 rounded-xl bg-secondary border border-border p-2 focus-within:border-brand-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            disabled={isSending}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isSending || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function PhaseCompletionNotification({
  message,
  onProceed,
  isSending,
}: {
  message: LocalMessage;
  onProceed: (nextPhase: string) => void;
  isSending: boolean;
}) {
  const isLast = message.nextPhase === undefined;

  return (
    <div className="mx-2 my-3">
      <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/15">
            {isLast ? (
              <Flag className="h-5 w-5 text-green-400" />
            ) : (
              <PartyPopper className="h-5 w-5 text-green-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-strong:text-green-300">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        </div>

        {message.nextPhase && (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onProceed(message.nextPhase!)}
              disabled={isSending}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50 transition-colors shadow-lg shadow-brand-600/20"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Proceed to {PHASE_LABELS[message.nextPhase] || message.nextPhase}
            </button>
            <span className="text-[10px] text-muted-foreground">or ask a follow-up question</span>
          </div>
        )}

        {isLast && (
          <div className="flex items-center gap-2 pt-1 text-xs text-green-400/80">
            <CheckCircle2 className="h-4 w-4" />
            All phases complete — your idea is ready for production!
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCards({
  questions,
  contextMessage,
  selectedAnswers,
  onSelect,
  onSubmit,
  disabled,
  isActive,
}: {
  questions: ClarifyingQuestion[];
  contextMessage?: string;
  selectedAnswers: Record<string, string[]>;
  onSelect: (id: string, option: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  isActive: boolean;
}) {
  const allAnswered = questions.every((q) => (selectedAnswers[q.id]?.length ?? 0) > 0);

  return (
    <div className="ml-11 mt-3 space-y-3">
      {contextMessage && (
        <p className="text-xs text-muted-foreground italic">{contextMessage}</p>
      )}

      {questions.map((q) => {
        const selected = selectedAnswers[q.id] || [];
        return (
          <div key={q.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-foreground">{q.question}</p>
              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0 ml-2">
                multi-select
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <button
                    key={option}
                    onClick={() => isActive && onSelect(q.id, option)}
                    disabled={disabled || !isActive}
                    className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                      isSelected
                        ? "bg-brand-600 text-white border border-brand-500 shadow-sm shadow-brand-600/20"
                        : "bg-secondary text-foreground border border-border hover:border-brand-500/50 hover:bg-accent"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSelected && <CheckCircle2 className="inline h-3 w-3 mr-1 -mt-0.5" />}
                    {option}
                  </button>
                );
              })}
            </div>
            {selected.length > 1 && (
              <p className="mt-1.5 text-[10px] text-brand-300">
                {selected.length} selected
              </p>
            )}
          </div>
        );
      })}

      {isActive && (
        <button
          onClick={onSubmit}
          disabled={!allAnswered || disabled}
          className="btn-primary text-xs py-2 w-full disabled:opacity-40"
        >
          {allAnswered ? "Submit answers & continue" : "Select at least one option per question"}
        </button>
      )}
    </div>
  );
}
