# TSM Pro

A professional Terminal System Manager web app for Android device management and MDM (Mobile Device Management) package removal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/tsm-pro run dev` — run the frontend (port 23301)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind v4, shadcn/ui, TanStack Query, wouter
- API: Express 5 with session auth (bcryptjs + connect-pg-simple)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Source of truth for all API contracts
- `lib/db/src/schema/` — Database schemas (users, devices, mdm-packages, jobs, activity)
- `artifacts/api-server/src/routes/` — API route handlers (auth, devices, mdm-packages, jobs, users, stats)
- `artifacts/tsm-pro/src/` — React frontend (pages, components)
- `lib/api-client-react/src/generated/` — Generated React Query hooks
- `lib/api-zod/src/generated/` — Generated Zod schemas for server validation

## Architecture decisions

- Session-based auth stored in PostgreSQL via connect-pg-simple (not JWT) — simpler for admin tools
- MDM removal is simulated server-side with timed log generation (no real USB, no Python agent on the web)
- First registered user automatically gets admin role
- Scan endpoint generates deterministic fake devices for demo purposes
- Dark-only theme — no theme toggle, always dark class on html element

## Product

TSM Pro lets hardware technicians:
1. **Register/Login** — admin creates account, technicians log in
2. **Manage Devices** — register, scan for, reboot to different modes (normal/fastboot/recovery/edl)
3. **Remove MDM** — select device + MDM package → create job → watch real-time progress logs
4. **Monitor Jobs** — view all jobs, job detail with colored console output, global console view
5. **Manage Users** — admins can create/update/delete technician accounts

## User preferences

_Populate as needed._

## Gotchas

- `bcrypt` requires native builds (pnpm approve-builds) — use `bcryptjs` instead (already done)
- `@apply dark` is invalid in Tailwind v4 — use `document.documentElement.classList.add("dark")` in main.tsx
- After any OpenAPI spec change, re-run codegen before using updated types

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
