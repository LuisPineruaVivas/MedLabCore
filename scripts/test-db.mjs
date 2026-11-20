#!/usr/bin/env node
// Runs every SQL test suite in supabase/tests against the local Supabase database
// (`supabase start`) and prints PASS/FAIL per file. `npm run test:db`
//
// - A suite is a file that prints "... passed" (raise notice) and rolls back, so it
//   leaves no data behind. Other files there (prod_preflight, erp_reports_explain)
//   are reports and are skipped.
// - Migrations not yet applied to the local DB are prepended inside the same
//   transaction, so a suite can test a new migration before `supabase migration up`.
// - Runs with timezone America/Caracas, like the app's report dates.
//
// Options: `npm run test:db -- money_totals` runs only files whose name contains the text.
// Env: SUPABASE_DB_CONTAINER overrides the container (default supabase_db_<project_id>).

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const testsDir = join(root, "supabase", "tests");
const migrationsDir = join(root, "supabase", "migrations");

const projectId = readFileSync(join(root, "supabase", "config.toml"), "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
const container = process.env.SUPABASE_DB_CONTAINER ?? `supabase_db_${projectId}`;
const filter = process.argv[2] ?? "";

function psql(sql, extraArgs = []) {
  return spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...extraArgs], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

const applied = psql("select version from supabase_migrations.schema_migrations", ["-tA"]);
if (applied.status !== 0) {
  console.error(`Cannot reach the local database in container "${container}". Is \`supabase start\` running?`);
  console.error(applied.stderr || applied.error?.message);
  process.exit(2);
}
const appliedVersions = new Set(applied.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
const pending = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql") && !appliedVersions.has(file.split("_")[0]))
  .sort();
const pendingSql = pending.map((file) => readFileSync(join(migrationsDir, file), "utf8")).join("\n");

if (pending.length > 0) {
  console.log(`Prepending ${pending.length} migration(s) not applied locally: ${pending.join(", ")}`);
}

const suites = readdirSync(testsDir)
  .filter((file) => file.endsWith(".sql") && file.includes(filter))
  .sort()
  .filter((file) => /raise notice '[^']*passed'/i.test(readFileSync(join(testsDir, file), "utf8")));

if (suites.length === 0) {
  console.error(`No SQL suites match "${filter}".`);
  process.exit(2);
}

let failed = 0;
for (const file of suites) {
  const body = readFileSync(join(testsDir, file), "utf8");
  // The suite opens its own transaction; drop that first `begin;` so the pending
  // migrations and the suite share one transaction that the suite rolls back.
  const suiteSql = body.replace(/^begin;[ \t]*\r?$/im, "");
  const sql = ["begin;", "set local timezone = 'America/Caracas';", pendingSql, suiteSql].join("\n");
  const started = Date.now();
  const result = psql(sql);
  const output = `${result.stdout}\n${result.stderr}`;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status === 0 && /NOTICE:.*passed/i.test(output)) {
    console.log(`PASS  ${file} (${seconds}s)`);
  } else {
    failed += 1;
    const errors = output.split(/\r?\n/).filter((line) => /ERROR|CONTEXT|DETAIL/.test(line)).slice(0, 4);
    console.log(`FAIL  ${file} (${seconds}s)`);
    for (const line of errors.length > 0 ? errors : output.trim().split(/\r?\n/).slice(-4)) console.log(`      ${line}`);
  }
}

console.log(`\n${suites.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
