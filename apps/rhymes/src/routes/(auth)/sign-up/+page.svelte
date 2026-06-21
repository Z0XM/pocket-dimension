<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";

  let name = $state("");
  let email = $state("");
  let username = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    error = null;

    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    if (!strongPasswordRegex.test(password)) {
      error = "Password must be at least 8 characters with upper, lower, number, and special character";
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
        error = result.error.message ?? "Could not create account";
        loading = false;
        return;
      }

      await goto(`/check-email?email=${encodeURIComponent(email)}`);
    } catch {
      error = "Something went wrong";
      loading = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
  <div class="text-center">
    <h1 class="font-heading text-2xl text-theme-peach-1">Create a rhymes account</h1>
    <p class="mt-1 text-sm text-theme-peach-3">Sign up to draft, publish, and collaborate.</p>
  </div>

  {#if error}
    <p class="border border-theme-red-2/50 bg-theme-pink-3 px-3 py-2 text-sm text-theme-red-2" role="alert">{error}</p>
  {/if}

  <label class="block text-xs text-theme-peach-3">
    Name
    <input type="text" bind:value={name} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
  </label>
  <label class="block text-xs text-theme-peach-3">
    Email
    <input type="email" bind:value={email} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
  </label>
  <label class="block text-xs text-theme-peach-3">
    Username
    <input type="text" bind:value={username} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
  </label>
  <label class="block text-xs text-theme-peach-3">
    Password
    <input type="password" bind:value={password} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
  </label>
  <label class="block text-xs text-theme-peach-3">
    Confirm password
    <input type="password" bind:value={confirmPassword} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
  </label>

  <button type="submit" disabled={loading} class="w-full border border-theme-peach-2 bg-theme-peach-2 px-4 py-2 text-sm text-theme-pink-5">
    {loading ? "Creating account..." : "Sign up"}
  </button>

  <p class="text-center text-xs text-theme-peach-3">
    Already have an account? <a href="/login" class="text-theme-peach-1 underline">Sign in</a>
  </p>
</form>
