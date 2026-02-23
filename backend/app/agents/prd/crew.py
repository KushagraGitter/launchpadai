"""Phase 2: PRD Generation crew with 4 specialized agents."""

from crewai import Agent, Crew, Task, Process

from app.agents.base import get_llm, build_context_string


def create_prd_crew(project_data: dict) -> Crew:
    """Create the PRD Generation crew for Phase 2."""
    llm = get_llm()
    context = build_context_string(project_data)

    requirements_analyst = Agent(
        role="Requirements Analyst",
        goal="Extract comprehensive functional and non-functional requirements from the validated idea",
        backstory=(
            "You are a senior business analyst with expertise in SaaS product development. "
            "You excel at translating validated ideas into precise, testable requirements."
        ),
        llm=llm,
        verbose=True,
    )

    feature_prioritizer = Agent(
        role="Feature Prioritizer",
        goal="Prioritize features using MoSCoW methodology aligned with market validation",
        backstory=(
            "You are a product strategist who helps startups ship MVPs fast. You use "
            "MoSCoW prioritization, considering market validation data, technical "
            "feasibility, and user impact to create a focused feature roadmap."
        ),
        llm=llm,
        verbose=True,
    )

    ux_flow_designer = Agent(
        role="UX Flow Designer",
        goal="Design user journeys and screen-by-screen flow descriptions",
        backstory=(
            "You are a UX designer who creates detailed user flows and screen descriptions "
            "for development teams. You think in terms of user goals, task flows, and "
            "information architecture."
        ),
        llm=llm,
        verbose=True,
    )

    prd_writer = Agent(
        role="PRD Writer",
        goal="Assemble a complete, publication-ready Product Requirements Document",
        backstory=(
            "You are a senior technical writer who specializes in creating PRDs for "
            "startup MVPs. Your PRDs are clear, actionable, and developer-friendly "
            "with clear acceptance criteria for every feature."
        ),
        llm=llm,
        verbose=True,
    )

    requirements_task = Task(
        description=(
            f"Extract all functional and non-functional requirements from the validated idea:\n\n"
            f"{context}\n\n"
            "Requirements MUST include:\n"
            "1. Functional Requirements: User-facing features with acceptance criteria\n"
            "2. Non-Functional Requirements: Performance, security, scalability, accessibility\n"
            "3. Data Requirements: What data is collected, stored, processed\n"
            "4. Integration Requirements: External services and APIs needed\n"
            "5. Constraints and Assumptions\n\n"
            "Number each requirement (FR-001, NFR-001, etc.) for traceability."
        ),
        expected_output="Structured requirements document with numbered requirements in markdown",
        agent=requirements_analyst,
    )

    prioritization_task = Task(
        description=(
            "Prioritize all identified requirements using MoSCoW methodology:\n\n"
            "1. Must Have: Core features for MVP launch\n"
            "2. Should Have: Important but not critical for day-1\n"
            "3. Could Have: Nice-to-have features for v1.1\n"
            "4. Won't Have (this time): Explicitly excluded from MVP scope\n\n"
            "For each feature, provide: Impact score (1-5), Effort estimate (S/M/L/XL), "
            "and justification for the priority level."
        ),
        expected_output="MoSCoW prioritized feature matrix in markdown",
        agent=feature_prioritizer,
        context=[requirements_task],
    )

    ux_task = Task(
        description=(
            "Design the user flows for the Must-Have and Should-Have features:\n\n"
            "1. Primary User Journeys: Step-by-step flows for core use cases\n"
            "2. Screen Descriptions: What each screen contains and does\n"
            "3. Navigation Structure: How screens connect\n"
            "4. Key Interactions: Important UI behaviors and feedback\n"
            "5. Edge Cases: Error states, empty states, loading states\n\n"
            "Describe flows in enough detail for a developer to implement without a designer."
        ),
        expected_output="Detailed user flow descriptions with screen specifications in markdown",
        agent=ux_flow_designer,
        context=[requirements_task, prioritization_task],
    )

    prd_task = Task(
        description=(
            "Assemble the final PRD document combining all inputs:\n\n"
            "Structure:\n"
            "1. Executive Summary\n"
            "2. Problem Statement\n"
            "3. Target Users (from validation phase)\n"
            "4. Success Metrics / KPIs\n"
            "5. Feature Requirements (prioritized)\n"
            "6. User Flows\n"
            "7. Non-Functional Requirements\n"
            "8. Out of Scope\n"
            "9. Timeline Estimate\n"
            "10. Open Questions\n\n"
            "Make it comprehensive yet concise. Developer-ready."
        ),
        expected_output="Complete PRD document in markdown format",
        agent=prd_writer,
        context=[requirements_task, prioritization_task, ux_task],
    )

    return Crew(
        agents=[requirements_analyst, feature_prioritizer, ux_flow_designer, prd_writer],
        tasks=[requirements_task, prioritization_task, ux_task, prd_task],
        process=Process.sequential,
        verbose=True,
    )
