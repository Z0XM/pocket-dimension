<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  const id = $props.id();

  const redirectTo = $derived(page.url.searchParams.get("redirect") ?? "/");
  const loginHref = $derived(redirectTo === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirectTo)}`);

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

<form class="auth-form" onsubmit={handleSubmit}>
  {#if error}
    <div class="auth-error">{error}</div>
  {/if}

  <div class="flex flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">Create your account</h1>
      <p class="text-balance text-sm text-muted-foreground">Sign up for Me Via You</p>
    </div>

    <div class="grid gap-2">
      <Label for="email-{id}">Email</Label>
      <Input id="email-{id}" type="email" placeholder="you@example.com" required bind:value={email} disabled={loading} />
      <p class="text-xs text-muted-foreground">We use this for account recovery and verification.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="grid gap-2">
        <Label for="name-{id}">Name</Label>
        <Input id="name-{id}" type="text" required bind:value={name} disabled={loading} />
      </div>
      <div class="grid gap-2">
        <Label for="username-{id}">Username</Label>
        <Input id="username-{id}" type="text" required bind:value={username} disabled={loading} />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="grid gap-2">
        <Label for="password-{id}">Password</Label>
        <Input id="password-{id}" type="password" required bind:value={password} disabled={loading} />
      </div>
      <div class="grid gap-2">
        <Label for="confirm-password-{id}">Confirm password</Label>
        <Input id="confirm-password-{id}" type="password" required bind:value={confirmPassword} disabled={loading} />
      </div>
    </div>
    <p class="text-xs text-muted-foreground">Use at least 8 characters with upper, lower, number, and special character.</p>

    <Button type="submit" disabled={loading} class="w-full">
      {#if loading}
        Please wait…
      {:else}
        Create account
      {/if}
    </Button>

    <p class="text-center text-sm text-muted-foreground">
      Already registered?
      <a href={loginHref} class="text-primary underline-offset-2 hover:underline">Sign in</a>
    </p>
  </div>
</form>
