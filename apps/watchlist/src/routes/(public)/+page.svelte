<script lang="ts">
  import type { PageProps } from "./$types";
  import { columns, type Watchlist } from "./columns";
  import DataTable from "./data-table.svelte";
  import { useDataFetch } from "./data-table-helpers/data-fetch.svelte";
  import { useInfiniteScroll } from "./data-table-helpers/infinite-scroll.svelte";

  let { data }: PageProps = $props();

  // Data fetching composable
  const dataFetch = useDataFetch<Watchlist>({
    initialData: () => (data as any)?.watchItems ?? [],
    fetchUrl: (pageIndex) => `/api/watchlist?pageIndex=${pageIndex}`,
    pageSize: 25,
  });

  // Derive watchlist reactively to track changes
  const watchlist = $derived(dataFetch.data);
  const hasMore = $derived(dataFetch.hasMore);
  const loadMore = dataFetch.loadMore;

  // Infinite scroll composable
  const { isLoading, onSentinelMount } = useInfiniteScroll({
    loadMore,
    enabled: () => hasMore,
  });
</script>

<div class="px-4">
  <DataTable data={watchlist} {columns} {onSentinelMount} {isLoading} />
</div>
