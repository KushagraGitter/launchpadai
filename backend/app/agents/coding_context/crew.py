"""Phase 3: Coding Context Export crew with 4 specialized agents."""

from crewai import Agent, Crew, Task, Process

from app.agents.base import get_llm, build_context_string


def create_coding_context_crew(project_data: dict) -> Crew:
    """Create the Coding Context Export crew for Phase 3."""
    llm = get_llm()
    context = build_context_string(project_data)

    architect = Agent(
        role="System Architect",
        goal="Design the complete system architecture from the PRD",
        backstory=(
            "You are a principal architect who designs scalable systems for startups. "
            "You make pragmatic technology choices, design clean architectures, and "
            "create detailed technical specifications."
        ),
        llm=llm,
        verbose=True,
    )

    schema_designer = Agent(
        role="Schema Designer",
        goal="Design the database schema and API contracts",
        backstory=(
            "You are a database architect and API designer. You create normalized "
            "schemas, design RESTful APIs with OpenAPI specs, and ensure data models "
            "align with business requirements."
        ),
        llm=llm,
        verbose=True,
    )

    task_decomposer = Agent(
        role="Task Decomposer",
        goal="Break the PRD into granular developer tasks with acceptance criteria",
        backstory=(
            "You are a technical lead who excels at breaking down product requirements "
            "into developer-ready tasks. Each task has clear scope, acceptance criteria, "
            "and dependency mapping."
        ),
        llm=llm,
        verbose=True,
    )

    context_packager = Agent(
        role="Context Packager",
        goal="Bundle all technical artifacts into AI-coding-assistant-friendly formats",
        backstory=(
            "You specialize in creating developer documentation that works perfectly "
            "as context for AI coding assistants like Cursor, Copilot, and Claude. "
            "You know how to structure .cursorrules files, README specs, and context "
            "documents that maximize AI coding quality."
        ),
        llm=llm,
        verbose=True,
    )

    architecture_task = Task(
        description=(
            f"Design the system architecture for this product:\n\n"
            f"{context}\n\n"
            "Your architecture document MUST include:\n"
            "1. High-Level Architecture: Components, services, data flow\n"
            "2. Technology Stack: Languages, frameworks, databases, hosting\n"
            "3. Frontend Architecture: Framework, state management, routing\n"
            "4. Backend Architecture: API design patterns, service layer, middleware\n"
            "5. Data Architecture: Database choice, caching strategy, file storage\n"
            "6. Infrastructure: Hosting, CI/CD, monitoring\n"
            "7. Security Architecture: Auth, encryption, RBAC\n"
            "8. Scalability Plan: How to scale from MVP to 10K users\n"
        ),
        expected_output="Complete system architecture document in markdown",
        agent=architect,
    )

    schema_task = Task(
        description=(
            "Design the database schema and API specification:\n\n"
            "1. Database Schema:\n"
            "   - All tables with columns, types, constraints, and indexes\n"
            "   - Relationships (foreign keys, many-to-many)\n"
            "   - Provide SQL CREATE TABLE statements\n"
            "2. API Specification:\n"
            "   - All endpoints: method, path, request/response schemas\n"
            "   - Authentication requirements per endpoint\n"
            "   - Error response formats\n"
            "   - Provide in OpenAPI-like format\n"
        ),
        expected_output="Database schema (SQL) and API specification in markdown",
        agent=schema_designer,
        context=[architecture_task],
    )

    task_decomposition = Task(
        description=(
            "Break down the product into developer-ready tasks:\n\n"
            "For each task include:\n"
            "1. Task ID (e.g., TASK-001)\n"
            "2. Title\n"
            "3. Description (what to implement)\n"
            "4. Acceptance Criteria (testable conditions)\n"
            "5. Dependencies (which tasks must complete first)\n"
            "6. Estimated Effort (hours)\n"
            "7. Priority (P0/P1/P2/P3)\n\n"
            "Organize tasks into: Setup, Backend, Frontend, Integration, Testing\n"
            "Output as a structured list."
        ),
        expected_output="Structured task list with IDs, descriptions, acceptance criteria, and dependencies",
        agent=task_decomposer,
        context=[architecture_task, schema_task],
    )

    packaging_task = Task(
        description=(
            "Package all technical artifacts for AI coding assistants:\n\n"
            "Create the following files:\n\n"
            "1. `.cursorrules` file:\n"
            "   - Project context and architecture summary\n"
            "   - Coding conventions and patterns to follow\n"
            "   - Key technical decisions and constraints\n"
            "   - File structure guidance\n\n"
            "2. `CODING_CONTEXT.md`:\n"
            "   - Complete technical specification\n"
            "   - Architecture diagram (mermaid)\n"
            "   - Database schema\n"
            "   - API contracts\n"
            "   - Implementation guide by feature\n\n"
            "3. `TASKS.json`:\n"
            "   - All tasks in structured JSON format\n"
            "   - Ready for import into project management tools\n\n"
            "Format each as a clearly labeled section."
        ),
        expected_output="Three formatted artifact files: .cursorrules, CODING_CONTEXT.md, TASKS.json",
        agent=context_packager,
        context=[architecture_task, schema_task, task_decomposition],
    )

    return Crew(
        agents=[architect, schema_designer, task_decomposer, context_packager],
        tasks=[architecture_task, schema_task, task_decomposition, packaging_task],
        process=Process.sequential,
        verbose=True,
    )
