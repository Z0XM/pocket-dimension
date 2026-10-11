<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

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

<section class="mx-auto max-w-md space-y-6">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Join session</h1>
    <p class="mt-1 text-sm text-muted-foreground">Enter the host’s join code. You’ll listen on this device.</p>
  </div>

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
    <button type="submit" class="auth-btn w-full" disabled={loading || !code.trim()}>
      {loading ? "Joining…" : "Join"}
    </button>
  </form>
</section>
