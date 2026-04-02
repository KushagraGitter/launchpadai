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
  RefreshCw,
  X,
  AlertTriangle,
  Zap,
  GitBranch,
  Search,
  Scale,
  ChevronDown,
  ChevronUp,
  Trophy,
  Sparkles,
  Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, chatApi, ChatMessage } from "@/lib/api";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useToast } from "@/lib/toast";

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
}

interface TargetedRerunProposal {
  phase_type: string;
  agent_names: string[];
  reason: string;
  invalidated_findings: string[];
}

interface ChallengeCard {
  assumption: string;
  challenge: string;
  evidence: string;
  question_to_user: string;
}

interface AlternativeItem {
  name: string;
  description: string;
  best_for: string;
  tradeoff: string;
}

interface AlternativesCard {
  aspect: string;
  current_direction: string;
  alternatives: AlternativeItem[];
  recommendation: string;
}

interface ComparisonCriterion {
  name: string;
  a_score: string;
  b_score: string;
  winner: "A" | "B" | "tie";
}

interface ComparisonCard {
  option_a: string;
  option_b: string;
  criteria: ComparisonCriterion[];
  verdict: string;
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
  proposal?: TargetedRerunProposal;
  proposalAccepted?: boolean;
  proposalDeclined?: boolean;
  challengeCard?: ChallengeCard;
  alternativesCard?: AlternativesCard;
  comparisonCard?: ComparisonCard;
  researchQuery?: string;
}

interface ChatPanelProps {
  projectId: string;
  onPhaseStarted?: (phase: string) => void;
}

const PHASE_ORDER = ["discovery", "validation", "prd", "coding_context", "gtm"];

const PHASE_LABELS: Record<string, string> = {
  discovery: "Discovery Session",
  validation: "Idea Validation",
  prd: "PRD Generation",
  coding_context: "Coding Context",
  gtm: "Go-to-Market",
};

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.2s" }} />
      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.2s" }} />
      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.2s" }} />
    </div>
  );
}

export default function ChatPanel({ projectId, onPhaseStarted }: ChatPanelProps) {
  const { getToken } = useClerkAuth();
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
    const token = await getToken();
    if (!token) return;
    try {
      const phases = await api.phases.list(token, projectId);
      for (const phase of phases) {
        const prevStatus = phaseStatusRef.current[phase.phase_type];
        const isNewlyDone = prevStatus && !["completed", "in_review", "accepted"].includes(prevStatus) && ["completed", "in_review", "accepted"].includes(phase.status);
        if (isNewlyDone && !notifiedPhasesRef.current.has(phase.phase_type)) {
          notifiedPhasesRef.current.add(phase.phase_type);
          const phaseIdx = PHASE_ORDER.indexOf(phase.phase_type);
          const nextPhaseType = phaseIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[phaseIdx + 1] : undefined;

          const isInReview = phase.status === "in_review";
          const notification: LocalMessage = {
            id: `phase-done-${phase.phase_type}-${Date.now()}`,
            role: "system",
            content: isInReview
              ? `**${PHASE_LABELS[phase.phase_type] || phase.phase_type}** draft is ready for review! Provide feedback on each section, then accept or refine.`
              : `**${PHASE_LABELS[phase.phase_type] || phase.phase_type}** has been completed successfully! Check the canvas to view and edit the output cards.`,
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
    const token = await getToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const [history, phases] = await Promise.all([
        chatApi.history(token, projectId),
        api.phases.list(token, projectId),
      ]);

      for (const p of phases) {
        phaseStatusRef.current[p.phase_type] = p.status;
        if (["completed", "in_review", "accepted"].includes(p.status)) {
          notifiedPhasesRef.current.add(p.phase_type);
        }
      }

      if (history.messages.length === 0) {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Hey! I'm your **AI co-founder**. I've reviewed your idea and I'm ready to help you take it from concept to production.\n\nWe'll work through **5 phases** together:\n\n0. **Discovery Session** — Explore the problem space, challenge assumptions, build a Project Brief\n1. **Idea Validation** — Market research, feasibility, user personas\n2. **PRD Generation** — Requirements, features, UX flows\n3. **Coding Context** — Architecture, schemas, task breakdown\n4. **Go-to-Market** — Positioning, channels, launch plan\n\nI recommend we start with the **Discovery Session** — it stress-tests your idea before you spend hours on validation. It takes ~2 minutes and the Project Brief it produces will make every other phase sharper.\n\n**Ready to explore your idea?**`,
          },
        ]);
      } else {
        const chatMsgs: LocalMessage[] = history.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));

        const donePhases = phases.filter((p) => ["completed", "in_review", "accepted"].includes(p.status));
        for (const cp of donePhases) {
          const phaseIdx = PHASE_ORDER.indexOf(cp.phase_type);
          const nextPhaseType = phaseIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[phaseIdx + 1] : undefined;
          const isNextAlreadyDone = nextPhaseType ? phases.some((p) => p.phase_type === nextPhaseType && (["completed", "in_review", "accepted", "running", "queued"].includes(p.status))) : true;

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
    const token = await getToken();
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
        } else if (chunk.type === "refine_started" && chunk.phase) {
          const phaseLabel = PHASE_LABELS[chunk.phase as string] || chunk.phase;
          setMessages((prev) => [
            ...prev,
            {
              id: `refine-${Date.now()}`,
              role: "system" as const,
              content: `Refining **${phaseLabel}** based on your feedback — re-running ${chunk.feedback_count || ""} feedback item(s)...`,
            },
          ]);
          onPhaseStarted?.(chunk.phase as string);
        } else if (chunk.type === "targeted_rerun_proposal") {
          const proposalData = chunk as unknown as TargetedRerunProposal & { type: string };
          const proposalId = `proposal-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            {
              id: proposalId,
              role: "system" as const,
              content: "",
              proposal: {
                phase_type: proposalData.phase_type,
                agent_names: proposalData.agent_names,
                reason: proposalData.reason,
                invalidated_findings: proposalData.invalidated_findings,
              },
            },
          ]);
        } else if (chunk.type === "challenge_card") {
          const d = chunk as unknown as ChallengeCard & { type: string };
          setMessages((prev) => [
            ...prev,
            {
              id: `challenge-${Date.now()}`,
              role: "system" as const,
              content: "",
              challengeCard: {
                assumption: d.assumption,
                challenge: d.challenge,
                evidence: d.evidence,
                question_to_user: d.question_to_user,
              },
            },
          ]);
        } else if (chunk.type === "alternatives_card") {
          const d = chunk as unknown as AlternativesCard & { type: string };
          setMessages((prev) => [
            ...prev,
            {
              id: `alt-${Date.now()}`,
              role: "system" as const,
              content: "",
              alternativesCard: {
                aspect: d.aspect,
                current_direction: d.current_direction,
                alternatives: d.alternatives,
                recommendation: d.recommendation,
              },
            },
          ]);
        } else if (chunk.type === "comparison_card") {
          const d = chunk as unknown as ComparisonCard & { type: string };
          setMessages((prev) => [
            ...prev,
            {
              id: `cmp-${Date.now()}`,
              role: "system" as const,
              content: "",
              comparisonCard: {
                option_a: d.option_a,
                option_b: d.option_b,
                criteria: d.criteria,
                verdict: d.verdict,
              },
            },
          ]);
        } else if (chunk.type === "research_start") {
          const d = chunk as unknown as { type: string; query: string };
          setMessages((prev) => [
            ...prev,
            {
              id: `research-${Date.now()}`,
              role: "system" as const,
              content: "",
              researchQuery: d.query,
            },
          ]);
        } else if (chunk.type === "error") {
          const errorContent = chunk.content || "Something went wrong. Please try again.";
          toast.add("error", errorContent);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant" && last.isStreaming) {
              if (!last.content) {
                updated[updated.length - 1] = { ...last, content: errorContent, isStreaming: false };
              } else {
                updated[updated.length - 1] = { ...last, isStreaming: false };
              }
            }
            return updated;
          });
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
      const isAuth = err instanceof Error && err.message.includes("401");
      const errorText = isAuth
        ? "Session expired — please refresh the page."
        : "Connection error. Please try again.";
      toast.add("error", errorText);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && last.isStreaming) {
          updated[updated.length - 1] = {
            ...last,
            content: errorText,
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
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const showQuickReplies = messages.length <= 2 && !isSending;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">AI Co-founder</h2>
            <Pencil className="h-2.5 w-2.5 text-muted-foreground/40" />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isSending ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="inline-block h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                Thinking...
              </span>
            ) : (
              "Guiding your idea to production"
            )}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "system" && msg.proposal ? (
              <TargetedRerunProposalCard
                message={msg}
                projectId={projectId}
                onAccepted={(msgId) => {
                  setMessages((prev) =>
                    prev.map((m) => m.id === msgId ? { ...m, proposalAccepted: true } : m)
                  );
                  onPhaseStarted?.("");
                  toast.add("success", "Re-running selected agents with your new constraints.");
                }}
                onDeclined={(msgId) => {
                  setMessages((prev) =>
                    prev.map((m) => m.id === msgId ? { ...m, proposalDeclined: true } : m)
                  );
                }}
                getToken={getToken}
                isSending={isSending}
              />
            ) : msg.role === "system" && msg.challengeCard ? (
              <ChallengeCardComponent card={msg.challengeCard} />
            ) : msg.role === "system" && msg.alternativesCard ? (
              <AlternativesCardComponent card={msg.alternativesCard} />
            ) : msg.role === "system" && msg.comparisonCard ? (
              <ComparisonCardComponent card={msg.comparisonCard} />
            ) : msg.role === "system" && msg.researchQuery ? (
              <ResearchIndicator query={msg.researchQuery} />
            ) : msg.role === "system" ? (
              <PhaseCompletionNotification
                message={msg}
                onProceed={(nextPhase) => handleSend(`Let's proceed with ${PHASE_LABELS[nextPhase] || nextPhase}`)}
                isSending={isSending}
              />
            ) : (
              <>
                <div className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      msg.role === "user"
                        ? "bg-emerald-600/20 text-emerald-400"
                        : "bg-gradient-to-br from-emerald-500/20 via-purple-500/20 to-pink-500/20 text-emerald-400"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white rounded-tr-md"
                        : "bg-accent border border-border text-foreground rounded-tl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-headings:text-foreground prose-strong:text-foreground prose-code:text-emerald-300 prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-a:text-emerald-400">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.isStreaming && !msg.questions && msg.content.length === 0 && (
                          <ThinkingDots />
                        )}
                        {msg.isStreaming && !msg.questions && msg.content.length > 0 && (
                          <span className="inline-block ml-0.5 h-4 w-1 animate-pulse bg-emerald-400/60 rounded-sm" />
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
          <div className="flex flex-wrap gap-2 ml-10">
            {[
              "Let's explore your idea",
              "Tell me more about Discovery Session",
              "I have questions about my idea first",
            ].map((text) => (
              <button
                key={text}
                onClick={() => handleQuickReply(text)}
                disabled={isSending}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground hover:border-emerald-500/30 hover:bg-accent transition-all disabled:opacity-50"
              >
                {text}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl bg-card border border-border p-2 focus-within:border-emerald-500 focus-within:bg-accent transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your AI co-founder..."
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
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
          Enter to send · Shift+Enter for new line
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
    <div className="mx-1 my-3">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            {isLast ? (
              <Flag className="h-4 w-4 text-emerald-400" />
            ) : (
              <PartyPopper className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:text-[13px] prose-p:leading-relaxed prose-strong:text-emerald-300">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        </div>

        {message.nextPhase && (
          <button
            onClick={() => onProceed(message.nextPhase!)}
            disabled={isSending}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Proceed to {PHASE_LABELS[message.nextPhase] || message.nextPhase}
          </button>
        )}

        {isLast && (
          <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400/80">
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
    <div className="ml-10 mt-3 space-y-3">
      {contextMessage && (
        <p className="text-xs text-muted-foreground italic">{contextMessage}</p>
      )}

      {questions.map((q) => {
        const selected = selectedAnswers[q.id] || [];
        return (
          <div key={q.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-foreground">{q.question}</p>
              <span className="text-[9px] text-muted-foreground bg-accent border border-border px-1.5 py-0.5 rounded-full shrink-0 ml-2">
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
                        ? "bg-emerald-600 text-white border border-emerald-500"
                        : "bg-card text-foreground border border-border hover:border-emerald-500/30 hover:bg-accent"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSelected && <CheckCircle2 className="inline h-3 w-3 mr-1 -mt-0.5" />}
                    {option}
                  </button>
                );
              })}
            </div>
            {selected.length > 1 && (
              <p className="mt-1.5 text-[10px] text-emerald-300">
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

function ChallengeCardComponent({ card }: { card: ChallengeCard }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="mx-1 my-3">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/[0.03] transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
            <Zap className="h-4 w-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Assumption challenged</p>
            <p className="text-sm font-medium text-foreground mt-0.5 line-clamp-1">&ldquo;{card.assumption}&rdquo;</p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-red-500/10 pt-3">
            <div>
              <p className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider mb-1">Devil&apos;s advocate</p>
              <p className="text-sm text-foreground leading-relaxed">{card.challenge}</p>
            </div>
            {card.evidence && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Evidence</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.evidence}</p>
              </div>
            )}
            <div className="rounded-xl bg-red-500/[0.06] border border-red-500/15 px-3 py-2.5">
              <p className="text-xs font-semibold text-red-300 mb-1">Question for you:</p>
              <p className="text-sm text-foreground">{card.question_to_user}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlternativesCardComponent({ card }: { card: AlternativesCard }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="mx-1 my-3">
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-500/[0.03] transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
            <GitBranch className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Alternative approaches</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{card.aspect}</p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>
        {expanded && (
          <div className="px-4 pb-4 border-t border-blue-500/10 pt-3 space-y-3">
            {card.current_direction && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/60">Current direction:</span> {card.current_direction}
              </p>
            )}
            <div className="space-y-2">
              {card.alternatives.map((alt, i) => (
                <div key={i} className="rounded-xl bg-card border border-border p-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{alt.name}</p>
                  <p className="text-xs text-muted-foreground">{alt.description}</p>
                  <div className="flex gap-3 pt-1">
                    <span className="text-[10px] text-green-400 flex items-start gap-1">
                      <span className="font-bold mt-0.5">&#10003;</span> {alt.best_for}
                    </span>
                    <span className="text-[10px] text-red-400/80 flex items-start gap-1">
                      <span className="font-bold mt-0.5">&#10007;</span> {alt.tradeoff}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {card.recommendation && (
              <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 px-3 py-2.5">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Recommendation</p>
                <p className="text-xs text-foreground">{card.recommendation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonCardComponent({ card }: { card: ComparisonCard }) {
  const [expanded, setExpanded] = useState(true);
  const aWins = card.criteria.filter((c) => c.winner === "A").length;
  const bWins = card.criteria.filter((c) => c.winner === "B").length;
  return (
    <div className="mx-1 my-3">
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-purple-500/[0.03] transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Scale className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Head-to-head comparison</p>
            <p className="text-sm font-medium text-foreground mt-0.5 truncate">{card.option_a} vs {card.option_b}</p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>
        {expanded && (
          <div className="px-4 pb-4 border-t border-purple-500/10 pt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-card border border-border py-2">
                <p className="text-lg font-bold text-foreground">{aWins}</p>
                <p className="text-[10px] text-muted-foreground truncate px-1">{card.option_a}</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-xs text-muted-foreground font-medium">vs</span>
              </div>
              <div className="rounded-xl bg-card border border-border py-2">
                <p className="text-lg font-bold text-foreground">{bWins}</p>
                <p className="text-[10px] text-muted-foreground truncate px-1">{card.option_b}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {card.criteria.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start text-xs">
                  <span className={`text-right leading-relaxed pr-1 ${c.winner === "A" ? "text-foreground font-medium" : "text-muted-foreground"}`}>{c.a_score}</span>
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    {c.winner === "A" && <Trophy className="h-3 w-3 text-yellow-400" />}
                    {c.winner === "B" && <div className="h-3 w-3" />}
                    <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">{c.name}</span>
                    {c.winner === "B" && <Trophy className="h-3 w-3 text-yellow-400" />}
                  </div>
                  <span className={`leading-relaxed pl-1 ${c.winner === "B" ? "text-foreground font-medium" : "text-muted-foreground"}`}>{c.b_score}</span>
                </div>
              ))}
            </div>
            {card.verdict && (
              <div className="rounded-xl bg-purple-500/[0.06] border border-purple-500/15 px-3 py-2.5">
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Verdict</p>
                <p className="text-xs text-foreground">{card.verdict}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResearchIndicator({ query }: { query: string }) {
  return (
    <div className="mx-1 my-2">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs text-muted-foreground">Searching: </span>
        <span className="text-xs text-foreground font-medium truncate">{query}</span>
        <Loader2 className="h-3 w-3 animate-spin text-emerald-400 shrink-0 ml-auto" />
      </div>
    </div>
  );
}

const PHASE_LABELS_ALL: Record<string, string> = {
  discovery: "Discovery Session",
  validation: "Idea Validation",
  prd: "PRD Generation",
  coding_context: "Coding Context",
  gtm: "Go-to-Market",
};

function TargetedRerunProposalCard({
  message,
  projectId,
  onAccepted,
  onDeclined,
  getToken,
  isSending,
}: {
  message: LocalMessage;
  projectId: string;
  onAccepted: (msgId: string) => void;
  onDeclined: (msgId: string) => void;
  getToken: () => Promise<string | null>;
  isSending: boolean;
}) {
  const [running, setRunning] = useState(false);
  const proposal = message.proposal!;
  const isDone = message.proposalAccepted || message.proposalDeclined;

  async function handleAccept() {
    const token = await getToken();
    if (!token || running) return;
    setRunning(true);
    try {
      await api.phases.rerunAgents(token, projectId, proposal.phase_type, proposal.agent_names);
      onAccepted(message.id);
    } catch {
      // error handled by caller toast
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-1 my-3">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Detected: prior findings may be outdated
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {proposal.reason}
            </p>
          </div>
        </div>

        {proposal.invalidated_findings.length > 0 && (
          <div className="space-y-1 ml-12">
            <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">
              Would update:
            </p>
            <ul className="space-y-1">
              {proposal.invalidated_findings.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400/60 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl bg-card border border-border px-3 py-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Re-run in {PHASE_LABELS_ALL[proposal.phase_type] || proposal.phase_type}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {proposal.agent_names.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] text-amber-300"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                {name}
              </span>
            ))}
          </div>
        </div>

        {!isDone ? (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAccept}
              disabled={running || isSending}
              className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Yes, re-run these agents
            </button>
            <button
              onClick={() => onDeclined(message.id)}
              disabled={running || isSending}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              No, keep existing results
            </button>
          </div>
        ) : message.proposalAccepted ? (
          <div className="flex items-center gap-2 text-xs text-amber-400/80">
            <CheckCircle2 className="h-4 w-4" />
            Agents queued — check the canvas for updated results.
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Keeping existing results.
          </div>
        )}
      </div>
    </div>
  );
}
