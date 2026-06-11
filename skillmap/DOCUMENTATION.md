# SkillMap — Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [Neo4j Data Model](#4-neo4j-data-model)
5. [Project Structure](#5-project-structure)
6. [Environment & Containerization](#6-environment--containerization)
7. [API Reference](#7-api-reference)
8. [Frontend Features](#8-frontend-features)
9. [Shared Types](#9-shared-types)
10. [Security & Access Control](#10-security--access-control)
11. [Known Limitations & Planned Work](#11-known-limitations--planned-work)

---

## 1. Project Overview

**SkillMap** is an internal dashboard for mid-to-large IT organizations. It visualizes employees' technical skills as an interactive, Obsidian-inspired knowledge graph — connecting User nodes to Skill nodes via edges that carry proficiency metadata.

Rather than static spreadsheets or outdated HR profiles, SkillMap provides an ever-evolving graph that answers questions like:

> *"Who in the Engineering department is an expert in Kubernetes and at least intermediate in Go?"*

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, TypeScript) | 16.2.9 |
| Styling | Tailwind CSS | 4 |
| Graph Visualization | React Flow | 11.11.4 |
| Graph Visualization (fallback) | Cytoscape.js | 3.34.0 |
| State Management | Zustand | 5.0.14 |
| Backend API | Next.js Route Handlers (`src/app/api/`) | — |
| Auth (prepared, not yet wired) | NextAuth.js | 4.24.14 |
| Graph Database | Neo4j | 5 (Docker) |
| Neo4j Client | neo4j-driver | 6.1.0 |
| Runtime | Node.js | 20 (Docker) |
| Container Orchestration | Docker Compose | — |

---

## 3. Architecture & Data Flow

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                │
│                                                                 │
│   ┌─────────────┐      ┌──────────────────────────────────┐   │
│   │  Sidebar    │      │   <SkillGraph /> (React Flow)    │   │
│   │  Navigation │      │   + <FilterBar />                │   │
│   └─────────────┘      └──────────────────────────────────┘   │
│          │                          │                          │
│          │                    useGraphData()                   │
│          │                    fetch /api/graph                 │
└──────────┼──────────────────────────┼──────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js App (Port 3000)                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Route Handlers  (src/app/api/)              │  │
│  │                                                          │  │
│  │  GET/POST /api/users                                     │  │
│  │  GET/POST /api/skills                                    │  │
│  │  GET/POST /api/users/[id]/skills                        │  │
│  │  GET      /api/graph                                     │  │
│  │  GET      /api/health                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────────┐  │
│  │              src/lib/neo4j.ts — runQuery()               │  │
│  │              Lazy singleton driver                       │  │
│  └───────────────────────┬──────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────┘
                           │ Bolt protocol (7687)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Neo4j 5 (Port 7474/7687)                   │
│                                                                 │
│   (:User)──[:HAS_SKILL {level, source}]──▶(:Skill)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Graph Visualization Data Flow

```
Neo4j Database
      │
      │  3 parallel Cypher queries
      │  (users, skills, HAS_SKILL edges)
      ▼
GET /api/graph (Route Handler)
      │
      │  Prefixes node IDs:
      │  "user-<uuid>", "skill-<uuid>"
      │  Sets position {x:0, y:0}
      ▼
useGraphData() hook (client)
      │
      │  transformGraphData()
      │  • Positions users in left column  (x=80)
      │  • Positions skills in right column (x=500)
      │  • Maps edge stroke width/color by proficiency level
      ▼
React Flow canvas
      │
      │  FilterBar applies multi-criteria AND filter
      │  • Matching users → opacity 1
      │  • Non-matching users → opacity 0.1
      │  • Skills with no visible users → opacity 0.1
      ▼
Rendered graph (browser)
```

### 3.3 Skill Matrix Data Flow

```
/matrix (Server Component — runs at request time)
      │
      │  3 parallel Neo4j queries
      │  (users, skills, HAS_SKILL relationships)
      ▼
Builds levelMap[userId][skillId] = SkillLevel
      │
      ▼
<SkillMatrix /> (Client Component)
      │
      ├── Renders table (users × skills, proficiency badges)
      │
      ├── Add User form ──▶ POST /api/users ──▶ router.refresh()
      ├── Add Skill form ──▶ POST /api/skills ──▶ router.refresh()
      └── Assign Skill form ──▶ POST /api/users/[id]/skills ──▶ router.refresh()
```

---

## 4. Neo4j Data Model

### 4.1 Nodes

**(:User)**
```
{
  id: string          // UUID (unique)
  name: string
  email: string       // Unique constraint
  department: string
  seniority: string   // e.g. "senior", "mid", "junior"
  role: string        // "admin" | "manager" | "employee"
  education: string[] // Optional. Format: "YYYY – YYYY: University, degree / field"
  certifications: string[] // Optional
  languages: string[] // Optional
}
```

**(:Skill)**
```
{
  id: string        // UUID (unique)
  name: string      // Unique constraint
  category: string  // e.g. "Frontend", "Database", "DevOps"
  icon: string|null // Optional icon identifier
}
```

### 4.2 Relationships

```
(User)-[:HAS_SKILL {
  level:  "beginner" | "intermediate" | "advanced" | "expert",
  source: "manual" | "git"
}]->(Skill)
```

> **Planned:** `(User)-[:ENDORSES {createdAt}]->(User)-[:HAS_SKILL]->(Skill)`

### 4.3 Constraints & Indexes

Defined in `scripts/init-db.cypher`, applied automatically on container start via the `neo4j-init` Docker service:

```cypher
CREATE CONSTRAINT user_email_unique IF NOT EXISTS
  FOR (u:User) REQUIRE u.email IS UNIQUE;

CREATE CONSTRAINT skill_name_unique IF NOT EXISTS
  FOR (s:Skill) REQUIRE s.name IS UNIQUE;

CREATE INDEX has_skill_level IF NOT EXISTS
  FOR ()-[r:HAS_SKILL]-() ON (r.level);
```

---

## 5. Project Structure

```
skillmap/
├── Dockerfile                    # Multi-stage Next.js container (deps → builder → runner)
├── docker-compose.yml            # neo4j + app + neo4j-init services
├── .env.example                  # Env var template
├── .env.local                    # Local dev values (git-ignored)
├── scripts/
│   └── init-db.cypher            # Neo4j uniqueness constraints + indexes
├── public/                       # Static assets
└── src/
    ├── types/
    │   └── index.ts              # All shared TypeScript interfaces and union types
    ├── lib/
    │   ├── neo4j.ts              # Lazy driver singleton + runQuery() helper
    │   ├── rbac.ts               # Role hierarchy + hasPermission() stub
    │   └── graph/
    │       └── transform.ts      # API response → React Flow Node[] + Edge[]
    ├── hooks/
    │   └── useGraphData.ts       # Client hook: fetch /api/graph + transform
    ├── app/
    │   ├── page.tsx              # Root page: sidebar + SkillGraph (handles /)
    │   ├── globals.css           # Tailwind v4 + CSS variables
    │   ├── layout.tsx            # Root HTML shell (fonts, metadata)
    │   ├── (dashboard)/
    │   │   ├── layout.tsx        # Sidebar nav wrapper (for /matrix)
    │   │   └── matrix/
    │   │       └── page.tsx      # Server component: fetches + renders SkillMatrix
    │   └── api/
    │       ├── health/route.ts   # GET  /api/health
    │       ├── users/
    │       │   ├── route.ts      # GET  /api/users, POST /api/users
    │       │   └── [id]/skills/
    │       │       └── route.ts  # GET  /api/users/:id/skills
    │       │                     # POST /api/users/:id/skills
    │       ├── skills/
    │       │   └── route.ts      # GET  /api/skills, POST /api/skills
    │       └── graph/
    │           └── route.ts      # GET  /api/graph
    └── components/
        ├── graph/
        │   ├── SkillGraph.tsx    # Full-screen React Flow canvas + filter logic
        │   ├── FilterBar.tsx     # Floating multi-criteria filter bar
        │   ├── UserNode.tsx      # Custom circular blue User node
        │   └── SkillNode.tsx     # Custom pill-shaped green Skill node
        └── ui/
            └── SkillMatrix.tsx   # Interactive user × skill proficiency table
```

---

## 6. Environment & Containerization

### 6.1 Environment Variables

| Variable | Description | Default (local dev) |
|----------|-------------|---------------------|
| `NEO4J_URI` | Bolt connection URI | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `skillmap_dev` |

Copy `.env.example` to `.env.local` for local development outside Docker.

### 6.2 Docker Services

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| `neo4j` | `neo4j:5` | `7474` (Browser), `7687` (Bolt) | Graph database |
| `app` | Built from `Dockerfile` | `3000` | Next.js application |
| `neo4j-init` | `neo4j:5` | — | One-shot: applies constraints/indexes via `cypher-shell` |

### 6.3 Docker Compose Startup Order

```
neo4j starts
    │
    │ healthcheck: GET http://localhost:7474
    │ (retries every 10s, up to 10 times)
    ▼
neo4j is healthy
    ├──▶ neo4j-init runs (applies constraints, exits)
    └──▶ app starts (Next.js server)
```

### 6.4 Running the Stack

```bash
# Start everything (builds the Next.js image on first run)
docker-compose up --build

# Local development without Docker (requires neo4j running separately)
npm run dev
```

---

## 7. API Reference

All endpoints are **unauthenticated** in the current build. Authentication (NextAuth) is planned for a future phase.

All Cypher queries use **parameterized inputs** — user input is never string-interpolated.

---

### `GET /api/health`

Smoke-tests the Neo4j driver connection.

**Response `200`:**
```json
{ "ok": true, "neo4j": [{ "ok": 1 }] }
```

**Response `503`:**
```json
{ "ok": false, "error": "Missing Neo4j environment variables..." }
```

---

### `GET /api/users`

Returns all users. Email is intentionally excluded from the list response.

**Response `200`:**
```json
[
  {
    "id": "550e8400-...",
    "name": "Alice Dev",
    "department": "Engineering",
    "seniority": "senior",
    "role": "employee",
    "education": ["2016 – 2020: MIT, Computer Science / AI"],
    "certifications": ["AWS Solutions Architect"],
    "languages": ["English", "Romanian"]
  }
]
```

---

### `POST /api/users`

Creates a new user. Rejects duplicate email addresses (409).

**Request body:**
```json
{
  "name": "Alice Dev",
  "email": "alice@company.com",
  "department": "Engineering",
  "seniority": "senior",
  "role": "employee",
  "education": ["2016 – 2020: MIT, Computer Science / AI"],
  "certifications": ["AWS Solutions Architect"],
  "languages": ["English"]
}
```

> `education`, `certifications`, and `languages` are **optional**.
>
> Education entries must match: `YYYY – YYYY: description` or `YYYY – present: description`
> (accepts both `–` en-dash and `-` hyphen as separators)

**Response `201`:** Created user object.

**Response `400`:** Validation error (missing fields, invalid education format, wrong array type).

**Response `409`:** `{ "error": "A user with this email already exists" }`

---

### `GET /api/skills`

Returns all skills ordered by name.

**Response `200`:**
```json
[
  { "id": "abc123", "name": "TypeScript", "category": "Language", "icon": null }
]
```

---

### `POST /api/skills`

Creates a new skill. Rejects duplicate names (409).

**Request body:**
```json
{ "name": "TypeScript", "category": "Language", "icon": "ts" }
```

> `icon` is optional.

**Response `201`:** Created skill object.

**Response `409`:** `{ "error": "A skill with this name already exists" }`

---

### `GET /api/users/:id/skills`

Returns all skills assigned to the specified user.

**Response `200`:**
```json
[
  {
    "skillId": "abc123",
    "name": "TypeScript",
    "category": "Language",
    "level": "advanced",
    "source": "manual"
  }
]
```

---

### `POST /api/users/:id/skills`

Assigns (or updates) a skill for a user. Uses `MERGE` — re-posting the same `skillId` updates `level`/`source` instead of creating a duplicate.

**Request body:**
```json
{ "skillId": "abc123", "level": "advanced", "source": "manual" }
```

> `source` defaults to `"manual"`. Valid values: `manual`, `git`.
>
> Valid `level` values: `beginner`, `intermediate`, `advanced`, `expert`.

**Response `201`:** `{ "userId", "skillId", "level", "source" }`

**Response `404`:** User or skill not found.

---

### `GET /api/graph`

Returns the full graph in React Flow format. Positions are initialized to `{x:0, y:0}` — the frontend layout algorithm assigns real coordinates.

**Response `200`:**
```json
{
  "nodes": [
    {
      "id": "user-550e8400-...",
      "type": "user",
      "data": { "label": "Alice Dev", "meta": { ...user } },
      "position": { "x": 0, "y": 0 }
    },
    {
      "id": "skill-abc123",
      "type": "skill",
      "data": { "label": "TypeScript", "meta": { ...skill } },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "edge-user-550e8400-...-skill-abc123",
      "source": "user-550e8400-...",
      "target": "skill-abc123",
      "data": { "level": "advanced", "source": "manual" }
    }
  ]
}
```

---

## 8. Frontend Features

### 8.1 Graph View (`/`)

The default page renders an interactive, full-screen knowledge graph.

**Visual encoding:**

| Element | Meaning |
|---------|---------|
| Blue circular node | Employee (User) |
| Green pill-shaped node | Skill |
| Edge stroke width (1–5px) | Proficiency level (thicker = more expert) |
| Edge color | beginner → gray, intermediate → blue, advanced → green, expert → violet |

**Controls:**
- Zoom in/out via scroll wheel or bottom-left Controls panel
- Drag nodes to rearrange
- MiniMap (bottom-right) shows full graph overview; user nodes = blue, skill nodes = green

### 8.2 Multi-Criteria Filter Bar

A floating bar above the graph canvas allows filtering users by **any combination of skills and minimum proficiency levels**.

**How it works:**

1. Select a skill from the dropdown and a minimum level (e.g. `≥ advanced`)
2. Click `+ Add` — the filter chip appears
3. Add more chips (e.g. `Python ≥ intermediate`)
4. The graph immediately dims all users who do **not** satisfy **all** active criteria simultaneously (AND logic)
5. Skill nodes with no remaining visible users also dim
6. Click `×` on a chip to remove that criterion; click `Clear all` to reset

**Example:**
> Filter: `Java ≥ expert` AND `Python ≥ intermediate`
>
> Result: Only users with **both** Java at expert level **and** Python at intermediate or above remain fully visible.

### 8.3 Skill Matrix (`/matrix`)

A tabular view of all users × skills with proficiency badges per cell.

**Badge color coding:**

| Level | Color |
|-------|-------|
| beginner | Gray |
| intermediate | Blue |
| advanced | Green |
| expert | Violet |

**Inline management forms (three panels below the table):**

| Form | Required Fields | Optional Fields |
|------|----------------|-----------------|
| Add User | name, email, department, seniority, role | education[], certifications[], languages[] |
| Add Skill | name, category | icon |
| Assign Skill | user (dropdown), skill (dropdown), level | — |

All forms submit to the REST API and refresh the server component data without a full page reload (`router.refresh()`).

### 8.4 Education / Certifications / Languages

The Add User form includes three multi-entry list fields. Each field:
- Accepts free-text input
- `Enter` key or `+` button appends the entry as a chip
- `×` button on each chip removes it

**Education format enforced:**
```
YYYY – YYYY: University Name, Degree / Field of Study
YYYY – present: Institution, Description
```

---

## 9. Shared Types

All TypeScript types are centralized in `src/types/index.ts`:

```typescript
type SkillLevel  = 'beginner' | 'intermediate' | 'advanced' | 'expert'
type SkillSource = 'manual' | 'git'
type Role        = 'admin' | 'manager' | 'employee'

interface User {
  id: string; name: string; email: string
  department: string; seniority: string; role: Role
  education?: string[]; certifications?: string[]; languages?: string[]
}

interface Skill {
  id: string; name: string; category: string; icon?: string
}

interface HasSkillRelationship {
  userId: string; skillId: string
  level: SkillLevel; source: SkillSource
}

// React Flow compatible shapes
interface GraphNode {
  id: string; type: 'user' | 'skill'
  data: { label: string; meta: User | Skill }
  position: { x: number; y: number }
}

interface GraphEdge {
  id: string; source: string; target: string
  data: { level: SkillLevel; source: SkillSource }
}
```

---

## 10. Security & Access Control

### Current state

- All API endpoints are **open** (no authentication check)
- RBAC infrastructure is in place (`src/lib/rbac.ts`) but not yet enforced:

```typescript
// Role hierarchy
ROLE_HIERARCHY = { employee: 0, manager: 1, admin: 2 }

hasPermission(userRole: Role, requiredRole: Role): boolean
```

- All Cypher queries use **parameterized inputs** — no string interpolation of user data
- Email addresses are excluded from `GET /api/users` list responses (privacy)
- Neo4j uniqueness constraints prevent duplicate User/Skill creation at the database level

### Planned

- NextAuth.js integration (Credentials provider for local dev, OAuth for production)
- `getServerSession()` check in every Route Handler
- `hasPermission()` enforcement per endpoint:
  - `POST /api/users` — admin only
  - `POST /api/skills` — admin only
  - `GET /api/users` — manager+
  - `GET /api/users/:id/skills` — manager+ or self
- Dashboard auth guard in `(dashboard)/layout.tsx`

---

## 11. Known Limitations & Planned Work

| Area | Current State | Planned |
|------|--------------|---------|
| Authentication | None — all endpoints open | NextAuth Credentials + OAuth |
| RBAC enforcement | Stub only | Wire `hasPermission()` into all Route Handlers |
| Graph layout | Static column layout (users left, skills right) | Force-directed D3/ELK layout |
| Endorsements | Data model defined, not implemented | `[:ENDORSES]` relationship + UI |
| Bulk import | Not implemented | CSV upload via `POST /api/users/bulk` |
| Admin panel | Add User/Skill via matrix forms only | Dedicated admin page with delete/edit |
| User profile page | Not implemented | Click user node → profile card with education/certs |
| Git webhook parser | Not implemented | Auto-infer skills from commit/PR activity |
| Test coverage | None | Unit tests for transforms/RBAC, integration tests for API routes |
