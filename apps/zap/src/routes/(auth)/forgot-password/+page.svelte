<script lang="ts">
  import { goto } from "$app/navigation";
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

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

<form class="auth-form" onsubmit={handleSubmit}>
  {#if error}
    <div class="auth-error">{error}</div>
  {/if}

  <div class="flex flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">Forgot password</h1>
      <p class="text-balance text-sm text-muted-foreground">We will email you a reset link if an account exists.</p>
    </div>

    <div class="grid gap-2">
      <Label for="email-{id}">Email</Label>
      <Input id="email-{id}" type="email" placeholder="you@example.com" bind:value={email} required disabled={loading} />
    </div>

    <Button type="submit" disabled={loading} class="w-full">
      {loading ? "Sending…" : "Send reset link"}
    </Button>

    <p class="text-center text-sm text-muted-foreground">
      <a href="/login" class="text-accent underline-offset-2 hover:underline">Back to sign in</a>
    </p>
  </div>
</form>
