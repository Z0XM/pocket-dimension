<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  const id = $props.id();

  const token = $derived(page.url.searchParams.get("token") ?? "");
  const errorParam = $derived(page.url.searchParams.get("error"));

  function getErrorMessage(errorCode: string | null): string {
    if (!errorCode) return "";

    const errorMessages: Record<string, string> = {
      missing_callback: "Invalid reset link. Please use the link from your email.",
      token_expired: "This password reset link has expired. Please request a new password reset email.",
      token_invalid: "This password reset link is invalid. Please request a new password reset link.",
      token_already_used: "This password reset link has already been used. Please request a new one.",
      unknown: "An error occurred. Please try again.",
    };

    return errorMessages[errorCode] ?? errorMessages.unknown;
  }

  const errorMessage = $derived(getErrorMessage(errorParam));
  const hasErrorFromParam = $derived(!!errorParam);

  let password = $state("");
  let confirmPassword = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let success = $state(false);

  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = null;

    if (!token) {
      error = "Invalid or missing reset token. Please request a new password reset link.";
      return;
    }

    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    if (!strongPasswordRegex.test(password)) {
      error = "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character";
      return;
    }

    loading = true;

    try {
      const response = await fetch(`${PUBLIC_BASE_AUTH_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: password,
          token,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        error = data.message ?? data.error ?? "Failed to reset password. The link may have expired.";
        loading = false;
        return;
      }

      success = true;
      setTimeout(() => {
        goto("/login");
      }, 3000);
    } catch (err) {
      console.error(err);
      error = "Something went wrong!";
      loading = false;
    }
  }
</script>

{#if !token || hasErrorFromParam}
  <div class="auth-form">
    <div class="flex flex-col items-center gap-6 text-center">
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold">Invalid reset link</h1>
        <p class="text-balance text-sm text-muted-foreground">
          {hasErrorFromParam && errorMessage ? errorMessage : "This link is invalid or has expired. Request a new one."}
        </p>
      </div>
      <div class="flex w-full flex-col gap-3">
        <Button type="button" class="w-full" onclick={() => goto("/forgot-password")}>Request new link</Button>
        <a href="/login" class="link-accent text-sm">← Back to sign in</a>
      </div>
    </div>
  </div>
{:else if success}
  <div class="auth-form">
    <div class="flex flex-col items-center gap-6 text-center">
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold">Password updated</h1>
        <p class="text-balance text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
      <Button type="button" class="w-full" onclick={() => goto("/login")}>Continue</Button>
    </div>
  </div>
{:else}
  <form class="auth-form" onsubmit={handleSubmit}>
    {#if error}
      <div class="auth-error">{error}</div>
    {/if}

    <div class="flex flex-col gap-5">
      <div class="flex flex-col items-center gap-2 text-center">
        <h1 class="text-2xl font-bold">Reset password</h1>
        <p class="text-balance text-sm text-muted-foreground">Choose a new password for your account.</p>
      </div>

      <div class="grid gap-2">
        <Label for="password-{id}">New password</Label>
        <Input id="password-{id}" type="password" bind:value={password} required disabled={loading} />
      </div>

      <div class="grid gap-2">
        <Label for="confirm-password-{id}">Confirm password</Label>
        <Input id="confirm-password-{id}" type="password" bind:value={confirmPassword} required disabled={loading} />
        <p class="text-xs text-muted-foreground">8+ characters with upper, lower, number, and special character.</p>
      </div>

      <Button type="submit" disabled={loading} class="w-full">
        {loading ? "Saving…" : "Reset password"}
      </Button>

      <p class="text-center text-sm text-muted-foreground">
        <a href="/login" class="link-accent">← Back to sign in</a>
      </p>
    </div>
  </form>
{/if}
