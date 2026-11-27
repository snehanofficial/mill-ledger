# Client Workspace

## Overview

The client package provides the web frontend for MillLedger. It delivers role specific screens for salesmen, production staff, store managers, accountants, and administrators using React 19, Vite, and Tailwind CSS. It supports offline order capture with Dexie and Workbox service workers.

## Key files

| File                                           | Owns                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `src/main.tsx`                                 | Application entry point and CSS bundle imports                |
| `src/app.tsx`                                  | Data router setup and route hierarchy                         |
| `src/layouts/authenticated-layout.tsx`         | Authenticated shell wrapper with sidebar and top header       |
| `src/components/shell/authenticated-shell.tsx` | Main responsive layout with desktop sidebar and mobile drawer |
| `src/components/shell/nav-config.tsx`          | Role based navigation links and icons                         |
| `src/hooks/use-current-user.ts`                | Current session user hook for shell and guards                |
| `src/pages/showcase-page.tsx`                  | Design system showcase and component verification             |
| `src/pages/placeholder-pages.tsx`              | Temporary placeholder screens for future domain features      |
| `src/lib/utils.ts`                             | Tailwind class merger helper                                  |

## Commands

```bash
# Start local development server
pnpm --filter client dev

# Run TypeScript type check
pnpm --filter client typecheck

# Lint workspace files
pnpm --filter client lint

# Build client bundle for production
pnpm --filter client build

# Preview production build locally
pnpm --filter client preview
```

## Conventions

- Use functional components with hooks only.
- Place shared layout controls inside `src/components/shell/`.
- Place reusable primitive components inside `src/components/ui/`.
- Use Tailwind utility classes via `cn()` for styling.
- Keep route handles structured using the route handle registry in `src/routes/route-handles.ts`.
- Avoid mixing business calculation logic inside presentation components.

## Gotchas

- `useCurrentUser` fetches the live session from Better Auth (`GET /api/v1/auth/session` / auth client).
- Client routes must not assume server approval or stock reservation during offline entry.
- Service worker caching must never cache sensitive user data or private financial documents indiscriminately.

## Agent skills

- [shadcn](.agents/skills/shadcn/): `shadcn/ui`, manages UI primitives and styling
- [tanstack-query](.agents/skills/tanstack-query/): `tanstack/query`, manages server state and mutations
- [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/): `vercel/react`, guidelines for performance and component structure
- [web-design-guidelines](.agents/skills/web-design-guidelines/): `web/design`, rules for accessible and consistent interfaces

## Related specs

- [docs/ui-ux-spec.md](../docs/ui-ux-spec.md)
- [docs/offline-sync.md](../docs/offline-sync.md)
