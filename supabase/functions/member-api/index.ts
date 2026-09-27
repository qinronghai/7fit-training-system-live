import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStaffAuthService } from "../_shared/staff-auth.mjs";
import { createMemberApi } from "./service.mjs";

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

const SESSION_COLUMNS = [
  "id", "member_id", "session_date", "status", "template_key", "template_version",
  "level_snapshot", "session_title", "focus_snapshot", "resolved_session_snapshot",
  "member_copy_text", "coach_note", "schema_version", "idempotency_key",
  "revision", "created_at", "updated_at", "completed_at",
].join(",");
const ITEM_COLUMNS = [
  "id", "session_id", "schema_version", "phase", "slot_key", "sort_order",
  "planned_action_id", "planned_action_snapshot", "performed_action_id",
  "performed_action_snapshot", "planned_prescription_snapshot", "performed_prescription",
  "sets", "reps", "load_kg", "rir", "rpe", "completed", "note",
].join(",");
const MEMBER_COLUMNS = [
  "id", "schema_version", "display_name", "status", "training_level", "primary_goal",
  "training_profile", "coach_notes", "created_at", "updated_at", "archived_at",
].join(",");

function throwOnError(error: unknown) {
  if (error) throw error;
}

function fromDbMember(row: any) {
  if (!row) return null;
  return {
    schemaVersion: row.schema_version,
    id: row.id,
    displayName: row.display_name,
    status: row.status,
    trainingLevel: row.training_level,
    primaryGoal: row.primary_goal,
    trainingProfile: row.training_profile,
    coachNotes: row.coach_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function toDbMember(member: any) {
  return {
    id: member.id,
    schema_version: member.schemaVersion,
    display_name: member.displayName,
    status: member.status,
    training_level: member.trainingLevel,
    primary_goal: member.primaryGoal,
    training_profile: member.trainingProfile,
    coach_notes: member.coachNotes,
    created_at: member.createdAt,
    updated_at: member.updatedAt,
    archived_at: member.archivedAt,
  };
}

function fromDbSession(row: any) {
  if (!row) return null;
  return {
    schemaVersion: row.schema_version,
    id: row.id,
    memberId: row.member_id,
    sessionDate: row.session_date,
    status: row.status,
    templateKey: row.template_key,
    templateVersion: row.template_version,
    levelSnapshot: row.level_snapshot,
    sessionTitle: row.session_title,
    focusSnapshot: row.focus_snapshot,
    resolvedSessionSnapshot: row.resolved_session_snapshot,
    memberCopyText: row.member_copy_text,
    coachNote: row.coach_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    idempotencyKey: row.idempotency_key,
    revision: row.revision,
  };
}

function fromDbItem(row: any) {
  return {
    schemaVersion: row.schema_version,
    id: row.id,
    sessionId: row.session_id,
    phase: row.phase,
    slotKey: row.slot_key,
    sortOrder: row.sort_order,
    plannedActionId: row.planned_action_id,
    plannedActionSnapshot: row.planned_action_snapshot,
    performedActionId: row.performed_action_id,
    performedActionSnapshot: row.performed_action_snapshot,
    plannedPrescriptionSnapshot: row.planned_prescription_snapshot,
    performedPrescription: row.performed_prescription,
    sets: row.sets,
    reps: row.reps,
    loadKg: row.load_kg,
    rir: row.rir,
    rpe: row.rpe,
    completed: row.completed,
    note: row.note,
  };
}

const repository = {
  async listMembers({ includeArchived, search, limit }: { includeArchived: boolean; search: string; limit: number }) {
    let query = supabase.from("members").select(MEMBER_COLUMNS).order("display_name", { ascending: true }).limit(limit);
    if (!includeArchived) query = query.eq("status", "ACTIVE").is("archived_at", null);
    if (search) query = query.ilike("display_name", `%${search}%`);
    const { data, error } = await query;
    throwOnError(error);
    return (data || []).map(fromDbMember);
  },

  async getMember(id: string) {
    const { data, error } = await supabase.from("members").select(MEMBER_COLUMNS).eq("id", id).maybeSingle();
    throwOnError(error);
    return fromDbMember(data);
  },

  async saveMember(member: any) {
    const { data, error } = await supabase.from("members").upsert(toDbMember(member), { onConflict: "id" }).select(MEMBER_COLUMNS).single();
    throwOnError(error);
    return fromDbMember(data);
  },

  async updateMember(id: string, patch: any) {
    const payload: Record<string, unknown> = {};
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.archivedAt !== undefined) payload.archived_at = patch.archivedAt;
    if (patch.updatedAt !== undefined) payload.updated_at = patch.updatedAt;
    const { data, error } = await supabase.from("members").update(payload).eq("id", id).select(MEMBER_COLUMNS).maybeSingle();
    throwOnError(error);
    return fromDbMember(data);
  },

  async listSessions({ memberId, status, limit, offset }: { memberId: string; status: string | null; limit: number; offset: number }) {
    let query = supabase.from("training_sessions").select(SESSION_COLUMNS)
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    throwOnError(error);
    return (data || []).map(fromDbSession);
  },

  async getSession(id: string) {
    const { data, error } = await supabase.from("training_sessions")
      .select(`${SESSION_COLUMNS},items:training_session_items(${ITEM_COLUMNS})`)
      .eq("id", id)
      .order("sort_order", { referencedTable: "training_session_items", ascending: true })
      .maybeSingle();
    throwOnError(error);
    if (!data) return null;
    return { session: fromDbSession(data), items: (data.items || []).map(fromDbItem) };
  },

  async getCompletedSessionsForContext(memberId: string, limit: number) {
    const contextColumns = ["id", "member_id", "session_date", "status", "template_key", "session_title", "completed_at"].join(",");
    const contextItemColumns = ["id", "session_id", "phase", "sort_order", "planned_action_id", "planned_action_snapshot", "performed_action_id", "performed_action_snapshot", "completed"].join(",");
    const { data, error } = await supabase.from("training_sessions")
      .select(`${contextColumns},items:training_session_items(${contextItemColumns})`)
      .eq("member_id", memberId)
      .eq("status", "COMPLETED")
      .order("session_date", { ascending: false })
      .order("sort_order", { referencedTable: "training_session_items", ascending: true })
      .limit(limit);
    throwOnError(error);
    return (data || []).map((row: any) => ({
      id: row.id,
      memberId: row.member_id,
      sessionDate: row.session_date,
      status: row.status,
      templateKey: row.template_key,
      sessionTitle: row.session_title,
      completedAt: row.completed_at,
      items: (row.items || []).map((item: any) => ({
        id: item.id,
        sessionId: item.session_id,
        phase: item.phase,
        sortOrder: item.sort_order,
        plannedActionId: item.planned_action_id,
        plannedActionSnapshot: item.planned_action_snapshot,
        performedActionId: item.performed_action_id,
        performedActionSnapshot: item.performed_action_snapshot,
        completed: item.completed,
      })),
    }));
  },

  async savePlannedSession(snapshot: unknown) {
    const { data, error } = await supabase.rpc("member_save_planned_session", { p_snapshot: snapshot });
    throwOnError(error);
    return data;
  },

  async updateSession(id: string, expectedRevision: number, patch: any, updatedAt: string) {
    const payload: Record<string, unknown> = { revision: expectedRevision + 1, updated_at: updatedAt };
    if (patch.sessionDate !== undefined) payload.session_date = patch.sessionDate;
    if (patch.coachNote !== undefined) payload.coach_note = patch.coachNote;
    if (patch.memberCopyText !== undefined) payload.member_copy_text = patch.memberCopyText;
    const { data, error } = await supabase.from("training_sessions").update(payload)
      .eq("id", id).eq("revision", expectedRevision).eq("status", "PLANNED")
      .select(SESSION_COLUMNS).maybeSingle();
    throwOnError(error);
    return fromDbSession(data);
  },

  async completeSession({ sessionId, expectedRevision, completedAt, items }: { sessionId: string; expectedRevision: number; completedAt: string; items: unknown[] }) {
    const { data, error } = await supabase.rpc("member_complete_training_session", {
      p_session_id: sessionId,
      p_expected_revision: expectedRevision,
      p_completed_at: completedAt,
      p_performed_items: items,
    });
    throwOnError(error);
    return data;
  },

  async cancelSession({ sessionId, expectedRevision }: { sessionId: string; expectedRevision: number }) {
    const { data, error } = await supabase.rpc("member_cancel_training_session", {
      p_session_id: sessionId,
      p_expected_revision: expectedRevision,
    });
    throwOnError(error);
    return data;
  },
};

async function createSessionStore() {
  return {
    async insert(record: Record<string, unknown>) {
      const { error } = await supabase.from("case_admin_sessions").insert(record);
      throwOnError(error);
    },
    async findByHash(tokenHash: string) {
      const { data, error } = await supabase.from("case_admin_sessions")
        .select("token_hash, created_at, expires_at, revoked_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      throwOnError(error);
      return data;
    },
    async revokeByHash(tokenHash: string, revokedAt: string) {
      const { error } = await supabase.from("case_admin_sessions")
        .update({ revoked_at: revokedAt })
        .eq("token_hash", tokenHash)
        .is("revoked_at", null);
      throwOnError(error);
    },
  };
}

const staffAuth = createStaffAuthService({
  expectedPinHash: "",
  store: await createSessionStore(),
});

Deno.serve(createMemberApi({ auth: staffAuth, repository }));
