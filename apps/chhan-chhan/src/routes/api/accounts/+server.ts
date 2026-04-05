import { json } from "@sveltejs/kit";
import { createAccount, listAccountsForUser } from "$lib/server/finance";
import { requireUser } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { createAccountSchema } from "$lib/validation/finance";

export async function GET({ locals }) {
  const user = requireUser(locals);
  const accounts = await listAccountsForUser(user.id);
  return json({ accounts });
}

export async function POST({ locals, request }) {
  const user = requireUser(locals);
  const payload = await readJsonBody(request, createAccountSchema);
  const account = await createAccount(user.id, payload);
  return json({ account }, { status: 201 });
}
