<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  const id = $props.id();

  const redirectTo = $derived(page.url.searchParams.get("redirect") ?? "/");
  const signUpHref = $derived(redirectTo === "/" ? "/sign-up" : `/sign-up?redirect=${encodeURIComponent(redirectTo)}`);
  const magicLinkError = $derived(page.url.searchParams.get("error"));

  let loginBy = $state<"email" | "username">("email");
  let emailMethod = $state<"password" | "magic-link">("password");
  let email = $state("");
  let username = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let emailNotVerified = $state(false);
  let resendingVerification = $state(false);

  const magicLinkErrorMessage = $derived.by(() => {
    if (!magicLinkError) return null;

    const code = page.url.searchParams.get("error");
    const messages: Record<string, string> = {
      INVALID_TOKEN: "This sign-in link is invalid or has already been used. Request a new one.",
      failed_to_create_user: "We couldn't create your account. Please try again.",
      new_user_signup_disabled: "Sign up with magic link is not available. Create an account first.",
      failed_to_create_session: "We couldn't sign you in. Please try again.",
      magic_link: "Sign-in link failed. Please request a new one.",
    };

    return messages[code ?? ""] ?? "Sign-in link failed. Please request a new one.";
  });

  function callbackUrl() {
    const path = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
    return `${window.location.origin}${path}`;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    emailNotVerified = false;
    loading = true;

    try {
      if (loginBy === "email" && emailMethod === "magic-link") {
        const result = await authClient.signIn.magicLink({
          email,
          callbackURL: callbackUrl(),
          errorCallbackURL: `${window.location.origin}/login?error=magic_link&redirect=${encodeURIComponent(redirectTo)}`,
        });

        if (result.error) {
          error = result.error.message ?? "Unable to send sign-in link";
          loading = false;
          return;
        }

        await goto(`/check-email?type=magic-link&email=${encodeURIComponent(email)}`);
        return;
      }

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

<form class="auth-form" onsubmit={handleSubmit}>
  {#if magicLinkErrorMessage}
    <div class="auth-error">{magicLinkErrorMessage}</div>
  {/if}

  {#if error}
    <div class="auth-error">{error}</div>
  {/if}

  {#if emailNotVerified}
    <div class="auth-notice">
      <p class="mb-3">Your email address has not been verified yet.</p>
      <Button
        type="button"
        variant="secondary"
        class="w-full"
        onclick={handleResendVerification}
        disabled={loginBy !== "email" || !email || resendingVerification}
      >
        {#if resendingVerification}
          Sending…
        {:else}
          Resend verification email
        {/if}
      </Button>
    </div>
  {/if}

  <div class="flex flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">Welcome back</h1>
      <p class="text-balance text-sm text-muted-foreground">Log in to zeo</p>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-3 text-sm">
        <button
          type="button"
          class="segment-btn {loginBy === 'email' ? 'text-primary' : 'text-muted-foreground'}"
          onclick={() => (loginBy = "email")}
        >
          Email
        </button>
        <span class="text-muted-foreground">·</span>
        <button
          type="button"
          class="segment-btn {loginBy === 'username' ? 'text-primary' : 'text-muted-foreground'}"
          onclick={() => (loginBy = "username")}
        >
          Username
        </button>
      </div>
      {#if loginBy === "email"}
        <Input id="email-{id}" type="email" placeholder="you@example.com" bind:value={email} required disabled={loading} />
      {:else}
        <Input id="username-{id}" type="text" placeholder="username" bind:value={username} required disabled={loading} />
      {/if}
    </div>

    {#if loginBy === "email"}
      <div class="flex items-center gap-3 text-sm">
        <button
          type="button"
          class="segment-btn {emailMethod === 'password' ? 'text-primary' : 'text-muted-foreground'}"
          onclick={() => (emailMethod = "password")}
        >
          Password
        </button>
        <span class="text-muted-foreground">·</span>
        <button
          type="button"
          class="segment-btn {emailMethod === 'magic-link' ? 'text-primary' : 'text-muted-foreground'}"
          onclick={() => (emailMethod = "magic-link")}
        >
          Magic link
        </button>
      </div>
    {/if}

    {#if loginBy !== "email" || emailMethod === "password"}
      <div class="grid gap-2">
        <div class="flex items-center gap-2">
          <Label for="password-{id}">Password</Label>
          <a href="/forgot-password" class="link-accent ms-auto text-sm">Forgot password?</a>
        </div>
        <Input id="password-{id}" type="password" bind:value={password} required disabled={loading} />
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">
        We'll email you a one-tap sign-in link. No password needed.
      </p>
    {/if}

    <Button type="submit" disabled={loading} class="w-full">
      {#if loading}
        Please wait…
      {:else if loginBy === "email" && emailMethod === "magic-link"}
        Send sign-in link
      {:else}
        Log in
      {/if}
    </Button>

    <p class="text-center text-sm text-muted-foreground">
      No account?
      <a href={signUpHref} class="link-action">Sign up</a>
    </p>
  </div>
</form>
