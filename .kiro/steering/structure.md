---
inclusion: always
---

# Project Structure

```
src/
  main.tsx              # entry point
  app/
    App.tsx             # root component (AppProviders + RouterProvider)
    providers.tsx       # global providers (auth init, toast, etc.)
    routes.tsx          # all route definitions (createBrowserRouter)
  components/ui/        # shared UI components (shadcn/ui + custom)
  features/             # one folder per domain feature
  lib/
    utils.ts            # cn() and shared helpers
    validators.ts       # shared zod schemas
  services/
    supabase.ts         # supabase client singleton
    authService.ts      # auth-related API calls
  stores/
    authStore.ts        # session + profile (Zustand)
    appStore.ts         # app-wide state
    uiStore.ts          # UI state (sidebar, modals)
    index.ts            # re-exports
  types/
    database.types.ts   # auto-generated Supabase types
  test/                 # shared test utilities / setup
```

## Feature folder convention

Each feature under `src/features/<name>/` contains:
- `<Name>Page.tsx` — the page component (lazy-loaded in routes.tsx)
- `index.ts` — public exports from the feature

Add sub-components, hooks, and services inside the feature folder; only export what routes or other features need.

## Component conventions

- Shared, reusable UI → `src/components/ui/`
- Feature-specific → inside `src/features/<name>/`
- Page components are lazy-loaded in `routes.tsx` with a `Suspense` fallback
- Route access control uses `<RoleGuard allowedRoles={[...]}>` wrapping the page

## Auth pattern

`useAuthStore` (Zustand) holds `session` and `profile`. `initializeAuth()` is called once in `providers.tsx` and subscribes to Supabase auth state changes. `ProtectedRoute` redirects unauthenticated users to `/login`.
