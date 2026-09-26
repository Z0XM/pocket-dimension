<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";

  const session = authClient.useSession();
  const user = $derived($session.data?.user);

  async function handleLogout() {
    await authClient.signOut();
    goto("/login");
  }
</script>

<svelte:head>
  <title>Profile · How Was Your Day</title>
</svelte:head>

<section class="flex flex-col gap-4">
  <div>
    <p class="mb-2 text-[0.8rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Account</p>
    <h1 class="font-display text-3xl tracking-tight text-foreground md:text-4xl">Profile</h1>
    <p class="mt-2 text-[1.05rem] leading-relaxed text-foreground/75">Your account on How Was Your Day.</p>
  </div>

  <Card.Root>
    <Card.Content class="flex flex-col gap-4 px-6 py-5">
      {#if user}
        <div class="flex flex-col gap-1">
          <span class="text-[0.75rem] tracking-[0.06em] text-muted-foreground uppercase">Username</span>
          <span class="font-display text-xl text-primary">{user.username ?? "—"}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[0.75rem] tracking-[0.06em] text-muted-foreground uppercase">Name</span>
          <span class="text-foreground">{user.name ?? "—"}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[0.75rem] tracking-[0.06em] text-muted-foreground uppercase">Email</span>
          <span class="text-foreground">{user.email ?? "—"}</span>
        </div>
      {:else}
        <p class="text-sm text-muted-foreground">Loading your profile…</p>
      {/if}
    </Card.Content>
  </Card.Root>

  <div class="flex flex-wrap items-center gap-2">
    <Button href="/" variant="secondary">Back home</Button>
    <Button variant="destructive" onclick={handleLogout}>Log out</Button>
  </div>
</section>
