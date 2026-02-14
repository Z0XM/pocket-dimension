<script lang="ts">
import { page } from "$app/state";
import { authClient } from "$lib/auth-client";
import type { PageProps } from "./$types";
import { columns, createUserRatingColumns, type Watchlist } from "./columns";
import DataTable from "./data-table.svelte";
import { useDataFetch } from "./data-table-helpers/data-fetch.svelte";
import { useInfiniteScroll } from "./data-table-helpers/infinite-scroll.svelte";

let { data }: PageProps = $props();

// Check if user is signed in and verified
const session = authClient.useSession();
const isSignedIn = $derived(!!$session.data?.user);
const isEmailVerified = $derived(!!($session.data?.user as any)?.emailVerified);

// Get preferred users from server data
const preferredUsers = $derived((data as any)?.preferredUsers ?? []);

// Create dynamic user rating columns
const userRatingColumns = $derived(preferredUsers.length > 0 ? createUserRatingColumns(preferredUsers.map((u: any) => u.username)) : []);

// Combine static columns with dynamic user rating columns
// User rating columns should appear after avg_rating but before actions column
const allColumns = $derived(() => {
  const staticCols = [...columns];
  const actionsCol = staticCols.pop(); // Remove actions column
  // Insert user rating columns after all static columns (which includes avg_rating)
  const combinedCols = [...staticCols, ...userRatingColumns];
  if (actionsCol) {
    combinedCols.push(actionsCol); // Add actions column back at the end
  }
  return combinedCols;
});

// Filter columns to exclude "my_rating" and "my_progress_status" if user is not signed in
const filteredColumns = $derived(
  isSignedIn
    ? allColumns()
    : allColumns().filter((col) => {
        const id = "id" in col ? col.id : null;
        const accessorKey = "accessorKey" in col ? col.accessorKey : null;
        return id !== "my_rating" && accessorKey !== "my_rating" && id !== "my_progress_status" && accessorKey !== "my_progress_status";
      })
);

// Get search query, sorting, and filters from URL
const searchQuery = $derived(page.url.searchParams.get("q"));
const sortBy = $derived(page.url.searchParams.get("sortBy"));
const sortOrder = $derived(page.url.searchParams.get("sortOrder"));
const filterLanguage = $derived(page.url.searchParams.get("filterLanguage"));
const filterTags = $derived(page.url.searchParams.get("filterTags"));
const filterProgress = $derived(page.url.searchParams.get("filterProgress"));
const filterType = $derived(page.url.searchParams.get("filterType"));

// Data fetching composable
const dataFetch = useDataFetch<Watchlist>({
  initialData: () => (data as any)?.watchItems ?? [],
  fetchUrl: (pageIndex, searchQuery, sortBy, sortOrder, filterLanguage, filterTags, filterProgress, filterType) => {
    const url = new URL("/api/watchlist", page.url.origin);
    url.searchParams.set("pageIndex", pageIndex.toString());
    if (searchQuery) {
      url.searchParams.set("q", searchQuery);
    }
    if (sortBy) {
      url.searchParams.set("sortBy", sortBy);
      if (sortOrder) {
        url.searchParams.set("sortOrder", sortOrder);
      }
    }
    if (filterLanguage) {
      url.searchParams.set("filterLanguage", filterLanguage);
    }
    if (filterTags) {
      url.searchParams.set("filterTags", filterTags);
    }
    if (filterProgress) {
      url.searchParams.set("filterProgress", filterProgress);
    }
    if (filterType) {
      url.searchParams.set("filterType", filterType);
    }
    return url.pathname + url.search;
  },
  pageSize: 25,
  searchQuery: () => searchQuery,
  sortBy: () => sortBy,
  sortOrder: () => sortOrder,
  filterLanguage: () => filterLanguage,
  filterTags: () => filterTags,
  filterProgress: () => filterProgress,
  filterType: () => filterType,
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

<div class="md:px-4">
  <DataTable
    data={watchlist}
    columns={filteredColumns}
    {onSentinelMount}
    {isLoading}
    userRole={(data as any)?.userRole}
    {isEmailVerified}
    filterOptions={{
      languages: (data as any)?.languages ?? [],
      tags: (data as any)?.tags ?? [],
      progressStatuses: (data as any)?.progressStatuses ?? [],
      types: (data as any)?.types ?? [],
      allLanguages: (data as any)?.allLanguages ?? [],
      allTags: (data as any)?.allTags ?? [],
      allTypes: (data as any)?.allTypes ?? [],
    }}
  />
</div>
