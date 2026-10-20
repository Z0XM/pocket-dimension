<script lang="ts">
  import JoinSessionForm from "$lib/components/JoinSessionForm.svelte";
</script>

<section class="mx-auto max-w-md space-y-6">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Join session</h1>
    <p class="mt-1 text-sm text-muted-foreground">Enter the host’s join code. You’ll listen on this device.</p>
  </div>

  <JoinSessionForm />
</section>
