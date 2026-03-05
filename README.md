# create-trpc-setup

> One-command tRPC v11 setup for Next.js App Router

## Usage

```bash
npx create-trpc-setup
```

Run inside your existing Next.js project. That's it — everything is automatic.

---

## What it does automatically

1. ✅ Detects your Next.js project (`src/` or root layout)
2. ✅ Installs tRPC v11 + TanStack React Query + Zod + react-error-boundary
3. ✅ Generates all tRPC files
4. ✅ **Auto-patches your `layout.tsx`** — adds `TRPCReactProvider` inside `<body>`

---

## Files generated

```
trpc/
├── init.ts              ← tRPC init, baseProcedure, createTRPCRouter
├── query-client.ts      ← SSR-safe QueryClient
├── client.tsx           ← TRPCReactProvider + useTRPC hook
├── server.tsx           ← prefetch, HydrateClient, caller
└── routers/
    └── _app.ts          ← your app router

app/api/trpc/[trpc]/
└── route.ts             ← API route handler

app/_trpc-test/          ← delete after confirming setup works
```

---

## layout.tsx — auto-patched

Before:

```tsx
<body>
  {children}
  <Toaster />
</body>
```

After:

```tsx
<body>
  <TRPCReactProvider>
    {children}
    <Toaster />
  </TRPCReactProvider>
</body>
```

A `.backup` file is saved before any changes.  
Restore anytime: the original is at `layout.tsx.backup`

---

## Adding procedures

Edit `trpc/routers/_app.ts`:

```ts
export const appRouter = createTRPCRouter({
  // your procedures here
  getUser: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return { id: input.id, name: "John" };
    }),
});
```

---

## Server Component usage

```tsx
// app/page.tsx — Server Component
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { MyClient } from "./my-client";

export default function Page() {
  prefetch(trpc.health.queryOptions());
  return (
    <HydrateClient>
      <MyClient />
    </HydrateClient>
  );
}
```

```tsx
// my-client.tsx — Client Component
"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function MyClient() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.health.queryOptions());
  return <div>{data.status}</div>;
}
```

---

## Test your setup

```bash
npm run dev
```

Open: [http://localhost:3000/trpc-test](http://localhost:3000/trpc-test)

Delete `app/trpc-test/` after confirming ✅

---

## Supported package managers

Auto-detected: `npm` · `pnpm` · `yarn` · `bun`

---

## License

MIT
