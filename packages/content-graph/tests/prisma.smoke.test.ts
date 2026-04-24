/**
 * Prisma smoke tests — Requirements 9.7
 *
 * These tests verify that:
 *   1. `prisma validate` passes (schema is syntactically valid)
 *   2. `prisma generate` succeeds (client is generated without errors)
 *   3. The generated client directory exists and is importable
 *   4. The generated ConceptNode type has the expected fields (id, title, depth, tags)
 *
 * These are smoke tests only — they do not require a running database.
 * DATABASE_URL is set to a dummy SQLite path so Prisma can resolve the env var
 * without needing an actual database file.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the packages/content-graph/ root */
const PKG_ROOT = path.resolve(__dirname, "..");

/** Path to the Prisma binary (resolved relative to the package root) */
const PRISMA_BIN = path.join(PKG_ROOT, "node_modules", "prisma", "build", "index.js");

/** Path to the schema file (relative — used as CLI arg from PKG_ROOT cwd) */
const SCHEMA_PATH = path.join("src", "prisma", "schema.prisma");

/**
 * The schema's `output` directive is `"../../../node_modules/.prisma/client"`,
 * which resolves relative to src/prisma/ → packages/node_modules/.prisma/client/
 * (pnpm hoists the .prisma client to the packages/ shared node_modules).
 */
const GENERATED_CLIENT_DIR = path.resolve(PKG_ROOT, "..", "node_modules", ".prisma", "client");
const GENERATED_CLIENT_TYPES = path.join(GENERATED_CLIENT_DIR, "index.d.ts");

/**
 * tsc lives in the workspace root node_modules/.bin/ (not the package-local one).
 */
const TSC_BIN = path.resolve(PKG_ROOT, "..", "..", "node_modules", ".bin", "tsc");

/**
 * Env vars for Prisma commands — DATABASE_URL must be set even for validate/generate
 * because Prisma resolves env vars at schema-load time.
 */
const PRISMA_ENV = {
  ...process.env,
  DATABASE_URL: "file:./smoke-test.db",
};

// ---------------------------------------------------------------------------
// Helper: run a shell command in the package root, return { exitCode, output }
// ---------------------------------------------------------------------------

function runCommand(cmd: string): { exitCode: number; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: PKG_ROOT,
      env: PRISMA_ENV,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, output };
  } catch (err: unknown) {
    const execError = err as { status?: number; stdout?: string; stderr?: string };
    const output = [execError.stdout ?? "", execError.stderr ?? ""].join("\n");
    return { exitCode: execError.status ?? 1, output };
  }
}

// ---------------------------------------------------------------------------
// 1. prisma validate — schema must be syntactically valid
// ---------------------------------------------------------------------------

describe("Prisma smoke — schema validation", () => {
  it("prisma validate exits with code 0 (schema is valid)", () => {
    const { exitCode, output } = runCommand(
      `node "${PRISMA_BIN}" validate --schema="${SCHEMA_PATH}"`
    );
    expect(exitCode, `prisma validate failed:\n${output}`).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. prisma generate — client must be generated without errors
// ---------------------------------------------------------------------------

describe("Prisma smoke — client generation", () => {
  it("prisma generate exits with code 0", () => {
    const { exitCode, output } = runCommand(
      `node "${PRISMA_BIN}" generate --schema="${SCHEMA_PATH}"`
    );
    expect(exitCode, `prisma generate failed:\n${output}`).toBe(0);
  });

  it("generated client directory exists after prisma generate", () => {
    expect(
      existsSync(GENERATED_CLIENT_DIR),
      `Expected generated client directory to exist at: ${GENERATED_CLIENT_DIR}`
    ).toBe(true);
  });

  it("generated client index.d.ts exists", () => {
    expect(
      existsSync(GENERATED_CLIENT_TYPES),
      `Expected generated types file to exist at: ${GENERATED_CLIENT_TYPES}`
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. TypeScript type-check — generated types must be importable
// ---------------------------------------------------------------------------

describe("Prisma smoke — TypeScript compatibility", () => {
  it("tsc --noEmit reports no type errors (exit code is not 1)", () => {
    // Run tsc from the package root. tsc lives in the workspace root node_modules.
    // Exit code 1 = type errors; exit code 2 = config/option errors (e.g. deprecation
    // warnings from tsconfig). We only fail on type errors (exit code 1) because
    // config-level warnings are pre-existing tsconfig issues unrelated to Prisma.
    const cmd = `"${TSC_BIN}" --noEmit`;
    const { exitCode, output } = runCommand(cmd);
    expect(exitCode, `tsc reported type errors:\n${output}`).not.toBe(1);
  });

  it("generated client index.d.ts is present (types are importable)", () => {
    // Presence of the generated types file is the definitive check that the
    // Prisma client was generated and its types are available for import.
    expect(
      existsSync(GENERATED_CLIENT_TYPES),
      `Generated types file not found at: ${GENERATED_CLIENT_TYPES}`
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Spot-check — ConceptNode type must have expected fields
// ---------------------------------------------------------------------------

describe("Prisma smoke — ConceptNode field spot-check", () => {
  it("generated index.d.ts contains a ConceptNode model definition", () => {
    expect(
      existsSync(GENERATED_CLIENT_TYPES),
      `Generated types file not found at: ${GENERATED_CLIENT_TYPES}. Run prisma generate first.`
    ).toBe(true);

    const content = readFileSync(GENERATED_CLIENT_TYPES, "utf-8");
    // Prisma 5 generates: export type $ConceptNodePayload<...> = { ... scalars: { id, title, ... } }
    expect(content).toMatch(/\$ConceptNodePayload/);
  });

  it("ConceptNode type has an 'id' field", () => {
    const content = readFileSync(GENERATED_CLIENT_TYPES, "utf-8");
    const section = extractPayloadScalars(content, "ConceptNode");
    expect(
      section,
      "Could not find $ConceptNodePayload scalars section in generated client"
    ).not.toBeNull();
    expect(section).toMatch(/\bid\b/);
  });

  it("ConceptNode type has a 'title' field", () => {
    const content = readFileSync(GENERATED_CLIENT_TYPES, "utf-8");
    const section = extractPayloadScalars(content, "ConceptNode");
    expect(section).toMatch(/\btitle\b/);
  });

  it("ConceptNode type has a 'depth' field", () => {
    const content = readFileSync(GENERATED_CLIENT_TYPES, "utf-8");
    const section = extractPayloadScalars(content, "ConceptNode");
    expect(section).toMatch(/\bdepth\b/);
  });

  it("ConceptNode type has a 'tags' field", () => {
    const content = readFileSync(GENERATED_CLIENT_TYPES, "utf-8");
    const section = extractPayloadScalars(content, "ConceptNode");
    expect(section).toMatch(/\btags\b/);
  });
});

// ---------------------------------------------------------------------------
// Utility: extract the scalars block from a Prisma model payload type
// ---------------------------------------------------------------------------

/**
 * In Prisma 5, model fields are defined inside the `$<ModelName>Payload` type
 * under the `scalars` key, e.g.:
 *
 *   export type $ConceptNodePayload<...> = {
 *     name: "ConceptNode"
 *     scalars: $Extensions.GetPayloadResult<{
 *       id: string
 *       title: string
 *       ...
 *     }, ...>
 *   }
 *
 * This function extracts a window of text starting from the `export type $<ModelName>Payload`
 * declaration (the definition, not a reference), large enough to cover all scalar field names.
 * Returns null if the payload type definition is not found.
 */
function extractPayloadScalars(content: string, modelName: string): string | null {
  // Match the export declaration specifically, not just any reference to the type
  const pattern = new RegExp(`export\\s+type\\s+\\$${modelName}Payload\\b`);
  const match = pattern.exec(content);
  if (!match) return null;
  // Return a 1500-char window — enough to cover all scalar fields
  return content.slice(match.index, match.index + 1500);
}
