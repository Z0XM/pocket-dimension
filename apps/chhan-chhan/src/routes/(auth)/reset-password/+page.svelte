<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";

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
  <div class="p-6 md:p-8">
    <div class="flex flex-col items-center gap-6 text-center">
      <div class="flex flex-col gap-2">
        <h1 class="font-heading text-2xl font-bold">Invalid reset link</h1>
        <p class="text-balance text-sm text-muted-foreground">
          {hasErrorFromParam && errorMessage ? errorMessage : "This link is invalid or has expired. Request a new one."}
        </p>
      </div>
      <div class="flex w-full flex-col gap-3">
        <button
          type="button"
          class="w-full rounded border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted"
          onclick={() => goto("/forgot-password")}
        >
          Request new link
        </button>
        <a href="/login" class="text-sm text-muted-foreground hover:text-primary">← Back to sign in</a>
      </div>
    </div>
  </div>
{:else if success}
  <div class="p-6 md:p-8">
    <div class="flex flex-col items-center gap-6 text-center">
      <div class="flex flex-col gap-2">
        <h1 class="font-heading text-2xl font-bold">Password updated</h1>
        <p class="text-balance text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
      <button
        type="button"
        class="w-full rounded border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted"
        onclick={() => goto("/login")}
      >
        Continue
      </button>
    </div>
  </div>
{:else}
  <form class="p-6 md:p-8" onsubmit={handleSubmit}>
    {#if error}
      <div class="mb-4 rounded-md border border-(--danger)/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-3 text-sm text-(--danger)">
        {error}
      </div>
    {/if}

    <div class="flex flex-col gap-5">
      <div class="flex flex-col items-center gap-2 text-center">
        <h1 class="font-heading text-2xl font-bold">Reset password</h1>
        <p class="text-balance text-sm text-muted-foreground">Choose a new password for your account.</p>
      </div>

      <div class="flex flex-col gap-2">
        <label for="password-{id}" class="text-sm font-medium">New password</label>
        <input
          id="password-{id}"
          type="password"
          bind:value={password}
          required
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="confirm-password-{id}" class="text-sm font-medium">Confirm password</label>
        <input
          id="confirm-password-{id}"
          type="password"
          bind:value={confirmPassword}
          required
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <p class="text-xs text-muted-foreground">8+ characters with upper, lower, number, and special character.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {loading ? "Saving…" : "Reset password"}
      </button>

      <p class="text-center text-sm text-muted-foreground">
        <a href="/login" class="text-primary underline-offset-2 hover:underline">← Back to sign in</a>
      </p>
    </div>
  </form>
{/if}
