# Copilot Project Instructions

You are working in a strictly structured backend project.

This project uses:

- Node.js (ES Modules)
- TypeScript (ES2024, strict mode)
- Fastify 5
- Prisma 7
- PostgreSQL 16
- better-auth
- Zod v4
- pnpm

You MUST follow all architectural and coding rules below when generating code.

---

# 1. Architecture Pattern

This project follows a strict layered architecture:

Routes → Use Cases → Prisma

## 1.1 Routes Layer (`src/routes`)

Routes are responsible ONLY for:

- Defining REST endpoints
- Validating request and response with Zod v4
- Extracting authentication session (if required)
- Instantiating and calling a Use Case
- Handling errors with try/catch
- Returning proper HTTP status codes

Rules:

- ALWAYS follow REST conventions.
- ALWAYS create route files inside `src/routes`.
- ALWAYS use `fastify-type-provider-zod`.
- ALWAYS use Zod v4.
- NEVER put business logic inside routes.
- ALWAYS call a Use Case class.
- ALWAYS handle errors inside the route (try/catch).
- ALWAYS return typed error responses using shared ErrorSchema.
- When authentication is required, ALWAYS use:
  `auth.api.getSession()`

A route must NEVER access Prisma directly.

---

## 1.2 Use Cases Layer (`src/usecases`)

Use Cases contain ALL business logic.

Rules:

- MUST be implemented as classes.
- MUST have a public async `execute()` method.
- MUST receive a single parameter: an `InputDto` interface.
- MUST return a typed `OutputDto` interface.
- MUST map database results into OutputDto.
- MUST NEVER return Prisma models directly.
- MUST throw only custom errors from `src/errors`.
- MUST NOT use try/catch.
- MUST call Prisma directly (no repository pattern).

Naming rules:

- Class names must be verbs (e.g. CreateWorkoutPlan).
- Use PascalCase for file names in usecases.
- Other files must use kebab-case.

---

## 1.3 Schemas Layer (`src/schemas`)

- ALWAYS use Zod v4.
- ALWAYS define creation/update schemas in `src/schemas/index.ts`.
- ALWAYS use strong validation (z.url, z.iso.date, z.iso.datetime, etc).
- NEVER use manual regex for date validation.
- Prefer `z.interface()` pattern when applicable.

---

## 1.4 Errors (`src/errors`)

- All business errors MUST be custom error classes.
- If a needed error does not exist, CREATE it.
- Routes are responsible for catching and mapping errors to HTTP responses.

---

# 2. TypeScript Rules

STRICT MODE is enabled.

You MUST:

- NEVER use `any`.
- ALWAYS prefer `interface` over `type` (unless strictly necessary).
- ALWAYS use named exports.
- Prefer arrow functions over traditional functions.
- Use early returns instead of nested conditionals.
- When a function has more than 2 parameters, receive an object.
- Use camelCase for variables and functions.
- Use PascalCase for classes.
- Use kebab-case for files (except Use Cases).

---

# 3. Date Handling

- ALWAYS use the "dayjs" library for date manipulation.
- NEVER manipulate dates manually.
- ALWAYS use Zod ISO validators:
    - `z.iso.date()`
    - `z.iso.datetime()`
    - `z.iso.time()`
    - `z.iso.duration()`

---

# 4. Database

- PostgreSQL 16
- Prisma 7
- Prisma client initialized in `src/lib/db.ts`
- Generated types are in `src/generated/prisma/`
- NEVER return raw Prisma models from Use Cases.
- ALWAYS ensure transactional consistency when needed.

---

# 5. Authentication

- Uses better-auth with Prisma adapter.
- Auth routes available at `/api/auth/*`
- Protected routes MUST extract session using:
  `auth.api.getSession()`
- If session does not exist, return 401.

---

# 6. Code Style

- Follow ESLint rules.
- Keep imports sorted.
- Keep code clean and readable.
- Prefer functional patterns (map, filter, reduce) over loops.
- Avoid deeply nested conditionals.

---

# 7. REST Conventions

Examples:

GET    /workout-plans
GET    /workout-plans/:id
POST   /workout-plans
PUT    /workout-plans/:id
DELETE /workout-plans/:id

---

# 8. What You Must NEVER Do

- Never put business logic inside routes.
- Never use `any`.
- Never return Prisma models directly.
- Never skip DTO mapping.
- Never catch errors inside Use Cases.
- Never bypass Zod validation.
- Never write JavaScript (TypeScript only).

---

When generating new code:

ALWAYS strictly follow these instructions.
If unsure, prefer stricter typing and clearer architecture.