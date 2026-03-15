"""Phase 1: Idea Validation crew with 4 specialized agents."""

from crewai import Agent, Crew, Task, Process

from app.agents.base import get_llm, get_search_tool, build_context_string


def create_validation_crew(project_data: dict) -> Crew:
    """Create the Idea Validation crew for Phase 1."""
    llm = get_llm()
    context = build_context_string(project_data)

    market_search = get_search_tool(search_depth="advanced", topic="finance", max_results=8)
    tech_search = get_search_tool(topic="general", max_results=5)
    persona_search = get_search_tool(topic="general", max_results=5)

    market_researcher = Agent(
        role="Market Research Analyst",
        goal="Analyze market size, trends, existing competitors, and market gaps for the given idea",
        backstory=(
            "You are a seasoned market research analyst with 15 years of experience "
            "analyzing startup ideas and market opportunities. You specialize in "
            "identifying market size (TAM/SAM/SOM), growth trends, competitive "
            "landscape, and whitespace opportunities. You always back your claims "
            "with real data from web searches."
        ),
        llm=llm,
        tools=[t for t in [market_search] if t],
        verbose=True,
    )

    feasibility_analyst = Agent(
        role="Technical Feasibility Analyst",
        goal="Evaluate the technical complexity, resource requirements, and implementation risks",
        backstory=(
            "You are a principal software architect who has built and scaled dozens "
            "of products. You evaluate ideas by assessing technical stack requirements, "
            "complexity, time-to-MVP, infrastructure needs, and potential technical risks. "
            "You search the web for current cloud pricing, framework benchmarks, and "
            "technology comparisons."
        ),
        llm=llm,
        tools=[t for t in [tech_search] if t],
        verbose=True,
    )

    persona_builder = Agent(
        role="User Persona Researcher",
        goal="Define detailed target user personas, their pain points, and jobs-to-be-done",
        backstory=(
            "You are a UX research lead who specializes in building evidence-based "
            "user personas. You identify target segments, their core pain points, "
            "current workarounds, willingness to pay, and jobs-to-be-done frameworks. "
            "You search the web for audience demographics, industry surveys, and "
            "community discussions to ground personas in real data."
        ),
        llm=llm,
        tools=[t for t in [persona_search] if t],
        verbose=True,
    )

    synthesizer = Agent(
        role="Validation Synthesizer",
        goal="Combine all research into a final validation scorecard with a go/no-go recommendation",
        backstory=(
            "You are a startup advisor and former VC analyst. You synthesize market "
            "research, technical feasibility, and user research into a clear validation "
            "scorecard (1-10). You identify key risks, opportunities, and give an "
            "honest go/no-go recommendation with reasoning."
        ),
        llm=llm,
        verbose=True,
    )

    _search_instructions = (
        "\n\nIMPORTANT: If you have a web search tool available, USE IT to find REAL, "
        "current data. Do NOT fabricate statistics, market sizes, or competitor info. "
        "Every data point should come from a real source. Cite your sources with URLs."
    )

    market_task = Task(
        description=(
            f"Analyze the following idea and provide a comprehensive market research report:\n\n"
            f"{context}\n\n"
            "Your report MUST include:\n"
            "1. Market Size: Estimated TAM, SAM, SOM with reasoning\n"
            "2. Market Trends: 3-5 key trends supporting or threatening this idea\n"
            "3. Competitive Landscape: Identify 5-10 existing competitors/alternatives, "
            "their strengths, weaknesses, and pricing\n"
            "4. Market Gaps: Opportunities the idea could exploit\n"
            "5. Market Risk Assessment: Key market risks\n\n"
            "Format your response as a structured markdown report."
            + _search_instructions
            + "\n\nSearch for queries like:\n"
            "- '[idea domain] market size 2025 2026' for TAM/SAM/SOM data\n"
            "- '[competitor names] pricing features' for competitive analysis\n"
            "- '[industry] trends report' for market trends"
        ),
        expected_output="A comprehensive market research report in markdown format with cited sources",
        agent=market_researcher,
    )

    feasibility_task = Task(
        description=(
            f"Evaluate the technical feasibility of this idea:\n\n"
            f"{context}\n\n"
            "Your assessment MUST include:\n"
            "1. Recommended Tech Stack: Languages, frameworks, infrastructure\n"
            "2. Complexity Rating: Low/Medium/High with justification\n"
            "3. Time-to-MVP Estimate: In weeks, with key milestones\n"
            "4. Team Requirements: Minimum team size and skills needed\n"
            "5. Infrastructure Costs: Estimated monthly costs for MVP and scale\n"
            "6. Technical Risks: Key technical challenges and mitigations\n"
            "7. Third-party Dependencies: APIs, services, data sources needed\n\n"
            "Format your response as a structured markdown report."
            + _search_instructions
            + "\n\nSearch for queries like:\n"
            "- '[technology] pricing 2025' for current cloud/infrastructure costs\n"
            "- '[framework A] vs [framework B] benchmark' for technology comparisons\n"
            "- '[technology] best practices production' for stack recommendations"
        ),
        expected_output="A technical feasibility assessment in markdown format with cited sources",
        agent=feasibility_analyst,
    )

    persona_task = Task(
        description=(
            f"Research and define target user personas for this idea:\n\n"
            f"{context}\n\n"
            "You MUST create 2-3 detailed personas, each including:\n"
            "1. Name, Role, Demographics\n"
            "2. Core Pain Points (3-5 specific problems)\n"
            "3. Current Workarounds: How they solve this today\n"
            "4. Jobs-to-be-Done: Functional, emotional, social\n"
            "5. Willingness to Pay: Price sensitivity and expectations\n"
            "6. Acquisition Channels: Where to reach this persona\n\n"
            "Format your response as a structured markdown report."
            + _search_instructions
            + "\n\nSearch for queries like:\n"
            "- '[target audience] demographics statistics' for audience data\n"
            "- '[industry] user survey report' for pain points and behaviors\n"
            "- '[domain] community discussions reddit' for real user sentiments"
        ),
        expected_output="2-3 detailed user persona documents in markdown format with cited sources",
        agent=persona_builder,
    )

    synthesis_task = Task(
        description=(
            "You have access to the outputs of the market research, technical feasibility, "
            "and user persona analyses. Synthesize everything into a final Validation Scorecard.\n\n"
            "Your scorecard MUST include:\n"
            "1. Overall Validation Score: 1-10 with detailed reasoning\n"
            "2. Market Score: 1-10\n"
            "3. Feasibility Score: 1-10\n"
            "4. User-Need Score: 1-10\n"
            "5. Top 3 Strengths\n"
            "6. Top 3 Risks/Weaknesses\n"
            "7. Key Assumptions to Test\n"
            "8. Recommended Next Steps\n"
            "9. GO / NO-GO / PIVOT Recommendation with reasoning\n\n"
            "Format as a structured markdown report."
        ),
        expected_output="A validation scorecard with scores and go/no-go recommendation in markdown",
        agent=synthesizer,
        context=[market_task, feasibility_task, persona_task],
    )

    crew = Crew(
        agents=[market_researcher, feasibility_analyst, persona_builder, synthesizer],
        tasks=[market_task, feasibility_task, persona_task, synthesis_task],
        process=Process.sequential,
        verbose=True,
    )

    return crew
