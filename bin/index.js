#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Colors ───────────────────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log(`
${c.cyan(c.bold("┌──────────────────────────────────────────────┐"))}
${c.cyan(c.bold("│"))}                                              ${c.cyan(c.bold("│"))}
${c.cyan(c.bold("│"))}   ${c.bold("create-trpc-setup")} ${c.dim("v1.0.2")}                  ${c.cyan(c.bold("│"))}
${c.cyan(c.bold("│"))}   ${c.dim("tRPC v11 · Next.js App Router · RSC ready")} ${c.cyan(c.bold("│"))}
${c.cyan(c.bold("│"))}                                              ${c.cyan(c.bold("│"))}
${c.cyan(c.bold("└──────────────────────────────────────────────┘"))}
`);

// ─── Validate Next.js project ─────────────────────────────────────────────────
const cwd = process.cwd();
const pkgPath = path.join(cwd, "package.json");

if (!fs.existsSync(pkgPath)) {
  console.log(c.red("  ✖  package.json not found."));
  console.log(c.dim("     Run this inside your Next.js project folder.\n"));
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

if (!deps["next"]) {
  console.log(c.red("  ✖  This doesn't look like a Next.js project."));
  console.log(c.dim("     'next' not found in dependencies.\n"));
  process.exit(1);
}

console.log(c.green("  ✔  Next.js project detected"));
console.log();

// ─── Detect layout + package manager ─────────────────────────────────────────
const hasSrc = fs.existsSync(path.join(cwd, "src"));
const base   = hasSrc ? "src" : "";
const appDir = hasSrc ? "src/app" : "app";
const p      = (rel) => (base ? `${base}/${rel}` : rel);

function detectPM() {
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "yarn.lock")))      return "yarn";
  if (fs.existsSync(path.join(cwd, "bun.lockb")))      return "bun";
  return "npm";
}
const pm = detectPM();

console.log(c.dim(`  Layout : ${hasSrc ? "src/" : "root"} directory`));
console.log(c.dim(`  PM     : ${pm}\n`));

// ─── Write helper ─────────────────────────────────────────────────────────────
function write(relPath, content) {
  const full = path.join(cwd, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trimStart(), "utf-8");
  console.log(`  ${c.green("✔")}  ${c.dim(relPath)}`);
}

// ─── Step 1: Install dependencies ────────────────────────────────────────────
console.log(c.bold("📦 Installing dependencies...\n"));

const packages = [
  "@trpc/server@11",
  "@trpc/client@11",
  "@trpc/tanstack-react-query@11",
  "@tanstack/react-query@latest",
  "zod",
  "server-only",
  "react-error-boundary",
];

const installCmd = {
  yarn: `yarn add ${packages.join(" ")}`,
  pnpm: `pnpm add ${packages.join(" ")}`,
  bun:  `bun add ${packages.join(" ")}`,
  npm:  `npm install ${packages.join(" ")}`,
}[pm];

try {
  execSync(installCmd, { stdio: "inherit", cwd });
  console.log(c.green("\n  ✔  Dependencies installed\n"));
} catch {
  console.log(c.red("\n  ✖  Install failed. Run manually:"));
  console.log(c.dim(`     ${installCmd}\n`));
}

// ─── Step 2: Generate files ───────────────────────────────────────────────────
console.log(c.bold("📁 Generating tRPC files...\n"));

// ── trpc/init.ts ──────────────────────────────────────────────────────────────
write(p("trpc/init.ts"), `
import { initTRPC } from "@trpc/server";
import { cache } from "react";

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   * Replace userId with real auth (e.g. Clerk: const { userId } = await auth())
   */
  return { userId: "user_123" };
});

const t = initTRPC.create({
  /**
   * Uncomment to enable SuperJSON transformer:
   * transformer: superjson,
   * Also install: npm i superjson
   */
});

export const createTRPCRouter    = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure       = t.procedure;
`);

// ── trpc/query-client.ts ──────────────────────────────────────────────────────
write(p("trpc/query-client.ts"), `
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
// import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        // serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        // deserializeData: superjson.deserialize,
      },
    },
  });
}
`);

// ── trpc/client.tsx ───────────────────────────────────────────────────────────
write(p("trpc/client.tsx"), `
"use client";
// ^-- to make sure we can mount the Provider from a server component

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

function getUrl() {
  const base = (() => {
    if (typeof window !== "undefined") return "";
    if (process.env.APP_URL) return process.env.APP_URL;
    return "http://localhost:3000";
  })();
  return \`\${base}/api/trpc\`;
}

export function TRPCReactProvider(
  props: Readonly<{
    children: React.ReactNode;
  }>,
) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          // transformer: superjson, <-- if you use a data transformer
          url: getUrl(),
        }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
`);

// ── trpc/server.tsx ───────────────────────────────────────────────────────────
write(p("trpc/server.tsx"), `
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only"; // <-- ensure this file cannot be imported from the client
import {
  createTRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

// If your router is on a separate server, pass a client:
// createTRPCOptionsProxy({
//   client: createTRPCClient({
//     links: [httpLink({ url: "..." })],
//   }),
//   queryClient: getQueryClient,
// });

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
`);

// ── trpc/routers/_app.ts ──────────────────────────────────────────────────────
write(p("trpc/routers/_app.ts"), `
import { baseProcedure, createTRPCRouter } from "../init";

export const appRouter = createTRPCRouter({
  health: baseProcedure.query(async () => {
    return { status: "Ok", code: 200 };
  }),
});

export type AppRouter = typeof appRouter;
`);

// ── app/api/trpc/[trpc]/route.ts ──────────────────────────────────────────────
write(`${appDir}/api/trpc/[trpc]/route.ts`, `
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
`);

// ── _trpc-test/page.tsx ───────────────────────────────────────────────────────
write(`${appDir}/_trpc-test/page.tsx`, `
import React, { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ErrorBoundary } from "react-error-boundary";
import HealthCheck from "./_health-check";

/**
 * tRPC test page — visit /trpc-test to verify setup.
 * Delete this folder after confirming everything works ✅
 */
const TRPCTestPage = () => {
  prefetch(trpc.health.queryOptions());

  return (
    <HydrateClient>
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <h1>tRPC Test Page</h1>
        <ErrorBoundary fallback={<div>Something went wrong</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <HealthCheck />
          </Suspense>
        </ErrorBoundary>
      </div>
    </HydrateClient>
  );
};

export default TRPCTestPage;
`);

// ── _trpc-test/_health-check.tsx ──────────────────────────────────────────────
write(`${appDir}/_trpc-test/_health-check.tsx`, `
"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function HealthCheck() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.health.queryOptions());
  return (
    <div className="rounded-lg border-b p-6 text-center">
      <p className="text-muted-foreground text-sm">tRPC Status</p>
      <p className="mt-2 text-lg font-semibold">✅ {data.status}</p>
    </div>
  );
}
`);

// ─── Step 3: Auto-patch layout.tsx ───────────────────────────────────────────
console.log(c.bold("\n🔧 Patching layout.tsx...\n"));

const layoutCandidates = [
  `${appDir}/layout.tsx`,
  `${appDir}/layout.jsx`,
];

let layoutPath = null;
for (const candidate of layoutCandidates) {
  if (fs.existsSync(path.join(cwd, candidate))) {
    layoutPath = candidate;
    break;
  }
}

if (!layoutPath) {
  console.log(c.yellow("  ⚠  layout.tsx not found — skipping auto-patch."));
  console.log(c.dim(`     Expected at: ${appDir}/layout.tsx\n`));
} else {
  let layoutCode = fs.readFileSync(path.join(cwd, layoutPath), "utf-8");

  // Backup
  fs.writeFileSync(path.join(cwd, layoutPath + ".backup"), layoutCode, "utf-8");

  if (layoutCode.includes("TRPCReactProvider")) {
    console.log(c.yellow("  ⚠  TRPCReactProvider already in layout.tsx — skipped."));
  } else {
    // 1. Add import after last import line
    const trpcImport = `import { TRPCReactProvider } from "@/trpc/client";`;
    const importRegex = /^(import\s[\s\S]+?['"];?\s*\n)/gm;
    let lastIdx = 0;
    let m;
    while ((m = importRegex.exec(layoutCode)) !== null) {
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx > 0) {
      layoutCode = layoutCode.slice(0, lastIdx) + trpcImport + "\n" + layoutCode.slice(lastIdx);
    } else {
      layoutCode = trpcImport + "\n" + layoutCode;
    }

    // 2. Wrap <body> contents with <TRPCReactProvider>
    // Matches: <body ...>  ...anything...  </body>
    // Detect indentation used inside <body> (look at first non-empty line)
    layoutCode = layoutCode.replace(
      /(<body[^>]*>)([\s\S]*?)(<\/body>)/,
      (_, open, inner, close) => {
        const firstLine = inner.split("\n").find((l) => l.trim());
        const baseIndent = firstLine ? firstLine.match(/^(\s*)/)[1] : "          ";
        const trimmedInner = inner.replace(/\s+$/, "\n");
        const indented = trimmedInner
          .split("\n")
          .map((line) => (line.trim() ? "  " + line : line))
          .join("\n");
        return `${open}\n${baseIndent}<TRPCReactProvider>${indented}${baseIndent}</TRPCReactProvider>\n        ${close}`;
      }
    );

    fs.writeFileSync(path.join(cwd, layoutPath), layoutCode, "utf-8");
    console.log(c.green(`  ✔  Import added`));
    console.log(c.green(`  ✔  <body> wrapped with <TRPCReactProvider>`));
    console.log(c.dim(`  Backup saved: ${layoutPath}.backup\n`));
  }
}

// ─── Final output ─────────────────────────────────────────────────────────────
console.log(`
${c.bold("─────────────────────────────────────────────────")}
${c.green(c.bold("  ✅  tRPC v11 setup complete!"))}
${c.bold("─────────────────────────────────────────────────")}

${c.bold("  Files created:")}
  ${c.dim(p("trpc/init.ts"))}
  ${c.dim(p("trpc/query-client.ts"))}
  ${c.dim(p("trpc/client.tsx"))}
  ${c.dim(p("trpc/server.tsx"))}
  ${c.dim(p("trpc/routers/_app.ts"))}
  ${c.dim(`${appDir}/api/trpc/[trpc]/route.ts`)}
  ${c.dim(`${appDir}/_trpc-test/`)}            ← delete after testing
  ${layoutPath ? c.dim(`${layoutPath}`) + c.green("  ← auto-patched ✔") : ""}

${c.bold("  ▶  Test it:")}
  npm run dev  →  open ${c.cyan("http://localhost:3000/_trpc-test")}

  ${c.dim("Docs → https://trpc.io/docs/client/tanstack-react-query/server-components")}
`);
