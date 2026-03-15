"""Phase 0: Discovery Session crew — structured pre-flight before validation."""

from crewai import Agent, Crew, Task, Process

from app.agents.base import get_llm, get_search_tool, build_context_string


def create_discovery_crew(project_data: dict) -> Crew:
    """Create the Discovery Session crew for Phase 0.

    Four agents work sequentially to build a Project Brief that becomes the
    grounding context for every downstream phase:

    1. Problem Explorer      — digs into the real problem space, not just the solution
    2. Assumption Challenger — surfaces and stress-tests the riskiest assumptions
    3. Opportunity Mapper    — maps the competitive landscape and adjacent opportunities
    4. Brief Builder         — synthesises everything into a structured Project Brief
    """
    llm = get_llm()
    context = build_context_string(project_data)

    problem_search = get_search_tool(topic="general", max_results=5)
    competitor_search = get_search_tool(search_depth="advanced", topic="general", max_results=8)

    # ── Agent 1: Problem Explorer ───────────────────────────────────────────
    problem_explorer = Agent(
        role="Problem Explorer",
        goal=(
            "Deeply understand the real problem the founder is trying to solve — "
            "not the solution they have in mind — and articulate it with precision."
        ),
        backstory=(
            "You are a seasoned product researcher and design-thinking facilitator "
            "with 12 years of experience running problem discovery sessions at Y Combinator "
            "and Sequoia-backed startups. You are obsessed with the difference between "
            "'the problem the founder describes' and 'the problem users actually have'. "
            "You interview users in your head, ask 'five whys', and never accept the "
            "first framing at face value. You search the web to find evidence of whether "
            "the problem is real, who is suffering from it, and how acutely."
        ),
        llm=llm,
        tools=[t for t in [problem_search] if t],
        verbose=True,
    )

    # ── Agent 2: Assumption Challenger ─────────────────────────────────────
    assumption_challenger = Agent(
        role="Assumption Challenger",
        goal=(
            "Surface the riskiest assumptions baked into the idea and stress-test "
            "each one with evidence and counter-examples."
        ),
        backstory=(
            "You are a former startup failure analyst and devil's advocate consultant. "
            "You have studied over 500 startup post-mortems and can spot a dangerous "
            "assumption in 30 seconds. You ask: 'Who else has tried this? Why did they "
            "fail? What does the founder assume that users will do which they won't? "
            "What does the founder assume about pricing that is almost certainly wrong?' "
            "You are not negative — you are rigorous. You separate assumptions into "
            "fatal-if-wrong vs. safe-to-assume, so the founder knows where to de-risk first."
        ),
        llm=llm,
        tools=[t for t in [problem_search] if t],
        verbose=True,
    )

    # ── Agent 3: Opportunity Mapper ─────────────────────────────────────────
    opportunity_mapper = Agent(
        role="Opportunity Mapper",
        goal=(
            "Map the competitive landscape conversationally, identify adjacent "
            "opportunities, and help define what success looks like before validation."
        ),
        backstory=(
            "You are a strategic analyst who has mapped competitive landscapes for "
            "50+ startups from seed to Series B. You look at a space from multiple "
            "angles: direct competitors, indirect substitutes, potential acquirers, "
            "platform shifts, and regulation changes. You also help founders define "
            "measurable success criteria BEFORE they spend money on validation — because "
            "a founder who cannot say 'I'll know this is working when X happens' will "
            "never know when to pivot. You search for real competitor data."
        ),
        llm=llm,
        tools=[t for t in [competitor_search] if t],
        verbose=True,
    )

    # ── Agent 4: Brief Builder ──────────────────────────────────────────────
    brief_builder = Agent(
        role="Brief Builder",
        goal=(
            "Synthesise all discovery findings into a structured Project Brief "
            "that becomes the grounding document for every downstream phase."
        ),
        backstory=(
            "You are a product strategist and technical writer who has authored "
            "project briefs for 100+ funded startups. You know how to distil messy, "
            "contradictory discovery outputs into a single coherent document that gives "
            "all downstream agents exactly the context they need: what the real problem "
            "is, who the user is, what the key assumptions are, what success looks like, "
            "and what the MVP scope should be. Your briefs are opinionated — you make "
            "calls where the evidence allows, and flag open questions where it doesn't."
        ),
        llm=llm,
        verbose=True,
    )

    _search_note = (
        "\n\nIMPORTANT: If you have a web search tool, USE IT to ground your output "
        "in real evidence — real companies, real market data, real user communities. "
        "Do NOT fabricate examples. Cite sources with URLs where you have them."
    )

    # ── Task 1: Problem Statement ───────────────────────────────────────────
    problem_task = Task(
        description=(
            f"You are the first agent in a Discovery Session for this idea:\n\n"
            f"{context}\n\n"
            "Your job is to produce a rigorous **Problem Statement** document. Do NOT "
            "describe the solution. Focus entirely on the problem space.\n\n"
            "Your document MUST cover:\n"
            "## Problem Statement\n"
            "State the core problem in one crisp sentence from the user's perspective "
            "(not the founder's). Use the format: 'When [user] tries to [do X], they "
            "struggle with [Y] because [root cause].'\n\n"
            "## Problem Depth Analysis\n"
            "1. **Surface problem** (what users say): The immediate complaint\n"
            "2. **Root problem** (why it really happens): The underlying cause\n"
            "3. **Emotional pain**: How does this make the user feel?\n"
            "4. **Frequency & severity**: How often? How painful on a scale of 1-10?\n"
            "5. **Current workarounds**: What do people do TODAY to cope? Why is that inadequate?\n\n"
            "## Who Has This Problem\n"
            "Identify 2-3 distinct groups who suffer from this problem. For each:\n"
            "- Who they are (role, context, day-to-day)\n"
            "- How acutely they feel the pain (1-10)\n"
            "- Whether they are willing to pay to solve it\n\n"
            "## Evidence of Problem Reality\n"
            "Search for evidence that this problem is real and widespread:\n"
            "- Community discussions (Reddit, forums, reviews) where people complain about this\n"
            "- Products that tried to solve it (even if they failed)\n"
            "- Industry reports mentioning this pain point\n\n"
            "## Problem Framing Risk\n"
            "Is the founder solving the RIGHT problem? Or are they solving a symptom "
            "while the real disease is something else? State your assessment clearly."
            + _search_note
        ),
        expected_output=(
            "A structured Problem Statement document in markdown with all sections filled. "
            "Must be grounded in evidence, not speculation."
        ),
        agent=problem_explorer,
    )

    # ── Task 2: Assumptions List ────────────────────────────────────────────
    assumption_task = Task(
        description=(
            "You have access to the Problem Statement from the Problem Explorer. "
            "Now produce a rigorous **Assumptions Analysis** document.\n\n"
            "Your job: surface every major assumption baked into this idea and "
            "stress-test the most dangerous ones. Ask: 'Who else has tried this? "
            "Why did they fail? What has to be TRUE for this to work?'\n\n"
            "## Assumption Inventory\n"
            "List ALL significant assumptions in the idea across these categories:\n"
            "- **User behaviour assumptions**: 'Users will do X...'\n"
            "- **Market assumptions**: 'The market is large enough / growing / underserved...'\n"
            "- **Competitive assumptions**: 'No direct competitor does this well...'\n"
            "- **Monetisation assumptions**: 'Users will pay $X for this...'\n"
            "- **Technical assumptions**: 'We can build this in Y weeks with Z resources...'\n"
            "- **Distribution assumptions**: 'We can reach users via...'\n\n"
            "## Risk Tiering\n"
            "For each assumption, classify it:\n"
            "- 🔴 **FATAL if wrong** — would invalidate the entire idea\n"
            "- 🟡 **SIGNIFICANT if wrong** — would require major pivot\n"
            "- 🟢 **SAFE to assume** — evidence supports it or easily fixable if wrong\n\n"
            "## Who Tried This Before\n"
            "Search for companies/products that attempted to solve this problem. "
            "For each failure, identify the key assumption that was wrong. "
            "For each success, identify which assumptions they validated first.\n\n"
            "## Top 3 Assumptions to Test in Validation\n"
            "Name the 3 assumptions most critical to test in Phase 1 (Validation) "
            "and suggest a specific experiment to test each one."
            + _search_note
        ),
        expected_output=(
            "A structured Assumptions Analysis document in markdown with all sections. "
            "Each assumption must be classified by risk tier. Must include real examples "
            "of who has tried similar things before."
        ),
        agent=assumption_challenger,
        context=[problem_task],
    )

    # ── Task 3: Opportunity Map ─────────────────────────────────────────────
    opportunity_task = Task(
        description=(
            "You have access to the Problem Statement and Assumptions Analysis. "
            "Now produce a comprehensive **Opportunity Map** document.\n\n"
            "## Competitive Landscape\n"
            "Map the competitive space conversationally. Search for real data.\n"
            "- **Direct competitors**: Who solves the same problem the same way?\n"
            "  For each: name, pricing, target user, key strength, key weakness\n"
            "- **Indirect substitutes**: What do users use instead (even if it wasn't "
            "  built for this problem)?\n"
            "- **Venture activity**: Any recent funding in this space? Hot or cold?\n\n"
            "## Whitespace Analysis\n"
            "Given the competitive landscape, where is the genuine opening? "
            "Be specific — 'underserved' is not enough. Name the exact gap.\n\n"
            "## Adjacent Opportunities\n"
            "What adjacent problems or user segments could this idea expand into "
            "once the core is validated? List 2-3 with brief rationale.\n\n"
            "## Success Criteria (Pre-Validation)\n"
            "Define measurable success criteria BEFORE running validation. "
            "Complete these sentences:\n"
            "- 'This idea is validated when we have [X number] of [type of users] "
            "  willing to [pay $Y / sign up / do Z]'\n"
            "- 'The MVP is a success if it achieves [metric] within [timeframe]'\n"
            "- 'We should pivot if [condition] after [timeframe]'\n\n"
            "## Timing Assessment\n"
            "Is NOW the right time for this idea? What tailwinds / headwinds exist? "
            "What would make this much easier in 2 years that doesn't exist today?"
            + _search_note
        ),
        expected_output=(
            "A structured Opportunity Map document in markdown with all sections. "
            "Competitive data must be grounded in real research. Success criteria "
            "must be concrete and measurable."
        ),
        agent=opportunity_mapper,
        context=[problem_task, assumption_task],
    )

    # ── Task 4: Project Brief ───────────────────────────────────────────────
    brief_task = Task(
        description=(
            "You have access to the Problem Statement, Assumptions Analysis, and "
            "Opportunity Map from the previous agents. Synthesise everything into "
            "a single, opinionated **Project Brief** document.\n\n"
            "This Brief is the master context document that will be fed into EVERY "
            "downstream phase (Validation, PRD, Coding Context, GTM). It must be "
            "complete, precise, and actionable.\n\n"
            "## Executive Summary\n"
            "3-5 sentences. What is this, who is it for, why now, and what is the "
            "single biggest insight from the discovery session?\n\n"
            "## The Real Problem (Refined)\n"
            "The final, refined problem statement after discovery. One paragraph.\n\n"
            "## Target User\n"
            "The PRIMARY user for the MVP. Name them (persona name), describe their "
            "context, their biggest pain point, and their current workaround.\n\n"
            "## Proposed Solution Hypothesis\n"
            "One paragraph describing the solution HYPOTHESIS — not a spec. "
            "Make it clear it's a hypothesis to be validated.\n\n"
            "## Key Assumptions (Ranked by Risk)\n"
            "Top 5 assumptions from the Assumptions Analysis, ranked by risk. "
            "Each: assumption + risk tier + validation approach.\n\n"
            "## Competitive Position\n"
            "One paragraph: where this idea sits in the competitive landscape and "
            "what the genuine differentiation claim is.\n\n"
            "## Success Criteria\n"
            "The concrete, measurable success criteria defined in the Opportunity Map.\n\n"
            "## MVP Scope Recommendation\n"
            "What should and should NOT be in the MVP. "
            "Be opinionated. Use a simple in/out table format.\n\n"
            "## Open Questions\n"
            "Top 3-5 questions that the Validation phase MUST answer before the "
            "founder should commit to building.\n\n"
            "## Discovery Session Verdict\n"
            "An honest one-paragraph assessment: Is this idea worth pursuing into "
            "Validation? What is the single most important thing the founder needs "
            "to be aware of going in?"
        ),
        expected_output=(
            "A complete, structured Project Brief document in markdown. "
            "This document must stand alone as the grounding context for all "
            "downstream AI agents. It should be comprehensive (600-1200 words), "
            "specific to this idea, and make clear recommendations."
        ),
        agent=brief_builder,
        context=[problem_task, assumption_task, opportunity_task],
    )

    crew = Crew(
        agents=[problem_explorer, assumption_challenger, opportunity_mapper, brief_builder],
        tasks=[problem_task, assumption_task, opportunity_task, brief_task],
        process=Process.sequential,
        verbose=True,
    )

    return crew
