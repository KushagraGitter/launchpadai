/**
 * Fetches recent chat messages for a project and produces a concise summary
 * of key decisions, preferences, concerns, and open questions expressed
 * by the user during conversation. This summary is injected into every
 * agent's context so they benefit from conversational nuance.
 */

import { getPrisma } from "../db/client"
import { getLLM } from "../llm/router"
import { HumanMessage } from "@langchain/core/messages"
import { logger } from "../logger"

const CHAT_HISTORY_LIMIT = 30
const MAX_CHAT_CHARS = 8000

const SUMMARY_SYSTEM_PROMPT = `You are a context extractor. Given a chat conversation between a user and an AI co-founder about a product idea, extract a concise summary (max 500 words) containing ONLY:

1. **Key Decisions Made**: Confirmed choices about target segment, pricing, tech stack, features, etc.
2. **User Preferences**: Stated preferences about scope, timeline, budget, approach.
3. **Concerns Raised**: Worries, objections, or risks the user mentioned.
4. **Open Questions**: Things the user is still uncertain about.

Do NOT include:
- Greetings, small talk, or pleasantries
- The AI's analysis or recommendations (only extract what the USER said/decided)
- Phase execution status updates

If the conversation contains no substantive product decisions or preferences, respond with an empty string.

Format as a compact bulleted list under each heading. Omit any heading with no items.`

export async function getChatSummary(projectId: string): Promise<string> {
  const prisma = getPrisma()

  const messages = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: CHAT_HISTORY_LIMIT,
    select: { role: true, content: true },
  })

  if (messages.length === 0) return ""

  messages.reverse()

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")

  const truncated = transcript.length > MAX_CHAT_CHARS
    ? transcript.slice(-MAX_CHAT_CHARS)
    : transcript

  try {
    const llm = getLLM("formatting")
    const response = await llm.invoke([
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      new HumanMessage(truncated),
    ])

    const summary = typeof response.content === "string" ? response.content.trim() : ""
    if (!summary || summary.length < 10) return ""

    logger.info("Chat summary generated", {
      projectId,
      messageCount: messages.length,
      summaryLength: summary.length,
    })

    return summary
  } catch (err) {
    logger.error("Failed to generate chat summary, continuing without it", {
      projectId,
      error: String(err),
    })
    return ""
  }
}
