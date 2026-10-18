import { fail } from "@sveltejs/kit";
import { isUuid, parsePortalAccessMode, parseUserAccessStatus } from "$lib/admin-access";
import {
  AccessChangeError,
  findAccountByLogin,
  listZapUsers,
  requireZapAdmin,
  setPortalAccessMode,
  setUserAccessStatus,
  setUserAdmin,
} from "$lib/server/admin/access";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const admin = requireZapAdmin(locals);
  const mode = locals.zapAccess!.mode;
  return { mode, users: await listZapUsers(mode), currentUserId: admin.id };
};

function accessFailure(err: unknown) {
  if (err instanceof AccessChangeError) return fail(err.status, { error: err.message });
  throw err;
}

export const actions: Actions = {
  setMode: async ({ locals, request }) => {
    const admin = requireZapAdmin(locals);
    const form = await request.formData();
    const mode = parsePortalAccessMode(String(form.get("mode") ?? ""));
    await setPortalAccessMode(mode, admin.id);
    return { ok: mode === "allowlist" ? "Zap is now invite-only (allowlist)." : "Zap is open to every signed-in account that isn't blocked." };
  },

  setStatus: async ({ locals, request }) => {
    const admin = requireZapAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId") ?? "");
    const status = parseUserAccessStatus(String(form.get("status") ?? ""));
    if (!isUuid(userId) || !status) return fail(400, { error: "Pick a user and status." });
    try {
      const sessions = await setUserAccessStatus(admin.id, userId, status);
      const extra =
        sessions && (sessions.endedSessions || sessions.leftSessions)
          ? ` Ended ${sessions.endedSessions} hosted session(s), left ${sessions.leftSessions}.`
          : "";
      return { ok: `Access updated.${extra}` };
    } catch (err) {
      return accessFailure(err);
    }
  },

  setAdmin: async ({ locals, request }) => {
    const admin = requireZapAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId") ?? "");
    const isAdmin = String(form.get("isAdmin") ?? "") === "true";
    if (!isUuid(userId)) return fail(400, { error: "Pick a user." });
    try {
      await setUserAdmin(admin.id, userId, isAdmin);
      return { ok: isAdmin ? "Admin granted." : "Admin removed." };
    } catch (err) {
      return accessFailure(err);
    }
  },

  addUser: async ({ locals, request }) => {
    const admin = requireZapAdmin(locals);
    const form = await request.formData();
    const login = String(form.get("login") ?? "").trim();
    const status = parseUserAccessStatus(String(form.get("status") ?? "allowed")) ?? "allowed";
    if (!login) return fail(400, { error: "Enter an email or username.", login });
    const account = await findAccountByLogin(login);
    if (!account) return fail(404, { error: `No Pocket Dimension account matches "${login}".`, login });
    try {
      await setUserAccessStatus(admin.id, account.id, status);
      return { ok: `${account.username ?? account.email} set to ${status}.` };
    } catch (err) {
      return accessFailure(err);
    }
  },
};
