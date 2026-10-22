<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const modeOptions = [
    { value: "open", label: "Open — everyone except blocked" },
    { value: "allowlist", label: "Allowlist — only allowed accounts" },
  ];
  const addStatusOptions = [
    { value: "allowed", label: "Allow" },
    { value: "blocked", label: "Block" },
  ];
  const accessLabels: Record<string, string> = { admin: "Admin", allowed: "Allowed", blocked: "Blocked", pending: "Pending" };
  const accessClasses: Record<string, string> = {
    admin: "border-signal/50 bg-signal/10 text-signal",
    allowed: "border-border text-muted-foreground",
    blocked: "border-destructive/40 bg-destructive/10 text-destructive",
    pending: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  };

  let modeValue = $state("open");
  $effect(() => {
    modeValue = data.mode;
  });
  let addLogin = $state("");
  let addStatus = $state("allowed");
  let filter = $state("");

  const visibleUsers = $derived(
    filter.trim() ? data.users.filter((u) => `${u.email} ${u.username ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase())) : data.users
  );

  let modeForm = $state<HTMLFormElement | null>(null);
  let modeConfirmOpen = $state(false);

  let pendingForm = $state<HTMLFormElement | null>(null);
  let confirmOpen = $state(false);
  let confirmTitle = $state("");
  let confirmBody = $state("");
  let confirmLabel = $state("Confirm");
  let confirmDanger = $state(false);
  let busy = $state(false);
  let pending = $state<{ action: "setStatus" | "setAdmin"; userId: string; status?: string; isAdmin?: string }>({
    action: "setStatus",
    userId: "",
  });

  function nameOf(u: { username: string | null; email: string }) {
    return u.username ?? u.email;
  }

  function ask(next: typeof pending, title: string, body: string, label: string, danger: boolean) {
    pending = next;
    confirmTitle = title;
    confirmBody = body;
    confirmLabel = label;
    confirmDanger = danger;
    confirmOpen = true;
  }

  function formatWhen(iso: string | null) {
    if (!iso) return "never";
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  const submitWithBusy = () => {
    busy = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      busy = false;
      confirmOpen = false;
      modeConfirmOpen = false;
    };
  };
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  {#if form?.error}
    <p class="auth-error shrink-0">{form.error}</p>
  {:else if form && "ok" in form && form.ok}
    <p class="shrink-0 text-sm text-signal">{form.ok}</p>
  {/if}

  <div class="grid shrink-0 gap-4 md:grid-cols-2">
    <form
      method="POST"
      action="?/setMode"
      class="space-y-3 rounded-lg border border-border/70 bg-card/50 p-4"
      bind:this={modeForm}
      use:enhance={submitWithBusy}
    >
      <div>
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Portal access</h2>
        <p class="mt-1 text-sm text-muted-foreground">Admins always have access. Blocked accounts never do.</p>
      </div>
      <input type="hidden" name="mode" value={modeValue} />
      <ZapSelect options={modeOptions} bind:value={modeValue} placeholder="Open — everyone except blocked" />
      <button type="button" class="auth-btn w-fit" disabled={modeValue === data.mode || busy} onclick={() => (modeConfirmOpen = true)}
        >Save mode</button
      >
    </form>

    <form
      method="POST"
      action="?/addUser"
      class="space-y-3 rounded-lg border border-border/70 bg-card/50 p-4"
      use:enhance={() => {
        busy = true;
        return async ({ result, update }) => {
          await update({ reset: false });
          busy = false;
          if (result.type === "success") addLogin = "";
        };
      }}
    >
      <div>
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Allow or block an account</h2>
        <p class="mt-1 text-sm text-muted-foreground">Works before they’ve opened Zap. Exact email or username.</p>
      </div>
      <input class="auth-field" name="login" placeholder="email or username" autocomplete="off" bind:value={addLogin} />
      <input type="hidden" name="status" value={addStatus} />
      <div class="flex flex-wrap items-center gap-2">
        <div class="w-36"><ZapSelect options={addStatusOptions} bind:value={addStatus} placeholder="Allow" /></div>
        <button type="submit" class="auth-btn w-fit" disabled={!addLogin.trim() || busy}>Apply</button>
      </div>
    </form>
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Accounts ({data.users.length})</h2>
        <p class="mt-1 text-sm text-muted-foreground">Everyone who has opened Zap or been set by an admin, most recently seen first.</p>
      </div>
      <input class="auth-field sm:w-64" placeholder="Filter by email or username" bind:value={filter} />
    </div>

    {#if visibleUsers.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No accounts.</p>
    {:else}
      <div class="zap-track-host min-h-0 flex-1 overflow-y-auto overscroll-contain" role="region" aria-label="Accounts">
        <ul class="divide-y divide-border/60">
          {#each visibleUsers as u (u.userId)}
            {@const isSelf = u.userId === data.currentUserId}
            <li class="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-2">
                  <span class="truncate font-medium">{nameOf(u)}</span>
                  {#if isSelf}<span class="font-mono text-[10px] text-muted-foreground">(you)</span>{/if}
                  <span class={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${accessClasses[u.access]}`}>{accessLabels[u.access]}</span>
                  {#if u.isAdmin && u.status !== "default"}
                    <span class="font-mono text-[10px] text-muted-foreground">status: {u.status}</span>
                  {/if}
                </p>
                <p class="font-mono text-[11px] text-muted-foreground">
                  {[u.username ? u.email : null, `last seen ${formatWhen(u.lastSeenAt)}`, `first seen ${formatWhen(u.firstSeenAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-1 font-mono text-[11px]">
                <a href={`/admin?user=${u.userId}`} class="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-secondary">Activity</a>
                {#if !u.isAdmin}
                  {#if u.status !== "allowed"}
                    <form method="POST" action="?/setStatus" use:enhance={submitWithBusy}>
                      <input type="hidden" name="userId" value={u.userId} />
                      <input type="hidden" name="status" value="allowed" />
                      <button type="submit" class="rounded border border-signal/40 px-2 py-1 text-signal hover:bg-signal/10" disabled={busy}
                        >Allow</button
                      >
                    </form>
                  {/if}
                  {#if u.status !== "default"}
                    <form method="POST" action="?/setStatus" use:enhance={submitWithBusy}>
                      <input type="hidden" name="userId" value={u.userId} />
                      <input type="hidden" name="status" value="default" />
                      <button
                        type="submit"
                        class="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-secondary"
                        title="Follow the portal mode"
                        disabled={busy}>Reset</button
                      >
                    </form>
                  {/if}
                  {#if u.status !== "blocked" && !isSelf}
                    <button
                      type="button"
                      class="rounded border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10"
                      disabled={busy}
                      onclick={() =>
                        ask(
                          { action: "setStatus", userId: u.userId, status: "blocked" },
                          `Block ${nameOf(u)}?`,
                          "They'll see a blocked page and every Zap page and API will refuse them. Sessions they host end now; they leave sessions they joined.",
                          "Block",
                          true
                        )}>Block</button
                    >
                  {/if}
                {/if}
                {#if u.isAdmin}
                  {#if !isSelf}
                    <button
                      type="button"
                      class="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-secondary"
                      disabled={busy}
                      onclick={() =>
                        ask(
                          { action: "setAdmin", userId: u.userId, isAdmin: "false" },
                          `Remove admin from ${nameOf(u)}?`,
                          "They keep normal Zap access but lose the admin section, song deletion and tag management.",
                          "Remove admin",
                          true
                        )}>Remove admin</button
                    >
                  {/if}
                {:else if u.status !== "blocked"}
                  <button
                    type="button"
                    class="rounded border border-signal/40 px-2 py-1 text-signal hover:bg-signal/10"
                    disabled={busy}
                    onclick={() =>
                      ask(
                        { action: "setAdmin", userId: u.userId, isAdmin: "true" },
                        `Make ${nameOf(u)} a Zap admin?`,
                        "Admins can delete songs from storage, manage system tags, block users and see everyone's activity.",
                        "Make admin",
                        false
                      )}>Make admin</button
                  >
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</div>

<form method="POST" action={`?/${pending.action}`} class="hidden" bind:this={pendingForm} use:enhance={submitWithBusy}>
  <input type="hidden" name="userId" value={pending.userId} />
  {#if pending.status}<input type="hidden" name="status" value={pending.status} />{/if}
  {#if pending.isAdmin}<input type="hidden" name="isAdmin" value={pending.isAdmin} />{/if}
</form>

<ConfirmDialog
  bind:open={confirmOpen}
  title={confirmTitle}
  body={confirmBody}
  {confirmLabel}
  danger={confirmDanger}
  {busy}
  onconfirm={() => pendingForm?.requestSubmit()}
/>

<ConfirmDialog
  bind:open={modeConfirmOpen}
  title={modeValue === "allowlist" ? "Switch to allowlist?" : "Open Zap to everyone?"}
  body={modeValue === "allowlist"
    ? "Only admins and accounts marked Allowed can use Zap. Everyone else sees an “access pending” page until you allow them."
    : "Every signed-in, verified account that isn't blocked can use Zap."}
  confirmLabel="Switch mode"
  danger={modeValue === "allowlist"}
  {busy}
  onconfirm={() => modeForm?.requestSubmit()}
/>
