<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";

  const id = $props.id();

  let name = $state("");
  let email = $state("");
  let username = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = null;

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
      const result = await authClient.signUp.email({
        email,
        password,
        name,
        username,
        callbackURL: `${window.location.origin}/verify-email`,
      });

      if (result.error) {
        error = result.error.message ?? "Failed to create account. Please try again.";
        loading = false;
        return;
      }

      await goto(`/check-email?type=signup&email=${encodeURIComponent(email)}`);
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
      <h1 class="font-heading text-2xl font-bold">Create your account</h1>
      <p class="text-balance text-sm text-muted-foreground">Sign up for Chhan Chhan</p>
    </div>

    <div class="flex flex-col gap-2">
      <label for="email-{id}" class="text-sm font-medium">Email</label>
      <input
        id="email-{id}"
        type="email"
        placeholder="you@example.com"
        required
        bind:value={email}
        disabled={loading}
        class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />
      <p class="text-xs text-muted-foreground">We use this for account recovery and verification.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <label for="name-{id}" class="text-sm font-medium">Name</label>
        <input
          id="name-{id}"
          type="text"
          required
          bind:value={name}
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div class="flex flex-col gap-2">
        <label for="username-{id}" class="text-sm font-medium">Username</label>
        <input
          id="username-{id}"
          type="text"
          required
          bind:value={username}
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <label for="password-{id}" class="text-sm font-medium">Password</label>
        <input
          id="password-{id}"
          type="password"
          required
          bind:value={password}
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div class="flex flex-col gap-2">
        <label for="confirm-password-{id}" class="text-sm font-medium">Confirm password</label>
        <input
          id="confirm-password-{id}"
          type="password"
          required
          bind:value={confirmPassword}
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
    <p class="text-xs text-muted-foreground">Use at least 8 characters with upper, lower, number, and special character.</p>

    <button
      type="submit"
      disabled={loading}
      class="rounded border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
    >
      {#if loading}
        Please wait…
      {:else}
        Create account
      {/if}
    </button>

    <p class="text-center text-sm text-muted-foreground">
      Already registered?
      <a href="/login" class="text-primary-foreground underline-offset-2 hover:underline">Sign in</a>
    </p>
  </div>
</form>
