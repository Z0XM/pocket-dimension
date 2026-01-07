<script lang="ts" generics="TData, TValue">
  import { Columns2Icon } from "@lucide/svelte";
  import {
    type ColumnDef,
    getCoreRowModel,
    type VisibilityState,
  } from "@tanstack/table-core";
  import { Button } from "$lib/components/ui/button";
  import {
    createSvelteTable,
    FlexRender,
  } from "$lib/components/ui/data-table/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import * as Table from "$lib/components/ui/table/index.js";

  type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onSentinelMount: (element: HTMLElement) => void;
    isLoading?: boolean;
  };

  let {
    data,
    columns,
    onSentinelMount,
    isLoading = false,
  }: DataTableProps<TData, TValue> = $props();

  let columnVisibility = $state<VisibilityState>({});

  let sentinelRef: HTMLElement | null = $state(null);

  $effect(() => {
    if (sentinelRef) {
      onSentinelMount(sentinelRef);
    }
  });

  const table = createSvelteTable({
    get data() {
      return data;
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: (updater) => {
      if (typeof updater === "function") {
        columnVisibility = updater(columnVisibility);
      } else {
        columnVisibility = updater;
      }
    },
    state: {
      get columnVisibility() {
        return columnVisibility;
      },
    },
  });
</script>

<div>
  <div class="flex items-center pt-4 px-16">
    <Input
      placeholder="Search by title..."
      value={table.getColumn("title")?.getFilterValue() as string}
      onchange={(e) =>
        table.getColumn("title")?.setFilterValue(e.currentTarget.value)}
      oninput={(e) =>
        table.getColumn("title")?.setFilterValue(e.currentTarget.value)}
      class="max-w-sm"
    />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="outline"
            class="ms-auto flex items-center gap-2"
            ><Columns2Icon /> Columns</Button
          >
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {#each table
          .getAllColumns()
          .filter((col) => col.getCanHide()) as column (column.id)}
          <DropdownMenu.CheckboxItem
            class="capitalize"
            bind:checked={
              () => column.getIsVisible(), (v) => column.toggleVisibility(!!v)
            }
          >
            {column.id}
          </DropdownMenu.CheckboxItem>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
  <div class="rounded-md">
    <Table.Root class="border-separate border-spacing-y-2">
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <Table.Row
            class="sticky top-0 bg-primary-foreground z-1 scale-[97%] transition-all duration-500 ease-out  [&>th:first-child]:border-l [&>th:first-child]:pl-4 [&>th:first-child]:rounded-l-md [&>th:last-child]:border-r [&>th:last-child]:pr-4 [&>th:last-child]:rounded-r-md [&>th]:border-t [&>th]:border-b"
          >
            {#each headerGroup.headers as header (header.id)}
              <Table.Head colspan={header.colSpan} class="border-input">
                {#if !header.isPlaceholder}
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row
            data-state={row.getIsSelected() && "selected"}
            class=" hover:scale-[102%] scale-[97%] transition-all duration-300 ease-out bg-white/1 backdrop-blur-md [&>td:first-child]:border-l [&>td:first-child]:pl-4 [&>td:first-child]:rounded-l-md [&>td:last-child]:border-r [&>td:last-child]:pr-4 [&>td:last-child]:px-4 [&>td:last-child]:rounded-r-md [&>td]:border-t [&>td]:border-b"
          >
            {#each row.getVisibleCells() as cell (cell.id)}
              <Table.Cell class="border-transparent py-4">
                <FlexRender
                  content={cell.column.columnDef.cell}
                  context={cell.getContext()}
                />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-24 text-center">
              No results.
            </Table.Cell>
          </Table.Row>
        {/each}
        {#if table.getRowModel().rows.length > 0}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="p-0">
              <div
                bind:this={sentinelRef}
                class=" h-20 w-full"
                data-sentinel="true"
              ></div>
            </Table.Cell>
          </Table.Row>
        {/if}
      </Table.Body>
    </Table.Root>
  </div>
</div>
