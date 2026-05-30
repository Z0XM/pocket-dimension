<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";

  const id = $props.id();

  const redirectTo = $derived(page.url.searchParams.get("redirect") ?? "/app");

  let loginBy = $state<"email" | "username">("email");
  let email = $state("");
  let username = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let emailNotVerified = $state(false);
  let resendingVerification = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    emailNotVerified = false;
    loading = true;

    try {
      const result =
        loginBy === "email"
          ? await authClient.signIn.email({
              email,
              password,
              rememberMe: true,
            })
          : await authClient.signIn.username({
              username,
              password,
              rememberMe: true,
            });

      if (result.error) {
        if (
          result.error.status === 403 ||
          (result.error.message?.toLowerCase().includes("email") && result.error.message?.toLowerCase().includes("verif"))
        ) {
          emailNotVerified = true;
          error = "Please verify your email address before logging in.";
        } else {
          error = result.error.message ?? "Unable to login";
        }
        loading = false;
        return;
      }

      await goto(redirectTo);
    } catch (err) {
      console.error(err);
      error = "Something went wrong!";
      loading = false;
    }
  }

  async function handleResendVerification() {
    if (!email && loginBy === "email") {
      error = "Please enter your email address first.";
      return;
    }

    resendingVerification = true;
    error = null;

    try {
      const { PUBLIC_BASE_AUTH_URL } = await import("$env/static/public");
      const response = await fetch(`${PUBLIC_BASE_AUTH_URL}/send-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginBy === "email" ? email : "",
          callbackURL: `${window.location.origin}/verify-email`,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        error = data.message ?? data.error ?? "Failed to send verification email.";
      } else {
        await goto(`/check-email?type=resend&email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      console.error(err);
      error = "Failed to send verification email.";
    } finally {
      resendingVerification = false;
    }
  }
</script>

<form class="p-6 md:p-8" onsubmit={handleSubmit}>
  {#if error}
    <div class="mb-4 rounded-md border border-(--danger)/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-3 text-sm text-(--danger)">
      {error}
    </div>
  {/if}

  {#if emailNotVerified}
    <div
      class="mb-4 rounded-md border border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] p-4 text-sm"
    >
      <p class="mb-3 text-text">Your email address has not been verified yet.</p>
      <button
        type="button"
        class="w-full rounded border border-border bg-secondary px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        onclick={handleResendVerification}
        disabled={loginBy !== "email" || !email || resendingVerification}
      >
        {#if resendingVerification}
          Sending…
        {:else}
          Resend verification email
        {/if}
      </button>
    </div>
  {/if}

  <div class="flex flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="font-heading text-2xl font-bold">Welcome back</h1>
      <p class="text-balance text-sm text-muted-foreground">Log in to Chhan Chhan</p>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-3 text-sm">
        <button
          type="button"
          class="font-medium {loginBy === 'email' ? 'text-primary-foreground' : 'text-muted-foreground'}"
          onclick={() => (loginBy = "email")}
        >
          Email
        </button>
        <span class="text-muted-foreground">·</span>
        <button
          type="button"
          class="font-medium {loginBy === 'username' ? 'text-primary-foreground' : 'text-muted-foreground'}"
          onclick={() => (loginBy = "username")}
        >
          Username
        </button>
      </div>
      {#if loginBy === "email"}
        <input
          id="email-{id}"
          type="email"
          placeholder="you@example.com"
          bind:value={email}
          required
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      {:else}
        <input
          id="username-{id}"
          type="text"
          placeholder="username"
          bind:value={username}
          required
          disabled={loading}
          class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      {/if}
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <label for="password-{id}" class="text-sm font-medium">Password</label>
        <a href="/forgot-password" class="ms-auto text-sm text-primary-foreground underline-offset-2 hover:underline">Forgot password?</a>
      </div>
      <input
        id="password-{id}"
        type="password"
        bind:value={password}
        required
        disabled={loading}
        class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />
    </div>

    <button
      type="submit"
      disabled={loading}
      class="border-2 border-foreground bg-accent px-4 py-2 text-sm font-bold text-accent-foreground shadow-[3px_3px_0_var(--foreground)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_var(--foreground)] disabled:opacity-50"
    >
      {#if loading}
        Please wait…
      {:else}
        Log in
      {/if}
    </button>

    <p class="text-center text-sm text-muted-foreground">
      No account?
      <a href="/sign-up" class="text-primary-foreground underline-offset-2 hover:underline">Sign up</a>
    </p>
  </div>
</form>
