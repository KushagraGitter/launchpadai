import { TavilySearchResults } from "@langchain/community/tools/tavily_search"
import { config } from "../config"
import { logger } from "../logger"

/**
 * Returns a Tavily web-search tool, or null when TAVILY_API_KEY is not configured.
 */
export function getTavilyTool(maxResults = 5): TavilySearchResults | null {
  if (!config.TAVILY_API_KEY) {
    logger.info("TAVILY_API_KEY not set — web search disabled for this node")
    return null
  }
  return new TavilySearchResults({
    maxResults,
    apiKey: config.TAVILY_API_KEY,
  })
}
