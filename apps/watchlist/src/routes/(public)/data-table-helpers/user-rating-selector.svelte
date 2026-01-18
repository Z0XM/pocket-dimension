<script lang="ts">
  import { UsersIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";

  type User = {
    id: string;
    username: string;
  };

  let allUsers = $state<User[]>([]);
  let selectedUserIds = $state<string[]>([]);
  let searchQuery = $state("");
  let isLoading = $state(true);
  let isSaving = $state(false);

  // Fetch all users and current preferences on mount
  $effect(() => {
    fetchData();
  });

  async function fetchData() {
    try {
      // Fetch users and preferences in parallel
      const [usersResponse, preferencesResponse] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/user-rating-preferences"),
      ]);

      if (!usersResponse.ok || !preferencesResponse.ok) {
        throw new Error("Failed to fetch data");
      }

      const usersData = await usersResponse.json();
      const preferencesData = await preferencesResponse.json();

      allUsers = usersData.users;
      selectedUserIds = preferencesData.preferredUserIds;
      isLoading = false;
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load users");
      isLoading = false;
    }
  }

  // Filter users based on search query
  const filteredUsers = $derived(
    allUsers.filter((user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  async function toggleUser(userId: string) {
    // Optimistically update UI
    const newSelection = selectedUserIds.includes(userId)
      ? selectedUserIds.filter((id) => id !== userId)
      : [...selectedUserIds, userId];

    selectedUserIds = newSelection;

    // Save to backend
    await savePreferences(newSelection);
  }

  async function savePreferences(userIds: string[]) {
    isSaving = true;
    try {
      const response = await fetch("/api/user-rating-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredUserIds: userIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      // Use SvelteKit navigation to reload data without full page refresh
      await goto(page.url.toString(), { invalidateAll: true });

      isSaving = false;
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save user selection");
      isSaving = false;

      // Revert optimistic update on error
      await fetchData();
    }
  }

  const selectedCount = $derived(selectedUserIds.length);
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="outline"
        class="hidden md:flex items-center gap-2 w-full sm:w-auto"
        disabled={isSaving}
      >
        <UsersIcon class="size-4" />
        Users
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="bg-white/1 backdrop-blur-md" align="end">
    <div class="p-0">
      <Input
        type="text"
        placeholder="Search users..."
        bind:value={searchQuery}
        class="mb-2"
      />

      {#if isLoading}
        <div class="text-center py-4 text-muted-foreground text-sm">
          Loading users...
        </div>
      {:else if filteredUsers.length === 0}
        <div class="text-center py-4 text-muted-foreground text-sm">
          {searchQuery ? "No users found" : "No users available"}
        </div>
      {:else}
        <div class="max-h-64 overflow-y-auto">
          {#each filteredUsers as user (user.id)}
            <DropdownMenu.CheckboxItem
              checked={selectedUserIds.includes(user.id)}
              onSelect={(e) => {
                e.preventDefault();
                toggleUser(user.id);
              }}
            >
              {user.username}
            </DropdownMenu.CheckboxItem>
          {/each}
        </div>
      {/if}
    </div>
  </DropdownMenu.Content>
</DropdownMenu.Root>
