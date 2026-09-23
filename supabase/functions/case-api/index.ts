import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createAdminAuthService,
} from "./auth.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const legacyServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const secretKeyMapRaw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
let serverKey = legacyServiceRole;
if (!serverKey && secretKeyMapRaw) {
  try {
    const secretKeys = JSON.parse(secretKeyMapRaw);
    serverKey = secretKeys?.default || Object.values(secretKeys || {})[0] || "";
  } catch (_) {}
}
if (!serverKey) throw new Error("Supabase server key is unavailable");

const supabase = createClient(SUPABASE_URL, serverKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PIN_HASH = Deno.env.get("CASE_ADMIN_PIN_SHA256") || "";
const BUCKET = "case-media";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const allowedKinds = new Set(["comparison_front", "comparison_side", "comparison_back", "process", "chat"]);
const loginAttempts = new Map<string, { count: number; windowStartedAt: number; lockedUntil: number }>();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-file-name",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function canAttemptLogin(ip: string, now = Date.now()) {
  const state = loginAttempts.get(ip);
  if (!state) return true;
  if (state.lockedUntil > now) return false;
  if (now - state.windowStartedAt >= LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  return true;
}

function noteLoginFailure(ip: string, now = Date.now()) {
  const current = loginAttempts.get(ip);
  const state = !current || now - current.windowStartedAt >= LOGIN_WINDOW_MS
    ? { count: 0, windowStartedAt: now, lockedUntil: 0 }
    : current;
  state.count += 1;
  if (state.count >= LOGIN_FAILURE_LIMIT) state.lockedUntil = now + LOGIN_LOCK_MS;
  loginAttempts.set(ip, state);
}

function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

async function sessionStore() {
  return {
    async insert(record: Record<string, unknown>) {
      const { error } = await supabase.from("case_admin_sessions").insert(record);
      if (error) throw error;
    },
    async findByHash(tokenHash: string) {
      const { data, error } = await supabase
        .from("case_admin_sessions")
        .select("token_hash, created_at, expires_at, revoked_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async revokeByHash(tokenHash: string, revokedAt: string) {
      const { error } = await supabase
        .from("case_admin_sessions")
        .update({ revoked_at: revokedAt })
        .eq("token_hash", tokenHash)
        .is("revoked_at", null);
      if (error) throw error;
    },
  };
}

const adminAuth = createAdminAuthService({
  expectedPinHash: PIN_HASH,
  store: await sessionStore(),
  ttlSeconds: SESSION_TTL_SECONDS,
});

async function isAdmin(req: Request) {
  return (await adminAuth.verify(req.headers.get("authorization"))).ok;
}

async function withSignedAssets(rows: any[]) {
  return Promise.all(rows.map(async (c) => {
    const assets = c.case_assets || [];
    const signed = await Promise.all(assets.map(async (a: any) => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 60 * 60 * 12);
      return { ...a, url: error ? "" : (data?.signedUrl || "") };
    }));
    return { ...c, case_assets: signed };
  }));
}

async function fetchCases(publishedOnly: boolean) {
  let q = supabase.from("cases")
    .select("id,display_name,category,height_cm,start_weight_kg,age,cover_view,process_text,metrics,status,created_at,updated_at,case_assets(id,kind,storage_path,sort_order,created_at)")
    .order("created_at", { ascending: false });
  if (publishedOnly) q = q.eq("status", "published");
  const { data, error } = await q;
  if (error) throw error;
  return withSignedAssets(data || []);
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "image.jpg";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    if (req.method === "GET" && action === "health") {
      const { error } = await supabase.from("cases").select("id").limit(1);
      if (error) throw error;
      return json({ ok: true, database: "ok", storage_bucket: BUCKET });
    }
    if (req.method === "GET" && action === "list") {
      return json({ cases: await fetchCases(true) });
    }
    if (req.method === "POST" && action === "admin-login") {
      if (!PIN_HASH) return json({ error: "admin_pin_not_configured" }, 503);
      const ip = clientIp(req);
      if (!canAttemptLogin(ip)) return json({ error: "too_many_attempts" }, 429);
      const body = await req.json().catch(() => ({}));
      const result = await adminAuth.login(String(body.pin || ""));
      if (result.status !== 200) {
        noteLoginFailure(ip);
        return json({ error: "invalid_pin" }, 401);
      }
      clearLoginFailures(ip);
      return json(result.body);
    }
    if (req.method === "GET" && action === "admin-session") {
      const verified = await adminAuth.verify(req.headers.get("authorization"));
      if (!verified.ok) return json({ error: "unauthorized" }, 401);
      return json({ ok: true, expiresAt: verified.record.expires_at });
    }
    if (req.method === "POST" && action === "admin-logout") {
      return json((await adminAuth.logout(req.headers.get("authorization"))).body);
    }
    if (req.method === "GET" && action === "admin-list") {
      if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);
      return json({ cases: await fetchCases(false) });
    }

    if (!(await isAdmin(req))) return json({ error: "unauthorized" }, 401);

    if (req.method === "POST" && action === "save-case") {
      const body = await req.json();
      const payload: any = {
        display_name: String(body.display_name || "").trim(),
        category: body.category,
        height_cm: body.height_cm === "" || body.height_cm == null ? null : Number(body.height_cm),
        start_weight_kg: body.start_weight_kg === "" || body.start_weight_kg == null ? null : Number(body.start_weight_kg),
        age: body.age === "" || body.age == null ? null : Number(body.age),
        cover_view: body.cover_view || null,
        process_text: String(body.process_text || ""),
        metrics: Array.isArray(body.metrics) ? body.metrics : [],
        status: body.status === "draft" ? "draft" : "published",
      };
      if (!payload.display_name) return json({ error: "display_name_required" }, 400);
      if (!["减脂塑形", "体态调整", "疼痛处理"].includes(payload.category)) return json({ error: "invalid_category" }, 400);

      let result;
      if (body.id) {
        result = await supabase.from("cases").update(payload).eq("id", body.id).select().single();
      } else {
        result = await supabase.from("cases").insert(payload).select().single();
      }
      if (result.error) throw result.error;
      return json({ case: result.data });
    }

    if (req.method === "POST" && action === "upload") {
      const caseId = url.searchParams.get("case_id") || "";
      const kind = url.searchParams.get("kind") || "";
      const replace = url.searchParams.get("replace") === "1";
      if (!caseId || !allowedKinds.has(kind)) return json({ error: "invalid_upload_target" }, 400);
      const type = req.headers.get("content-type") || "application/octet-stream";
      if (!type.startsWith("image/")) return json({ error: "image_only" }, 400);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength) return json({ error: "empty_file" }, 400);
      if (buf.byteLength > 15728640) return json({ error: "file_too_large" }, 413);
      const incoming = safeName(req.headers.get("x-file-name") || "image.jpg");

      if (replace && kind.startsWith("comparison_")) {
        const { data: old } = await supabase.from("case_assets").select("id,storage_path").eq("case_id", caseId).eq("kind", kind);
        if (old?.length) {
          await supabase.storage.from(BUCKET).remove(old.map((x: any) => x.storage_path));
          await supabase.from("case_assets").delete().in("id", old.map((x: any) => x.id));
        }
      }

      const path = `${caseId}/${kind}/${crypto.randomUUID()}-${incoming}`;
      const upload = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: false });
      if (upload.error) throw upload.error;
      const nextOrderRes = await supabase.from("case_assets").select("sort_order").eq("case_id", caseId).eq("kind", kind).order("sort_order", { ascending: false }).limit(1);
      const sortOrder = ((nextOrderRes.data?.[0]?.sort_order) ?? -1) + 1;
      const asset = await supabase.from("case_assets").insert({ case_id: caseId, kind, storage_path: path, sort_order: sortOrder }).select().single();
      if (asset.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw asset.error;
      }
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 12);
      return json({ asset: { ...asset.data, url: signed.data?.signedUrl || "" } });
    }

    if (req.method === "DELETE" && action === "asset") {
      const assetId = url.searchParams.get("id") || "";
      const { data: asset, error } = await supabase.from("case_assets").select("id,storage_path").eq("id", assetId).single();
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([asset.storage_path]);
      await supabase.from("case_assets").delete().eq("id", assetId);
      return json({ ok: true });
    }

    if (req.method === "DELETE" && action === "case") {
      const caseId = url.searchParams.get("id") || "";
      const { data: assets } = await supabase.from("case_assets").select("storage_path").eq("case_id", caseId);
      if (assets?.length) await supabase.storage.from(BUCKET).remove(assets.map((x: any) => x.storage_path));
      const del = await supabase.from("cases").delete().eq("id", caseId);
      if (del.error) throw del.error;
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
