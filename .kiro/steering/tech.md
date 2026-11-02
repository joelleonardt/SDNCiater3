---
inclusion: always
---

# Tech Stack

- **Framework**: React 18 + TypeScript 5.7
- **Build**: Vite 6
- **Routing**: React Router v7 (`createBrowserRouter`)
- **State**: Zustand (auth, app, ui stores)
- **Backend/DB**: Supabase (`@supabase/supabase-js`) — Postgres, Auth, RLS
- **Forms**: react-hook-form + zod resolvers
- **Styling**: Tailwind CSS v3 + `tailwind-merge` + `clsx` + `tailwindcss-animate`
- **UI primitives**: Radix UI (avatar, dropdown-menu, label, separator, slot, tooltip)
- **Component library**: shadcn/ui pattern (components in `src/components/ui/`)
- **Icons**: lucide-react
- **Testing**: Vitest + Testing Library + jsdom + fast-check

## Commands

```bash
npm run dev          # dev server
npm run build        # tsc -b && vite build
npm run preview      # preview production build
npm run lint         # eslint
npm run test         # vitest (watch)
npm run test:run     # vitest run (single pass, use this in CI)
```

## Path alias

`@/` maps to `src/` — always use this for imports within `src/`.

## Environment

Copy `.env.example` → `.env.local`. Required vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
