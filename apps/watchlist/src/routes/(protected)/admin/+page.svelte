<script lang="ts">
  import { CableIcon, CombineIcon, ShieldIcon } from "@lucide/svelte";
  import * as Card from "$lib/components/ui/card";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<div class="h-screen overflow-y-scroll pb-24">
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
    <div class="space-y-2 mb-4">
      <div class="inline-flex items-center gap-2 text-accent">
        <ShieldIcon class="size-5" />
        <span class="text-[10px] uppercase tracking-wide">Admin</span>
      </div>
      <h1 class="text-3xl font-medium">Admin center</h1>
      <p class="text-muted-foreground text-sm">
        Manage connectors and clean up duplicate catalog titles. Signed in as
        <span class="text-foreground">{data.user.username}</span>.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <a href="/admin/connectors" class="block group">
        <Card.Root class="h-full transition-colors group-hover:border-accent/50">
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-base">
              <CableIcon class="size-4 text-accent" />
              Connectors
            </Card.Title>
          </Card.Header>
          <Card.Content class="text-xs/relaxed text-muted-foreground">
            Enable auto imports, edit safe settings, run manual syncs, and inspect load history.
          </Card.Content>
        </Card.Root>
      </a>

      <a href="/admin/duplicates" class="block group">
        <Card.Root class="h-full transition-colors group-hover:border-accent/50">
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-base">
              <CombineIcon class="size-4 text-accent" />
              Duplicates &amp; merge
            </Card.Title>
          </Card.Header>
          <Card.Content class="text-xs/relaxed text-muted-foreground">
            Review direct, indirect, and fuzzy duplicate suggestions. Merge ratings or dismiss false positives.
          </Card.Content>
        </Card.Root>
      </a>
    </div>
  </div>
</div>
