<script lang="ts">
  import { goto } from "$app/navigation";
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";

  const id = $props.id();

  let email = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    loading = true;

    try {
      const response = await fetch(`${PUBLIC_BASE_AUTH_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        error = data.message ?? data.error ?? "Failed to send reset email. Please try again.";
        loading = false;
        return;
      }

      await goto(`/check-email?type=forgot&email=${encodeURIComponent(email)}`);
    } catch (err) {
      console.error(err);
      error = "Something went wrong!";
      loading = false;
    }
  }
</script>

<form class="p-6 md:p-8" onsubmit={handleSubmit}>
  {#if error}
    <div class="mb-4 rounded-md border border-(--danger)/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-3 text-sm text-(--danger)">
      {error}
    </div>
  {/if}

  <div class="flex flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="font-heading text-2xl font-bold">Forgot password</h1>
      <p class="text-balance text-sm text-muted-foreground">We will email you a reset link if an account exists.</p>
    </div>

    <div class="flex flex-col gap-2">
      <label for="email-{id}" class="text-sm font-medium">Email</label>
      <input
        id="email-{id}"
        type="email"
        placeholder="you@example.com"
        bind:value={email}
        required
        disabled={loading}
        class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />
    </div>

    <button
      type="submit"
      disabled={loading}
      class="w-full rounded border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
    >
      {loading ? "Sending…" : "Send reset link"}
    </button>

    <p class="text-center text-sm text-muted-foreground">
      <a href="/login" class="text-primary underline-offset-2 hover:underline">Back to sign in</a>
    </p>
  </div>
</form>
