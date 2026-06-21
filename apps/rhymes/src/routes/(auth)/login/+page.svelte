<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { authClient } from "$lib/auth-client";

  let loginBy = $state<"email" | "username">("email");
  let email = $state("");
  let username = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;

    try {
      const result =
        loginBy === "email"
          ? await authClient.signIn.email({ email, password, rememberMe: true })
          : await authClient.signIn.username({ username, password, rememberMe: true });

      if (result.error) {
        error = result.error.message ?? "Unable to log in";
        loading = false;
        return;
      }

      await goto($page.url.searchParams.get("redirect") ?? "/");
    } catch {
      error = "Something went wrong";
      loading = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
  <div class="text-center">
    <h1 class="font-heading text-2xl text-theme-peach-1">Sign in to rhymes</h1>
    <p class="mt-1 text-sm text-theme-peach-3">Creators need an account to draft, publish, and rate.</p>
  </div>

  {#if error}
    <p class="border border-theme-red-2/50 bg-theme-pink-3 px-3 py-2 text-sm text-theme-red-2" role="alert">{error}</p>
  {/if}

  <div class="flex gap-2 text-xs">
    <button type="button" class={loginBy === "email" ? "text-theme-peach-1" : "text-theme-peach-3"} onclick={() => (loginBy = "email")}>Email</button>
    <button type="button" class={loginBy === "username" ? "text-theme-peach-1" : "text-theme-peach-3"} onclick={() => (loginBy = "username")}>Username</button>
  </div>

  {#if loginBy === "email"}
    <label class="block text-xs text-theme-peach-3">
      Email
      <input type="email" bind:value={email} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
    </label>
  {:else}
    <label class="block text-xs text-theme-peach-3">
      Username
      <input type="text" bind:value={username} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
    </label>
  {/if}

  <label class="block text-xs text-theme-peach-3">
    Password
    <input type="password" bind:value={password} required class="mt-1 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1" />
  </label>

  <button type="submit" disabled={loading} class="w-full border border-theme-peach-2 bg-theme-peach-2 px-4 py-2 text-sm text-theme-pink-5">
    {loading ? "Signing in..." : "Sign in"}
  </button>

  <p class="text-center text-xs text-theme-peach-3">
    No account? <a href="/sign-up" class="text-theme-peach-1 underline">Create one</a>
  </p>
</form>
