/**
 * Release preflight — "is this build actually safe to publish / is the
 * published build actually the shared app?"  Executable, read-only, no secrets.
 *
 *   npm run preflight -- --local              # inspect .output/public after `vite build`
 *   npm run preflight -- --live               # inspect the published site (PRODUCTION_URL)
 *   npm run preflight -- --live <url>         # inspect another served build
 *   npm run preflight -- --env                # inspect the local .env before building
 *
 * Options: --expect-sha <short sha>  (default: HEAD for --local/--env, origin/main for --live)
 *          --expect-ref <supabase ref> (default: production ref)
 *          --allow-demo                (a deliberate demo build is acceptable)
 *          --json                      (machine-readable output)
 *
 * Exit code 0 = every check PASS (WARN allowed); 1 = at least one FAIL.
 *
 * Why this exists (DEC-024, 2026-09-18): the published couple app had been
 * built with no Supabase configuration and ran silently in demo mode. Every
 * check below would have failed on that build. The build now emits
 * `build-info.json` (vite.config.ts) and the app refuses to run a shared build
 * without cloud config (RuntimeGate); this script verifies both from outside.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { loadEnv } from "vite";
import { PRODUCTION_SUPABASE_REF, PRODUCTION_URL } from "./release-config";

type Status = "PASS" | "FAIL" | "WARN" | "MANUAL";
interface Check {
  id: string;
  status: Status;
  detail: string;
}

interface Manifest {
  sha?: string;
  builtAt?: string;
  mode?: string;
  target?: string;
  targetExplicit?: boolean;
  supabaseHost?: string;
  productionBuild?: boolean;
  hermetic?: boolean;
  misconfigured?: boolean;
}

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
function flag(name: string): boolean {
  return argv.includes(name);
}
function option(name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

const modeLocal = flag("--local");
const modeEnv = flag("--env");
const modeLive = flag("--live");
if (!modeLocal && !modeEnv && !modeLive) {
  console.error(
    "usage: release-preflight --local | --live [url] | --env  [--expect-sha x] [--expect-ref r] [--allow-demo] [--json]",
  );
  process.exit(2);
}
const allowDemo = flag("--allow-demo");
const json = flag("--json");
const expectRef = option("--expect-ref") ?? PRODUCTION_SUPABASE_REF;
const expectHost = `${expectRef}.supabase.co`;
const liveUrl = (modeLive ? (option("--live") ?? PRODUCTION_URL) : "").replace(/\/+$/, "");

function gitShort(ref: string): string | undefined {
  try {
    return execSync(`git rev-parse --short ${ref}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}
const expectSha = option("--expect-sha") ?? (modeLive ? gitShort("origin/main") : gitShort("HEAD"));

const checks: Check[] = [];
function add(id: string, status: Status, detail: string) {
  checks.push({ id, status, detail });
}

// ---------------------------------------------------------------- helpers
function decodeJwtRole(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    const jsonText = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const parsed = JSON.parse(jsonText) as { role?: string };
    return parsed.role;
  } catch {
    return undefined;
  }
}

/** Secret-shaped strings that must never appear in a browser bundle. */
function scanForSecrets(text: string, where: string) {
  const problems: string[] = [];
  if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(text)) problems.push("sb_secret_ key");
  const jwts =
    text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? [];
  const roles = new Set(jwts.map(decodeJwtRole).filter(Boolean) as string[]);
  if (roles.has("service_role")) problems.push("service_role JWT");
  if (problems.length) add(`secrets:${where}`, "FAIL", `found ${problems.join(", ")}`);
  else
    add(
      `secrets:${where}`,
      "PASS",
      `no service_role / sb_secret material` +
        (roles.size ? ` (jwt roles: ${[...roles].join(",")})` : ""),
    );
}

function checkManifest(m: Manifest | undefined, source: string) {
  if (!m || typeof m.sha !== "string") {
    add(
      "manifest",
      "FAIL",
      `${source}: build-info.json missing or invalid — build predates the identity manifest (pre-M1) or is not this app`,
    );
    return;
  }
  add(
    "manifest",
    "PASS",
    `${source}: sha=${m.sha} builtAt=${m.builtAt} mode=${m.mode} target=${m.target}`,
  );

  if (expectSha) {
    if (m.sha === expectSha) add("sha", "PASS", `build sha ${m.sha} matches expected ${expectSha}`);
    else add("sha", "FAIL", `build sha ${m.sha} ≠ expected ${expectSha}`);
  } else add("sha", "WARN", `no expected sha available (no git?) — build sha is ${m.sha}`);

  if (m.mode === "cloud") add("mode", "PASS", "cloud mode (Supabase configured at build time)");
  else if (allowDemo && m.target === "demo")
    add("mode", "WARN", "deliberate demo build (allowed by --allow-demo)");
  else add("mode", "FAIL", `mode=${m.mode} target=${m.target} — NOT a connected shared build`);

  if (m.target === "shared") add("target", "PASS", `target=shared (explicit=${m.targetExplicit})`);
  else if (allowDemo) add("target", "WARN", `target=${m.target}`);
  else add("target", "FAIL", `target=${m.target} — the couple app must be built as target=shared`);

  if (m.misconfigured === false) add("misconfigured", "PASS", "manifest.misconfigured=false");
  else
    add(
      "misconfigured",
      "FAIL",
      "manifest.misconfigured=true — RuntimeGate would block this build",
    );

  if (m.mode === "cloud") {
    if (m.supabaseHost === expectHost)
      add("supabase-host", "PASS", `compiled against ${m.supabaseHost}`);
    else
      add("supabase-host", "FAIL", `compiled against "${m.supabaseHost}", expected ${expectHost}`);
  }
}

function checkHtml(html: string, where: string) {
  if (/data-runtime-mode="misconfigured"/.test(html))
    add(
      `html:${where}`,
      "FAIL",
      "server-rendered page is the RuntimeGate block page (misconfigured)",
    );
  else if (/גרסת הדגמה/.test(html) && !allowDemo)
    add(`html:${where}`, "FAIL", 'page title says "גרסת הדגמה" — demo build');
  else add(`html:${where}`, "PASS", "no misconfiguration / demo markers in the served HTML");
}

function checkBundleHost(js: string, where: string, mode: string | undefined) {
  if (mode !== "cloud") return;
  if (js.includes(expectHost)) add(`bundle-host:${where}`, "PASS", `bundle contains ${expectHost}`);
  else add(`bundle-host:${where}`, "FAIL", `bundle does not contain ${expectHost}`);
}

async function checkSupabaseReachable(host: string) {
  try {
    const res = await fetch(`https://${host}/rest/v1/`, { method: "GET" });
    // Without an apikey PostgREST answers 401 — that already proves the project exists.
    if (res.status === 401 || res.status === 200)
      add("supabase-reachable", "PASS", `https://${host}/rest/v1/ → HTTP ${res.status}`);
    else add("supabase-reachable", "WARN", `https://${host}/rest/v1/ → HTTP ${res.status}`);
  } catch (err) {
    add("supabase-reachable", "FAIL", `https://${host} unreachable: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------- modes
async function runEnv() {
  const env = loadEnv("production", process.cwd(), "VITE_");
  const url = (env.VITE_SUPABASE_URL ?? "").trim();
  const key = (env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  const target = (env.VITE_RUNTIME_TARGET ?? "").trim();
  let host = "";
  try {
    host = url ? new URL(url).host : "";
  } catch {
    host = "";
  }
  if (!url) add("env:url", allowDemo ? "WARN" : "FAIL", "VITE_SUPABASE_URL is empty");
  else if (host === expectHost) add("env:url", "PASS", `VITE_SUPABASE_URL → ${host}`);
  else add("env:url", "FAIL", `VITE_SUPABASE_URL → "${host}", expected ${expectHost}`);
  if (!key) add("env:key", allowDemo ? "WARN" : "FAIL", "VITE_SUPABASE_ANON_KEY is empty");
  else {
    const role = key.startsWith("eyJ")
      ? decodeJwtRole(key)
      : key.startsWith("sb_publishable_")
        ? "publishable"
        : undefined;
    if (role === "service_role" || key.startsWith("sb_secret_"))
      add(
        "env:key",
        "FAIL",
        "VITE_SUPABASE_ANON_KEY holds a SERVICE ROLE / secret key — never ship this",
      );
    else add("env:key", "PASS", `VITE_SUPABASE_ANON_KEY present (${role ?? "unrecognised shape"})`);
  }
  if (!target || target === "shared")
    add("env:target", "PASS", `VITE_RUNTIME_TARGET=${target || "(unset → shared)"}`);
  else add("env:target", allowDemo ? "WARN" : "FAIL", `VITE_RUNTIME_TARGET=${target}`);
  if (host) await checkSupabaseReachable(host);
}

async function runLocal() {
  const dir = join(process.cwd(), ".output", "public");
  const manifestPath = join(dir, "build-info.json");
  if (!existsSync(manifestPath)) {
    add("manifest", "FAIL", `${manifestPath} not found — run \`vite build\` first`);
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  checkManifest(manifest, ".output/public");
  const assets = join(dir, "assets");
  const jsFiles = existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith(".js")) : [];
  const js = jsFiles.map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
  add(
    "assets",
    jsFiles.length ? "PASS" : "FAIL",
    `${jsFiles.length} js chunks in .output/public/assets`,
  );
  checkBundleHost(js, "local", manifest.mode);
  scanForSecrets(js, "local");
  if (manifest.mode === "cloud" && manifest.supabaseHost)
    await checkSupabaseReachable(manifest.supabaseHost);
}

async function runLive() {
  const get = async (path: string) => {
    const res = await fetch(`${liveUrl}${path}`, { redirect: "follow" });
    return { res, text: await res.text() };
  };
  const home = await get("/");
  add("live:home", home.res.ok ? "PASS" : "FAIL", `${liveUrl}/ → HTTP ${home.res.status}`);
  const deploymentId = home.res.headers.get("x-deployment-id");
  if (deploymentId) add("live:deployment-id", "PASS", `x-deployment-id ${deploymentId}`);
  if (!home.res.ok) return;
  checkHtml(home.text, "live");

  const m = await get("/build-info.json");
  let manifest: Manifest | undefined;
  if (m.res.ok && m.res.headers.get("content-type")?.includes("json")) {
    try {
      manifest = JSON.parse(m.text) as Manifest;
    } catch {
      manifest = undefined;
    }
  }
  checkManifest(manifest, liveUrl);

  const chunkPaths = [...new Set(home.text.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) ?? [])];
  let js = "";
  for (const p of chunkPaths) js += (await get(p)).text + "\n";
  add(
    "live:assets",
    chunkPaths.length ? "PASS" : "FAIL",
    `${chunkPaths.length} js chunks referenced by the page`,
  );
  checkBundleHost(js, "live", manifest?.mode);
  scanForSecrets(js, "live");
  if (manifest?.mode === "cloud" && manifest.supabaseHost)
    await checkSupabaseReachable(manifest.supabaseHost);
}

// ---------------------------------------------------------------- main
(async () => {
  if (modeEnv) await runEnv();
  if (modeLocal) await runLocal();
  if (modeLive) await runLive();

  add(
    "db:grants+ledger",
    "MANUAL",
    "run supabase/verify_privileges.sql in the Dashboard (needs the owner's Supabase access; see supabase/DEPLOY.md)",
  );

  const failed = checks.filter((c) => c.status === "FAIL");
  if (json) {
    console.log(JSON.stringify({ ok: failed.length === 0, expectSha, expectRef, checks }, null, 2));
  } else {
    const width = Math.max(...checks.map((c) => c.id.length));
    for (const c of checks) console.log(`${c.status.padEnd(6)} ${c.id.padEnd(width)}  ${c.detail}`);
    console.log("");
    console.log(
      failed.length === 0
        ? `PREFLIGHT PASS — ${checks.length} checks (${checks.filter((c) => c.status === "WARN").length} warnings)`
        : `PREFLIGHT FAIL — ${failed.length} failing check(s): ${failed.map((c) => c.id).join(", ")}`,
    );
  }
  process.exit(failed.length === 0 ? 0 : 1);
})();
