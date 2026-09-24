from typing import List, Dict, Any, Optional

ACADEMIC_PROJECT_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "final_year",
        "name": "Final Year Project",
        "category": "Academic",
        "badge_icon": "🎓",
        "description": "Comprehensive 4-phase academic structure optimized for senior capstone and graduation projects.",
        "intended_use": "College final-year capstones & major graduation software/engineering projects.",
        "phases_count": 4,
        "tasks_count": 12,
        "phases": [
            {
                "name": "Phase 1 — Planning",
                "description": "Problem definition, literature review, and academic requirement analysis.",
                "relative_week": 1,
                "tasks": [
                    {"title": "Problem Definition & Scope Statement", "description": "Formulate core problem statement, objectives, and project boundaries.", "priority": "HIGH", "relative_week": 1},
                    {"title": "Literature Survey & Related Work", "description": "Review existing research papers, patents, and benchmark systems.", "priority": "MEDIUM", "relative_week": 1},
                    {"title": "Requirements Analysis & SRS Document", "description": "Draft functional/non-functional requirements and Software Requirement Specification.", "priority": "HIGH", "relative_week": 2},
                ]
            },
            {
                "name": "Phase 2 — System Design",
                "description": "Architectural blueprints, database schema modeling, and system diagrams.",
                "relative_week": 3,
                "tasks": [
                    {"title": "System Architecture & Block Diagrams", "description": "Design component architecture, data flow diagrams, and module boundaries.", "priority": "HIGH", "relative_week": 3},
                    {"title": "Database Schema & Entity Relationship Modeling", "description": "Design normalized relational schemas, tables, index strategies, and ER diagrams.", "priority": "HIGH", "relative_week": 3},
                    {"title": "API Specification & UI Wireframes", "description": "Define REST/GraphQL interfaces and create high-fidelity user experience wireframes.", "priority": "MEDIUM", "relative_week": 4},
                ]
            },
            {
                "name": "Phase 3 — Development",
                "description": "Core software implementation, unit testing, and technical documentation.",
                "relative_week": 5,
                "tasks": [
                    {"title": "Core Module Implementation", "description": "Develop full-stack features, integration logic, and business workflows.", "priority": "CRITICAL", "relative_week": 5},
                    {"title": "System Integration & Verification Testing", "description": "Execute automated integration testing, bug fixing, and edge case coverage.", "priority": "HIGH", "relative_week": 7},
                    {"title": "Technical Documentation & Code Comments", "description": "Maintain clean API docs, inline comments, and developer setup instructions.", "priority": "MEDIUM", "relative_week": 8},
                ]
            },
            {
                "name": "Phase 4 — Final Submission",
                "description": "Final dissertation report, slide decks, and live viva defense preparation.",
                "relative_week": 9,
                "tasks": [
                    {"title": "Final Project Dissertation Report", "description": "Compile complete project thesis report per university guidelines.", "priority": "CRITICAL", "relative_week": 9},
                    {"title": "Presentation Slide Deck Preparation", "description": "Create slides highlighting motivation, methodology, live results, and future work.", "priority": "HIGH", "relative_week": 10},
                    {"title": "Live Demo & Viva Defense Preparation", "description": "Prepare demo environment, mock questions, and evaluation proof.", "priority": "CRITICAL", "relative_week": 11},
                ]
            }
        ]
    },
    {
        "id": "mini_project",
        "name": "Mini Project",
        "category": "Academic",
        "badge_icon": "💻",
        "description": "Streamlined 3-phase template tailored for semester course projects and lab assignments.",
        "intended_use": "Semester subject mini-projects, term coursework, and lab demonstrations.",
        "phases_count": 3,
        "tasks_count": 9,
        "phases": [
            {
                "name": "Phase 1 — Planning",
                "description": "Problem formulation and tech stack selection.",
                "relative_week": 1,
                "tasks": [
                    {"title": "Problem Statement Formulation", "description": "Define project goal and target solution.", "priority": "HIGH", "relative_week": 1},
                    {"title": "Requirements Gathering", "description": "List essential user features and project inputs.", "priority": "MEDIUM", "relative_week": 1},
                    {"title": "Technology Selection & Environment Setup", "description": "Choose frameworks, database, and initialize repository.", "priority": "HIGH", "relative_week": 1},
                ]
            },
            {
                "name": "Phase 2 — Development",
                "description": "Rapid design, feature coding, and testing.",
                "relative_week": 2,
                "tasks": [
                    {"title": "UI/UX & Database Design", "description": "Sketch basic layout and database structure.", "priority": "MEDIUM", "relative_week": 2},
                    {"title": "Feature Implementation", "description": "Develop application core functionality.", "priority": "CRITICAL", "relative_week": 2},
                    {"title": "Testing & Bug Fixes", "description": "Verify user flows and correct errors.", "priority": "HIGH", "relative_week": 3},
                ]
            },
            {
                "name": "Phase 3 — Submission",
                "description": "Final report, demo recording, and evaluation.",
                "relative_week": 4,
                "tasks": [
                    {"title": "Project Synopsis & Report", "description": "Write project report and screenshots summary.", "priority": "HIGH", "relative_week": 4},
                    {"title": "Presentation Slides", "description": "Prepare concise slide deck for evaluation.", "priority": "MEDIUM", "relative_week": 4},
                    {"title": "Demo & Source Code Submission", "description": "Package code repo and deliver live demonstration.", "priority": "CRITICAL", "relative_week": 4},
                ]
            }
        ]
    },
    {
        "id": "hackathon",
        "name": "Hackathon Sprint",
        "category": "Competition",
        "badge_icon": "🏆",
        "description": "High-velocity 3-phase execution model built for 24-72 hour competitive hackathons.",
        "intended_use": "Hackathons, rapid product prototyping, and competitive build sprints.",
        "phases_count": 3,
        "tasks_count": 10,
        "phases": [
            {
                "name": "Phase 1 — Ideation & Scope",
                "description": "Rapid problem definition, idea validation, and MVP scope lock.",
                "relative_week": 1,
                "tasks": [
                    {"title": "Problem Identification & User Persona", "description": "Pinpoint target problem and user friction.", "priority": "HIGH", "relative_week": 1},
                    {"title": "Idea Validation & Pitch Angle", "description": "Validate novelty, feasibility, and prize track alignment.", "priority": "HIGH", "relative_week": 1},
                    {"title": "MVP Feature Scope Lock", "description": "Freeze minimal viable product features and drop non-essential bloat.", "priority": "CRITICAL", "relative_week": 1},
                ]
            },
            {
                "name": "Phase 2 — Build Sprint",
                "description": "Parallel UI, backend API, and frontend integration.",
                "relative_week": 1,
                "tasks": [
                    {"title": "UI/UX Mockups & Component Kit", "description": "Design high-impact visual screens and brand identity.", "priority": "HIGH", "relative_week": 1},
                    {"title": "Backend API & Database Core", "description": "Build quick REST endpoints and database models.", "priority": "CRITICAL", "relative_week": 1},
                    {"title": "Frontend App Integration", "description": "Connect frontend UI components to backend endpoints.", "priority": "CRITICAL", "relative_week": 1},
                    {"title": "E2E Integration & Demo Walkthrough Test", "description": "Ensure happy-path user flow operates without crashing.", "priority": "HIGH", "relative_week": 1},
                ]
            },
            {
                "name": "Phase 3 — Pitch & Submission",
                "description": "Demo video recording, pitch deck, and judge Q&A prep.",
                "relative_week": 1,
                "tasks": [
                    {"title": "2-Minute Demo Video Recording", "description": "Record screen video showcasing working product demo.", "priority": "CRITICAL", "relative_week": 1},
                    {"title": "Pitch Deck & Presentation", "description": "Draft slide deck addressing problem, solution, tech stack, and impact.", "priority": "HIGH", "relative_week": 1},
                    {"title": "Final Devpost / Submission Post", "description": "Publish GitHub repository link, demo URL, and README setup.", "priority": "CRITICAL", "relative_week": 1},
                ]
            }
        ]
    },
    {
        "id": "research",
        "name": "Research Project",
        "category": "Academic",
        "badge_icon": "🔬",
        "description": "Structured methodology for experimental computer science, data science, and academic papers.",
        "intended_use": "Graduate research, journal papers, data science experiments, and thesis investigations.",
        "phases_count": 3,
        "tasks_count": 11,
        "phases": [
            {
                "name": "Phase 1 — Research & Methodology",
                "description": "Formulating research questions, literature review, and experimental design.",
                "relative_week": 1,
                "tasks": [
                    {"title": "Research Question Formulation", "description": "Define hypothesis, research scope, and novel contribution.", "priority": "HIGH", "relative_week": 1},
                    {"title": "Comprehensive Literature Review", "description": "Synthesize related papers and benchmark methodologies.", "priority": "HIGH", "relative_week": 2},
                    {"title": "Experimental Methodology Design", "description": "Establish datasets, metrics, and baseline comparisons.", "priority": "HIGH", "relative_week": 3},
                ]
            },
            {
                "name": "Phase 2 — Experimentation",
                "description": "Data preprocessing, algorithm implementation, and empirical evaluation.",
                "relative_week": 4,
                "tasks": [
                    {"title": "Data Collection & Preprocessing", "description": "Gather, clean, normalize, and split dataset.", "priority": "HIGH", "relative_week": 4},
                    {"title": "Algorithm & Baseline Implementation", "description": "Code proposed model architectures and comparison baselines.", "priority": "CRITICAL", "relative_week": 5},
                    {"title": "Empirical Experiments Execution", "description": "Run benchmarks across parameter variations and store raw metrics.", "priority": "CRITICAL", "relative_week": 6},
                    {"title": "Results & Statistical Analysis", "description": "Plot performance graphs, confusion matrices, and statistical significance tests.", "priority": "HIGH", "relative_week": 7},
                ]
            },
            {
                "name": "Phase 3 — Publication",
                "description": "Paper drafting, peer review iterations, and final submission.",
                "relative_week": 8,
                "tasks": [
                    {"title": "Camera-Ready Paper Draft", "description": "Write LaTeX manuscript adhering to IEEE/ACM formatting.", "priority": "CRITICAL", "relative_week": 8},
                    {"title": "Peer Review & Internal Critique", "description": "Conduct advisor review and refine experimental explanations.", "priority": "HIGH", "relative_week": 9},
                    {"title": "Artifact & Code Repository Release", "description": "Clean code repository, publish weights, and attach open-science license.", "priority": "MEDIUM", "relative_week": 10},
                    {"title": "Final Journal / Conference Submission", "description": "Submit manuscript to target publication venue.", "priority": "CRITICAL", "relative_week": 10},
                ]
            }
        ]
    },
    {
        "id": "software",
        "name": "Software Engineering",
        "category": "Engineering",
        "badge_icon": "⚡",
        "description": "Agile software lifecycle template with user stories, design, development, and deployment.",
        "intended_use": "Full-stack web applications, microservices, mobile apps, and SaaS platforms.",
        "phases_count": 4,
        "tasks_count": 12,
        "phases": [
            {
                "name": "Phase 1 — Requirements & User Stories",
                "description": "User persona definition, backlog grooming, and tech stack setup.",
                "relative_week": 1,
                "tasks": [
                    {"title": "User Stories & Acceptance Criteria", "description": "Draft agile user stories with testable acceptance criteria.", "priority": "HIGH", "relative_week": 1},
                    {"title": "Tech Stack & CI/CD Pipeline Setup", "description": "Initialize Git repository, linter, docker-compose, and GitHub Actions.", "priority": "HIGH", "relative_week": 1},
                ]
            },
            {
                "name": "Phase 2 — System & UI Design",
                "description": "System architecture, REST API design, and Figma prototypes.",
                "relative_week": 2,
                "tasks": [
                    {"title": "System Architecture & API Contracts", "description": "Design REST endpoints, payload schemas, and authentication flows.", "priority": "HIGH", "relative_week": 2},
                    {"title": "Database Schema Modeling", "description": "Create relational models, migration scripts, and index strategy.", "priority": "HIGH", "relative_week": 2},
                    {"title": "High-Fidelity UI Component Design", "description": "Design responsive UI screens and reusable design tokens.", "priority": "MEDIUM", "relative_week": 2},
                ]
            },
            {
                "name": "Phase 3 — Iterative Development",
                "description": "Backend API development, frontend building, and integration.",
                "relative_week": 3,
                "tasks": [
                    {"title": "Backend API Endpoints Implementation", "description": "Develop CRUD routes, authentication middleware, and database queries.", "priority": "CRITICAL", "relative_week": 3},
                    {"title": "Frontend Component Integration", "description": "Build UI components and connect state management to REST APIs.", "priority": "CRITICAL", "relative_week": 4},
                    {"title": "Unit & Integration Test Suite", "description": "Write automated test coverage for core business logic.", "priority": "HIGH", "relative_week": 5},
                    {"title": "Bug Triage & Performance Optimization", "description": "Audit performance bottlenecks and fix edge-case bugs.", "priority": "HIGH", "relative_week": 6},
                ]
            },
            {
                "name": "Phase 4 — Release & Deployment",
                "description": "Production build deployment, user documentation, and launch.",
                "relative_week": 7,
                "tasks": [
                    {"title": "Production Cloud Deployment", "description": "Deploy backend to production cloud and frontend to CDN.", "priority": "CRITICAL", "relative_week": 7},
                    {"title": "User Manual & API Documentation", "description": "Publish setup guide and end-user documentation.", "priority": "MEDIUM", "relative_week": 7},
                    {"title": "Project Launch & Retrospective", "description": "Execute official launch and hold team sprint retrospective.", "priority": "HIGH", "relative_week": 8},
                ]
            }
        ]
    }
]

def get_template_by_id(template_id: str) -> Optional[Dict[str, Any]]:
    for t in ACADEMIC_PROJECT_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None
