# SkillMap — Copilot Project Instructions

## Project Overview
SkillMap is an internal dashboard for mid-to-large IT organizations that visualizes employees' technical skills as an interactive, Obsidian-inspired knowledge graph. Employees (Users) are nodes connected to Skill nodes via edges carrying proficiency metadata.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Graph UI | React Flow (primary), Cytoscape.js (fallback/export) |
| State Management | Zustand |
| Backend API | Next.js Route Handlers (`src/app/api/`) |
| Auth | NextAuth.js (SSO / OAuth) |
| Graph Database | Neo4j (via `@neo4j/graphql` + `neo4j-driver`) |
| Linting | ESLint (`eslint-config-next`) |

## Folder Structure

```
src/
  app/
    api/          # Next.js Route Handlers (REST endpoints)
    (dashboard)/  # Protected dashboard routes
    (auth)/       # Auth pages (sign-in, etc.)
  components/
    graph/        # Graph visualization components (React Flow nodes, edges, canvas)
    ui/           # Reusable UI primitives
  lib/
    neo4j.ts      # Neo4j driver singleton
    auth.ts       # NextAuth configuration
    rbac.ts       # RBAC helpers
  types/          # Shared TypeScript types
  hooks/          # Custom React hooks
```

## Data Model (Neo4j Graph)

```
(User {id, name, email, department, seniority})
  -[:HAS_SKILL {level: "beginner|intermediate|advanced|expert", source: "manual|git"}]->
(Skill {id, name, category, icon})

(User)-[:ENDORSES {createdAt}]->(User)-[:HAS_SKILL]->(Skill)
```

## Key Conventions

- **Language**: All code comments, log statements, and inline documentation MUST be in English.
- **API security**: Every Route Handler must check authentication via NextAuth `getServerSession()` and enforce RBAC before returning data.
- **Queries**: All Neo4j Cypher queries must use parameterized inputs. Never interpolate user input into query strings.
- **Components**: Graph node/edge components live in `src/components/graph/`. Data transformation (raw API response → React Flow node/edge format) happens in `src/lib/graph/` utilities, not inside components.
- **RBAC roles**: `admin`, `manager`, `employee`. Admins can manage all users and skills. Managers see their department. Employees see only public profiles and their own data.
- **Privacy**: Never expose employee email addresses or department data to roles below `manager` without explicit opt-in.

## Agents

- `@Backend & Database Architect` — Neo4j schema, SQL/Cypher queries, API endpoints, migrations, RBAC logic.
- `@Frontend Graph Visualization Architect` — React Flow components, graph layout, node/edge styling, filtering, performance.
