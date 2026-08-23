<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import type { DeliveryItem } from "$lib/catalog/delivery";
  import { sectionHref } from "$lib/nav";
  import type { TreeId } from "$lib/types";

  let {
    items,
    tree = null,
  }: {
    items: DeliveryItem[];
    tree?: TreeId | null;
  } = $props();

  function itemHref(item: DeliveryItem): string {
    const base = item.kind === "epic" ? `/epics/${item.id}` : `/stories/${item.id}`;
    return sectionHref(base, tree);
  }
</script>

<Table.Root aria-label="Delivery table">
  <Table.Header>
    <Table.Row>
      <Table.Head>Title</Table.Head>
      <Table.Head>Kind</Table.Head>
      <Table.Head>Status</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each items as item (item.id + item.sourcePath)}
      <Table.Row>
        <Table.Cell>
          <a href={itemHref(item)} class="text-foreground underline-offset-4 hover:underline">{item.title}</a>
        </Table.Cell>
        <Table.Cell class="text-muted-foreground capitalize">{item.kind}</Table.Cell>
        <Table.Cell class="font-mono text-xs text-muted-foreground">{item.statusLabel}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
