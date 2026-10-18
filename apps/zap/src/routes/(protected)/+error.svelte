<script lang="ts">
  import { page } from "$app/state";
</script>

<section class="mx-auto max-w-md space-y-3 py-16 text-center">
  <p class="font-mono text-xs tracking-[0.35em] text-signal/80 uppercase">{page.status}</p>
  <h1 class="text-3xl font-semibold tracking-tight">
    {page.status === 403 ? "Not allowed" : page.status === 404 ? "Not found" : "Something went wrong"}
  </h1>
  <p class="text-sm text-muted-foreground">{page.error?.message ?? "Unexpected error."}</p>
  <a href="/home" class="inline-block text-sm text-signal hover:underline">Back to Home</a>
</section>
