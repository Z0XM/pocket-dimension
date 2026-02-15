<script lang="ts">
  import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, LockIcon } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "$components/ui/button/index.js";
  import { Field, FieldDescription, FieldGroup, FieldLabel } from "$components/ui/field/index.js";
  import { Input } from "$components/ui/input/index.js";
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";

  const id = $props.id();

  const token = $derived(page.url.searchParams.get("token") ?? "");
  const errorParam = $derived(page.url.searchParams.get("error"));

  // Map error codes to user-friendly messages
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

  // Strong password regex: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
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
      // Auto redirect to login after 3 seconds
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
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <CircleXIcon class="h-8 w-8 text-destructive" />
      </div>
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold">Invalid Reset Link</h1>
        <p class="text-muted-foreground text-sm text-balance">
          {hasErrorFromParam && errorMessage ? errorMessage : "This password reset link is invalid or has expired. Please request a new one."}
        </p>
      </div>
      <div class="flex flex-col gap-3 w-full">
        <Button onclick={() => goto("/forgot-password")} class="w-full">Request New Reset Link</Button>
        <a href="/login" class="text-sm text-muted-foreground hover:text-primary transition-colors"> ← Back to Login </a>
      </div>
    </div>
  </div>
{:else if success}
  <div class="p-6 md:p-8">
    <div class="flex flex-col items-center gap-6 text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
        <CircleCheckIcon class="h-8 w-8 text-green-500" />
      </div>
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold">Password Reset!</h1>
        <p class="text-muted-foreground text-sm text-balance">Your password has been reset successfully. You will be redirected to login...</p>
      </div>
      <Button onclick={() => goto("/login")} class="w-full">Continue to Login</Button>
    </div>
  </div>
{:else}
  <form class="p-6 md:p-8" onsubmit={handleSubmit}>
    {#if error}
      <div class="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error}
      </div>
    {/if}

    <FieldGroup>
      <div class="flex flex-col items-center gap-2 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
          <LockIcon class="h-6 w-6 text-primary" />
        </div>
        <h1 class="text-2xl font-bold">Reset Password</h1>
        <p class="text-muted-foreground text-sm text-balance">Enter your new password below.</p>
      </div>

      <Field>
        <FieldLabel for="password-{id}">New Password</FieldLabel>
        <Input id="password-{id}" type="password" bind:value={password} required disabled={loading} />
      </Field>

      <Field>
        <FieldLabel for="confirm-password-{id}">Confirm Password</FieldLabel>
        <Input id="confirm-password-{id}" type="password" bind:value={confirmPassword} required disabled={loading} />
        <FieldDescription>Password must be at least 8 characters with uppercase, lowercase, number, and special character.</FieldDescription>
      </Field>

      <Field>
        <Button type="submit" disabled={loading} class="w-full">
          {#if loading}
            <LoaderCircleIcon class="animate-spin mr-2" />
            Resetting...
          {:else}
            Reset Password
          {/if}
        </Button>
      </Field>

      <FieldDescription class="text-center">
        <a href="/login">← Back to Login</a>
      </FieldDescription>
    </FieldGroup>
  </form>
{/if}
