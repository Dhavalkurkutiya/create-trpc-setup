#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Auto version from package.json ───────────────────────────────────────────
const { version } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8"),
);

// ─── Colors ───────────────────────────────────────────────────────────────────
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log(`
${c.cyan(c.bold("┌──────────────────────────────────────────────┐"))}
${c.cyan(c.bold("│"))}                                              ${c.cyan(c.bold("│"))}
${c.cyan(c.bold("│"))}   ${c.bold("create-trpc-setup")} ${c.dim(`v${version}`)}                  ${c.cyan(c.bold("│"))}
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

// ─── Auto-detect ──────────────────────────────────────────────────────────────
const hasSrc = fs.existsSync(path.join(cwd, "src"));
const appDir = hasSrc ? "src/app" : "app";
const base = hasSrc ? "src" : "";
const p = (rel) => (base ? `${base}/${rel}` : rel);
const hasClerk = !!deps["@clerk/nextjs"];
const hasNextAuth = !!deps["next-auth"];

// ── FEATURE 2: Path alias detection from tsconfig.json ────────────────────────
let pathAlias = "@";
try {
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    const raw = fs
      .readFileSync(tsconfigPath, "utf-8")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const tsconfig = JSON.parse(raw);
    const paths = tsconfig?.compilerOptions?.paths ?? {};
    const aliasKey = Object.keys(paths).find((k) => k.endsWith("/*"));
    if (aliasKey) {
      pathAlias = aliasKey.replace("/*", "");
    }
  }
} catch {
  // fallback to "@"
}

function detectPM() {
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(cwd, "bun.lockb"))) return "bun";
  return "npm";
}
const pm = detectPM();

// Next.js version check
const nextVersion = deps["next"]
  ? parseInt(deps["next"].replace(/[^0-9]/, ""))
  : 14;

console.log(
  c.green("  ✔  Next.js project detected") + c.dim(` (v${nextVersion}+)`),
);
console.log(c.dim(`  Layout     : ${hasSrc ? "src/" : "root"} directory`));
console.log(c.dim(`  PM         : ${pm}`));
console.log(c.dim(`  Path alias : ${pathAlias}/*`));
if (hasClerk) console.log(c.green("  ✔  Clerk detected"));
if (hasNextAuth) console.log(c.green("  ✔  NextAuth detected"));
console.log();

// ─── Main async flow ──────────────────────────────────────────────────────────
(async () => {
  // Auto-detect — no prompts
  const useSuperJSON = false;
  const addCrudRouter = false;
  const authProvider = hasClerk ? "clerk" : hasNextAuth ? "nextauth" : "none";

  if (authProvider !== "none") {
    console.log(
      c.green(`  ✔  Auth: ${authProvider} detected — context configured\n`),
    );
  }

  // ─── Write helper ─────────────────────────────────────────────────────────────
  function write(relPath, content) {
    const full = path.join(cwd, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content.trimStart(), "utf-8");
    console.log(`  ${c.green("✔")}  ${c.dim(relPath)}`);
  }

  // ─── Install dependencies ─────────────────────────────────────────────────────
  console.log(c.bold("\n📦 Installing dependencies...\n"));

  const packages = [
    "@trpc/server@11",
    "@trpc/client@11",
    "@trpc/tanstack-react-query@11",
    "@tanstack/react-query@latest",
    "zod",
    "server-only",
    "react-error-boundary",
    ...(useSuperJSON ? ["superjson"] : []),
    // Auto-install auth package only if chosen AND not already installed
    ...(authProvider === "clerk" && !hasClerk ? ["@clerk/nextjs"] : []),
    ...(authProvider === "nextauth" && !hasNextAuth ? ["next-auth"] : []),
  ];

  const installCmd = {
    yarn: `yarn add ${packages.join(" ")}`,
    pnpm: `pnpm add ${packages.join(" ")}`,
    bun: `bun add ${packages.join(" ")}`,
    npm: `npm install ${packages.join(" ")}`,
  }[pm];

  try {
    execSync(installCmd, { stdio: "inherit", cwd });
    console.log(c.green("\n  ✔  Dependencies installed\n"));
  } catch {
    console.log(c.red("\n  ✖  Install failed. Run manually:"));
    console.log(c.dim(`     ${installCmd}\n`));
    process.exit(1);
  }

  // ─── Generate files ───────────────────────────────────────────────────────────
  console.log(c.bold("📁 Generating tRPC files...\n"));

  // ── FEATURE 3+5: trpc/init.ts — error formatter + auth comments ───────────────
  const authImport =
    authProvider === "clerk"
      ? `import { auth } from "@clerk/nextjs/server";`
      : authProvider === "nextauth"
        ? `import { getServerSession } from "next-auth";`
        : "";

  const authContext =
    authProvider === "clerk"
      ? `  const { userId } = await auth();
  return { userId, headers: opts?.headers ?? new Headers() };`
      : authProvider === "nextauth"
        ? `  const session = await getServerSession();
  return { userId: session?.user?.id ?? null, headers: opts?.headers ?? new Headers() };`
        : `  // Add your auth here, e.g.:
  // Clerk:   const { userId } = await auth(); // import from "@clerk/nextjs/server"
  // NextAuth: const session = await getServerSession();
  return { userId: null as string | null, headers: opts?.headers ?? new Headers() };`;

  const superJsonImport = useSuperJSON
    ? `import superjson from "superjson";`
    : "";
  const superJsonConfig = useSuperJSON ? `\n  transformer: superjson,` : "";

  write(
    p("trpc/init.ts"),
    `
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { ZodError } from "zod";
${superJsonImport}
${authImport}

/**
 * Context — available in every procedure via ctx.*
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = cache(async (opts?: { headers?: Headers }) => {
${authContext}
});

const t = initTRPC.context<typeof createTRPCContext>().create({${superJsonConfig}
  /**
   * FEATURE 3: Global error formatter
   * Zod validation errors are formatted into readable field errors.
   * @see https://trpc.io/docs/server/error-formatting
   */
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const createTRPCRouter    = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Public — no auth required */
export const baseProcedure = t.procedure;

/**
 * Protected — throws UNAUTHORIZED if user is not signed in.
 * Usage: protectedProcedure.query(({ ctx }) => { ctx.userId ... })
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action",
    });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
`,
  );

  // ── trpc/query-client.ts ──────────────────────────────────────────────────────
  const sjSerialize = useSuperJSON
    ? "\n        serializeData: superjson.serialize,"
    : "";
  const sjDeserialize = useSuperJSON
    ? "\n        deserializeData: superjson.deserialize,"
    : "";
  const sjImport = useSuperJSON ? `import superjson from "superjson";` : "";

  write(
    p("trpc/query-client.ts"),
    `
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
${sjImport}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000 },
      dehydrate: {${sjSerialize}
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {${sjDeserialize}
      },
    },
  });
}
`,
  );

  // ── trpc/client.tsx ───────────────────────────────────────────────────────────
  const sjClientImport = useSuperJSON
    ? `\nimport superjson from "superjson";`
    : "";
  const sjTransformerLine = useSuperJSON
    ? `\n          transformer: superjson,`
    : "";

  write(
    p("trpc/client.tsx"),
    `
"use client";
${sjClientImport}
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
  if (typeof window === "undefined") return makeQueryClient();
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
  props: Readonly<{ children: React.ReactNode }>,
) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({${sjTransformerLine}
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
`,
  );

  // ── trpc/server.tsx ───────────────────────────────────────────────────────────
  write(
    p("trpc/server.tsx"),
    `
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {
  createTRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

export const caller = appRouter.createCaller(createTRPCContext);

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
`,
  );

  // ── FEATURE 4: trpc/routers/_app.ts — Zod example + optional CRUD ─────────────
  const crudRouter = addCrudRouter
    ? `
import { z } from "zod";

// ── Example CRUD router ────────────────────────────────────────────────────
const PostSchema = z.object({
  id:    z.string(),
  title: z.string().min(1, "Title is required"),
  body:  z.string().min(1, "Body is required"),
});

// In-memory store — replace with your DB (Prisma/Drizzle)
const posts: z.infer<typeof PostSchema>[] = [
  { id: "1", title: "Hello tRPC", body: "Your setup is working!" },
];

export const postsRouter = createTRPCRouter({
  list: baseProcedure.query(() => posts),

  byId: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const post = posts.find((p) => p.id === input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      return post;
    }),

  create: baseProcedure
    .input(PostSchema.omit({ id: true }))
    .mutation(({ input }) => {
      const post = { id: Date.now().toString(), ...input };
      posts.push(post);
      return post;
    }),

  delete: baseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const idx = posts.findIndex((p) => p.id === input.id);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND" });
      posts.splice(idx, 1);
      return { success: true };
    }),
});
`
    : "";

  const crudImports = addCrudRouter
    ? `import { TRPCError } from "@trpc/server";\nimport { z } from "zod";`
    : `import { z } from "zod";`;

  const crudMerge = addCrudRouter ? `\n  posts: postsRouter,` : "";

  write(
    p("trpc/routers/_app.ts"),
    `
import { baseProcedure, createTRPCRouter } from "../init";
${crudImports}
${crudRouter}
export const appRouter = createTRPCRouter({
  /**
   * Health check — verify tRPC is working.
   * FEATURE 4: Zod input validation example below.
   */
  health: baseProcedure.query(async () => {
    return { status: "Ok", code: 200 };
  }),

  /**
   * Zod validation example:
   * Input is validated automatically — throws BAD_REQUEST if invalid.
   */
  greet: baseProcedure
    .input(z.object({ name: z.string().min(1, "Name is required") }))
    .query(({ input }) => {
      return { message: \`Hello, \${input.name}! tRPC is working.\` };
    }),
${crudMerge}
});

export type AppRouter = typeof appRouter;
`,
  );

  // ── app/api/trpc/[trpc]/route.ts ──────────────────────────────────────────────
  write(
    `${appDir}/api/trpc/[trpc]/route.ts`,
    `
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "${pathAlias}/trpc/init";
import { appRouter } from "${pathAlias}/trpc/routers/_app";
import type { NextRequest } from "next/server";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              \`❌ tRPC error on "\${path ?? "<no-path>"}": \${error.message}\`
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };
`,
  );

  // ── trpc-status/page.tsx — Tailwind styled ─────────────────────────────────────
  write(
    `${appDir}/trpc-status/page.tsx`,
    `
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HydrateClient, prefetch, trpc } from "${pathAlias}/trpc/server";
import HealthCheck from "./_health-check";

export const metadata = { title: "tRPC Health Check" };

export default function TRPCTestPage() {
  prefetch(trpc.health.queryOptions());
  prefetch(trpc.greet.queryOptions({ name: "Developer" }));

  return (
    <HydrateClient>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">tRPC Setup Check</h1>
            <p className="text-zinc-500 text-sm">
              Delete <code className="text-zinc-300">app/trpc-status/</code> after confirming ✅
            </p>
          </div>

          <ErrorBoundary
            fallback={
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm text-center">
                ❌ tRPC request failed — check your terminal for errors
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-zinc-500 text-sm text-center animate-pulse">
                  Connecting to tRPC...
                </div>
              }
            >
              <HealthCheck />
            </Suspense>
          </ErrorBoundary>

          <p className="text-center text-zinc-600 text-xs">
            <a
              href="https://trpc.io/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 underline underline-offset-2"
            >
              tRPC Docs
            </a>
            {" · "}
            <a
              href="https://github.com/Dhavalkurkutiya/create-trpc-setup"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 underline underline-offset-2"
            >
              create-trpc-setup
            </a>
          </p>

        </div>
      </main>
    </HydrateClient>
  );
}
`,
  );

  // ── trpc-status/_health-check.tsx ──────────────────────────────────────────────
  write(
    `${appDir}/trpc-status/_health-check.tsx`,
    `
"use client";

import { useTRPC } from "${pathAlias}/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function HealthCheck() {
  const trpc = useTRPC();
  const { data: health } = useSuspenseQuery(trpc.health.queryOptions());
  const { data: greet  } = useSuspenseQuery(trpc.greet.queryOptions({ name: "Developer" }));

  return (
    <div className="space-y-3">
      <Row label="Status"    value={\`✅ \${health.status}\`}  color="text-emerald-400" />
      <Row label="Code"      value={String(health.code)}    color="text-blue-400" />
      <Row label="Message"   value={greet.message}          color="text-violet-400" />
      <Row label="Transport" value="HTTP Batch Link"         color="text-zinc-400" />
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className={\`text-sm font-medium \${color}\`}>{value}</span>
    </div>
  );
}
`,
  );

  // ─── Auto-patch layout.tsx ────────────────────────────────────────────────────
  console.log(c.bold("\n🔧 Patching layout.tsx...\n"));

  const layoutCandidates = [`${appDir}/layout.tsx`, `${appDir}/layout.jsx`];
  let layoutPath = null;
  for (const candidate of layoutCandidates) {
    if (fs.existsSync(path.join(cwd, candidate))) {
      layoutPath = candidate;
      break;
    }
  }

  if (!layoutPath) {
    console.log(c.yellow("  ⚠  layout.tsx not found — skipping auto-patch."));
  } else {
    let layoutCode = fs.readFileSync(path.join(cwd, layoutPath), "utf-8");

    if (layoutCode.includes("TRPCReactProvider")) {
      console.log(
        c.yellow("  ⚠  TRPCReactProvider already in layout.tsx — skipped."),
      );
    } else {
      const trpcImport = `import { TRPCReactProvider } from "${pathAlias}/trpc/client";`;
      const importRegex = /^(import\s[\s\S]+?['"];?\s*\n)/gm;
      let lastIdx = 0,
        m;
      while ((m = importRegex.exec(layoutCode)) !== null) {
        lastIdx = m.index + m[0].length;
      }
      layoutCode =
        lastIdx > 0
          ? layoutCode.slice(0, lastIdx) +
            trpcImport +
            "\n" +
            layoutCode.slice(lastIdx)
          : trpcImport + "\n" + layoutCode;

      layoutCode = layoutCode.replace(
        /(<body[^>]*>)([\s\S]*?)(<\/body>)/,
        (_, open, inner, close) => {
          const firstLine = inner.split("\n").find((l) => l.trim());
          const baseIndent = firstLine
            ? firstLine.match(/^(\s*)/)[1]
            : "          ";
          const trimmed = inner.replace(/\s+$/, "\n");
          const indented = trimmed
            .split("\n")
            .map((l) => (l.trim() ? "  " + l : l))
            .join("\n");
          return `${open}\n${baseIndent}<TRPCReactProvider>${indented}${baseIndent}</TRPCReactProvider>\n        ${close}`;
        },
      );

      fs.writeFileSync(path.join(cwd, layoutPath), layoutCode, "utf-8");
      console.log(c.green("  ✔  Import added"));
      console.log(c.green("  ✔  <body> wrapped with <TRPCReactProvider>"));
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
${c.bold("─────────────────────────────────────────────────")}
${c.green(c.bold("  ✅  tRPC v11 setup complete!"))}
${c.bold("─────────────────────────────────────────────────")}

${c.bold("  Your config:")}
  SuperJSON      ${useSuperJSON ? c.green("✔ enabled") : c.dim("✖ disabled")}
  CRUD router    ${addCrudRouter ? c.green("✔ included") : c.dim("✖ skipped")}
  Auth           ${authProvider !== "none" ? c.green(`✔ ${authProvider}`) : c.dim("✖ none")}
  Path alias     ${c.cyan(pathAlias + "/*")}

${c.bold("  Files created:")}
  ${c.dim(p("trpc/init.ts"))}              ${c.cyan("← error formatter + protectedProcedure")}
  ${c.dim(p("trpc/query-client.ts"))}
  ${c.dim(p("trpc/client.tsx"))}
  ${c.dim(p("trpc/server.tsx"))}
  ${c.dim(p("trpc/routers/_app.ts"))}      ${c.cyan("← Zod validation example")}
  ${c.dim(`${appDir}/api/trpc/[trpc]/route.ts`)}
  ${c.dim(`${appDir}/trpc-status/`)}            ${c.cyan("← Tailwind styled test page")}
  ${layoutPath ? c.dim(layoutPath) + c.green(" ← auto-patched ✔") : ""}

${c.bold("  ▶  Test it:")}
  npm run dev  →  ${c.cyan("http://localhost:3000/trpc-status")}

  ${c.dim("Docs → https://trpc.io/docs/client/tanstack-react-query/server-components")}
`);
})();
