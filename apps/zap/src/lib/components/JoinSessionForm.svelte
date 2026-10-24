<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import DoorOpenIcon from "@lucide/svelte/icons/door-open";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import { toast } from "$lib/toast.svelte";

  let {
    /** Full-width submit button (standalone page). */
    fullWidth = true,
  }: {
    fullWidth?: boolean;
  } = $props();

  // Prefill from `?code=` when present (standalone /join deep-links).
  let code = $state(page.url.searchParams.get("code") ?? "");
  let loading = $state(false);

  async function join() {
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
      toast.error(err instanceof Error ? err.message : "Join failed");
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
  <div class={`flex ${fullWidth ? "w-full flex-col gap-2 sm:flex-row sm:items-end" : "w-full flex-wrap items-end"} gap-3`}>
    <label class={`block space-y-1 ${fullWidth ? "w-full sm:min-w-0 sm:flex-1" : "min-w-[10rem] flex-1"}`}>
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
    <button
      type="submit"
      class={`auth-btn inline-flex shrink-0 items-center justify-center gap-1.5 ${fullWidth ? "w-full sm:w-fit px-5" : "w-fit px-5"}`}
      disabled={loading || !code.trim()}
    >
      <DoorOpenIcon class="size-3.5" aria-hidden="true" />
      {loading ? "Joining…" : "Join"}
    </button>
  </div>
  {#if loading}
    <BusyStatus label="Joining session…" detail="Looking up room…" />
  {/if}
</form>
