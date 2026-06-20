<script lang="ts">
  import * as Card from "$lib/components/ui/card";

  type Props = {
    label: string;
    value: string | number;
    hint?: string;
  };

  const { label, value, hint }: Props = $props();
</script>

<Card.Root class="py-3 gap-2">
  <Card.Header class="px-4 pb-0">
    <Card.Description class="text-[0.65rem] uppercase tracking-[0.08em]">{label}</Card.Description>
  </Card.Header>
  <Card.Content class="px-4 pt-0">
    <p class="text-2xl font-semibold tabular-nums">{value}</p>
    {#if hint}
      <p class="text-muted-foreground text-[0.7rem] mt-1">{hint}</p>
    {/if}
  </Card.Content>
</Card.Root>
