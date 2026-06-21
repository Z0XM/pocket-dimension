<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let userId = $state("");
  let role = $state<"owner" | "admin" | "editor" | "contributor" | "viewer">("contributor");
  let message = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);

  const memberships = $derived(data.memberships);

  async function saveMembership() {
    errorMessage = null;
    message = null;

    const response = await fetch("/api/admin/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });

    if (!response.ok) {
      errorMessage = "Could not update membership";
      return;
    }

    message = "Membership updated";
    userId = "";
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Rhymes people — rhymes</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-8 text-theme-peach-1">
  <a href="/" class="text-sm text-theme-peach-3 underline">Back to reader</a>
  <h1 class="mt-4 font-heading text-3xl">Rhymes people</h1>
  <p class="mt-2 text-sm text-theme-peach-3">Assign rhymes-specific workspace roles independently from global auth roles.</p>

  <section class="mt-8 border border-theme-red-2/40 bg-theme-pink-4 p-4">
    <h2 class="font-heading text-lg">Assign role</h2>
    <div class="mt-4 grid gap-3 md:grid-cols-[1fr_12rem_auto]">
      <input bind:value={userId} placeholder="User ID" class="border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm" />
      <select bind:value={role} class="border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm">
        <option value="owner">Owner</option>
        <option value="admin">Admin</option>
        <option value="editor">Editor</option>
        <option value="contributor">Contributor</option>
        <option value="viewer">Viewer</option>
      </select>
      <button type="button" class="border border-theme-peach-2 bg-theme-peach-2 px-4 py-2 text-sm text-theme-pink-5" onclick={() => void saveMembership()}>
        Save
      </button>
    </div>
    {#if message}<p class="mt-3 text-xs text-theme-peach-2">{message}</p>{/if}
    {#if errorMessage}<p class="mt-3 text-xs text-theme-red-2">{errorMessage}</p>{/if}
  </section>

  <section class="mt-8">
    <h2 class="font-heading text-lg">Current memberships</h2>
    <div class="mt-4 overflow-x-auto border border-theme-red-2/40">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-theme-pink-3 text-theme-peach-3">
          <tr>
            <th class="px-3 py-2">User</th>
            <th class="px-3 py-2">Email</th>
            <th class="px-3 py-2">Role</th>
            <th class="px-3 py-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          {#each memberships as membership}
            <tr class="border-t border-theme-red-2/20">
              <td class="px-3 py-2">{membership.username ?? membership.userId}</td>
              <td class="px-3 py-2">{membership.email}</td>
              <td class="px-3 py-2 uppercase tracking-[0.12em]">{membership.role}</td>
              <td class="px-3 py-2">{new Date(membership.updatedAt).toLocaleString()}</td>
            </tr>
          {:else}
            <tr>
              <td colspan="4" class="px-3 py-4 text-theme-peach-3">No rhymes memberships yet.</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</main>
