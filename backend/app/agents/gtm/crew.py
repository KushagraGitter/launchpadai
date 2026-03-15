"""Phase 4: Go-to-Market crew with 4 specialized agents."""

from crewai import Agent, Crew, Task, Process

from app.agents.base import get_llm, get_search_tool, build_context_string


def create_gtm_crew(project_data: dict) -> Crew:
    """Create the Go-to-Market crew for Phase 4."""
    llm = get_llm()
    context = build_context_string(project_data)

    channel_search = get_search_tool(topic="news", max_results=5)

    positioning_strategist = Agent(
        role="Positioning Strategist",
        goal="Craft compelling value propositions and competitive positioning",
        backstory=(
            "You are a brand strategist with deep experience in positioning SaaS "
            "products. You specialize in creating messaging that resonates with "
            "target audiences and differentiates from competitors."
        ),
        llm=llm,
        verbose=True,
    )

    channel_strategist = Agent(
        role="Channel Strategist",
        goal="Identify the best distribution channels and create a launch timeline",
        backstory=(
            "You are a growth marketing expert who has launched 50+ products. You "
            "know which channels work for different audiences, how to sequence a "
            "launch, and how to maximize initial traction with limited budget. "
            "You search the web for current channel effectiveness data, platform "
            "demographics, and advertising cost benchmarks."
        ),
        llm=llm,
        tools=[t for t in [channel_search] if t],
        verbose=True,
    )

    content_creator = Agent(
        role="Marketing Content Creator",
        goal="Create launch-ready marketing content: landing page, social, emails",
        backstory=(
            "You are a conversion copywriter who creates high-converting landing "
            "pages, compelling social media posts, and email sequences for product "
            "launches. Your copy is concise, benefit-focused, and action-oriented."
        ),
        llm=llm,
        verbose=True,
    )

    launch_planner = Agent(
        role="Launch Planner",
        goal="Create a comprehensive, actionable launch plan with timeline and KPIs",
        backstory=(
            "You are a product launch manager who creates detailed playbooks. "
            "You combine positioning, channels, and content into a week-by-week "
            "plan with clear KPIs and contingencies."
        ),
        llm=llm,
        verbose=True,
    )

    positioning_task = Task(
        description=(
            f"Develop the positioning strategy for this product:\n\n"
            f"{context}\n\n"
            "Your deliverable MUST include:\n"
            "1. One-line Value Proposition\n"
            "2. Elevator Pitch (30 seconds)\n"
            "3. Positioning Statement (For [target] who [need], [product] is a "
            "[category] that [benefit]. Unlike [alternatives], we [differentiator].)\n"
            "4. Key Messages (3-5 core messages for different audiences)\n"
            "5. Competitive Positioning Matrix\n"
            "6. Brand Voice Guidelines: Tone, personality, do's and don'ts\n"
        ),
        expected_output="Complete positioning strategy document in markdown",
        agent=positioning_strategist,
    )

    channel_task = Task(
        description=(
            "Design the distribution and channel strategy:\n\n"
            "1. Primary Channels (top 3): Why, expected CAC, tactics\n"
            "2. Secondary Channels (2-3): Growth experiments to run\n"
            "3. Community Strategy: Where to build community, how to engage\n"
            "4. SEO Strategy: Key terms, content pillars\n"
            "5. Partnership Opportunities: Potential integrations or co-marketing\n"
            "6. Budget Allocation: How to split $500-$2000 launch budget\n\n"
            "If you have a web search tool available, USE IT to find current data. "
            "Search for queries like '[channel] advertising cost per click 2025', "
            "'[platform] user demographics 2025', '[industry] marketing channel "
            "effectiveness'. Use real cost benchmarks, not estimates. Cite sources."
        ),
        expected_output="Channel strategy with specific tactics, real cost data, and budget allocation in markdown",
        agent=channel_strategist,
        context=[positioning_task],
    )

    content_task = Task(
        description=(
            "Create the following marketing content:\n\n"
            "1. Landing Page Copy:\n"
            "   - Hero section (headline, subhead, CTA)\n"
            "   - Features section (3-5 features with benefits)\n"
            "   - Social proof section (testimonial templates)\n"
            "   - FAQ section (5-8 questions)\n"
            "   - Final CTA section\n\n"
            "2. Social Media Launch Posts:\n"
            "   - Twitter/X thread (5-7 tweets)\n"
            "   - LinkedIn post\n"
            "   - Product Hunt tagline + description\n"
            "   - Reddit post template\n\n"
            "3. Email Sequence (3 emails):\n"
            "   - Launch announcement\n"
            "   - Feature deep-dive\n"
            "   - Social proof / momentum update\n"
        ),
        expected_output="Complete marketing content package in markdown",
        agent=content_creator,
        context=[positioning_task, channel_task],
    )

    launch_task = Task(
        description=(
            "Create the final launch plan combining all GTM elements:\n\n"
            "1. Pre-Launch Checklist (T-4 weeks to T-0)\n"
            "2. Launch Day Playbook (hour by hour)\n"
            "3. Post-Launch Plan (Week 1-4)\n"
            "4. KPIs and Metrics:\n"
            "   - Day 1 targets\n"
            "   - Week 1 targets\n"
            "   - Month 1 targets\n"
            "5. Contingency Plans: What to do if launch underperforms\n"
            "6. Tools and Resources Needed\n"
            "7. Team Responsibilities\n"
        ),
        expected_output="Comprehensive launch plan with timeline and KPIs in markdown",
        agent=launch_planner,
        context=[positioning_task, channel_task, content_task],
    )

    return Crew(
        agents=[positioning_strategist, channel_strategist, content_creator, launch_planner],
        tasks=[positioning_task, channel_task, content_task, launch_task],
        process=Process.sequential,
        verbose=True,
    )
