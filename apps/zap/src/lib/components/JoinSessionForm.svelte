<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import BusyStatus from "$lib/components/BusyStatus.svelte";

  let {
    /** Full-width submit button (standalone page). */
    fullWidth = true,
  }: {
    fullWidth?: boolean;
  } = $props();

  // Prefill from `?code=` when present (standalone /join deep-links).
  let code = $state(page.url.searchParams.get("code") ?? "");
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function join() {
    error = null;
    loading = true;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "join", code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Join failed (${res.status})`);
      const id = body?.session?.id;
      if (!id) throw new Error("No session id returned");
      await goto(`/session/${id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Join failed";
    } finally {
      loading = false;
    }
  }
</script>

<form
  class="space-y-3"
  onsubmit={(e) => {
    e.preventDefault();
    void join();
  }}
>
  <label class="block space-y-1">
    <span class="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Join code</span>
    <input
      class="auth-field text-center font-mono text-lg tracking-[0.35em] uppercase"
      bind:value={code}
      placeholder="K7M2QX"
      autocomplete="off"
      maxlength="12"
      required
    />
  </label>
  {#if error}
    <p class="auth-error">{error}</p>
  {/if}
  {#if loading}
    <BusyStatus label="Joining session…" detail="Looking up room…" />
  {/if}
  <button type="submit" class={`auth-btn ${fullWidth ? "w-full" : "w-fit px-5"}`} disabled={loading || !code.trim()}>
    {loading ? "Joining…" : "Join"}
  </button>
</form>
