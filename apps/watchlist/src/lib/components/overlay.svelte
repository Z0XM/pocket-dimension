<script lang="ts">
  import {
    CheckIcon,
    ChevronDownIcon,
    CircleQuestionMarkIcon,
    CopyIcon,
    LoaderCircleIcon,
    LogInIcon,
    MenuIcon,
    PenLineIcon,
    PlusIcon,
    StarIcon,
    TrashIcon,
    UserRoundIcon,
    XIcon,
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import LogoutButton from "$components/logout-button.svelte";
  import * as AlertDialog from "$components/ui/alert-dialog";
  import { Badge } from "$components/ui/badge";
  import { Button } from "$components/ui/button";
  import * as DropdownMenu from "$components/ui/dropdown-menu";
  import { Input } from "$components/ui/input";
  import icon from "$lib/assets/icon.svg";
  import { authClient } from "$lib/auth-client";

  const session = authClient.useSession();

  let isPending = $derived($session.isPending);
  let user = $derived($session.data?.user);
  let role = $derived((user as any)?.role as "admin" | "contributor" | "user");
  let isEmailVerified = $derived(!!(user as any)?.emailVerified);

  // Mobile detection - check if window width is less than 768px (md breakpoint)
  let isMobile = $state(false);

  // Update mobile state on mount and resize
  $effect(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  // Effective role: force "mobile" role on mobile devices
  const effectiveRole = $derived(isMobile ? "mobile" : role);

  let mobileMenuOpen = $state(false);

  type View = {
    id: string;
    name: string;
    href: string;
    isFavorite: boolean;
    favoriteDate: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    isDefault?: boolean; // Mark default views
  };

  // Default views available to all users
  const defaultViews: View[] = [
    {
      id: "default-watchlist",
      name: "Watchlist",
      href: "/",
      isFavorite: false,
      favoriteDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
    },
    {
      id: "default-watch-later",
      name: "Watch Later",
      href: "/?filterProgress=watch_later",
      isFavorite: false,
      favoriteDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
    },
    {
      id: "default-watching",
      name: "Watching",
      href: "/?filterProgress=watching",
      isFavorite: false,
      favoriteDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
    },
  ];

  let views = $state<View[]>([]);
  let isLoadingViews = $state(false);
  let selectedViewName = $state<string | null>(defaultViews[0].name);
  let isManualSelection = $state(false); // Track manual selections to prevent override
  let isEditingName = $state(false);
  let editedName = $state("");
  let nameInputRef: HTMLInputElement | null = $state(null);
  let deleteDialogOpen = $state(false);
  let viewToDelete = $state<string | null>(null);
  let selectedView = $derived.by(() => {
    const allViews = [...defaultViews, ...views];
    return allViews.find((v) => v.name === selectedViewName) || defaultViews[0];
  });

  // Computed: all views excluding selected view
  let allViewsExcludingSelected = $derived.by(() => {
    return [...defaultViews, ...views].filter((v) => v.name !== selectedViewName);
  });

  // Computed: default views and favorite views to display (excluding selected)
  let defaultAndFavoriteViews = $derived.by(() => {
    const allViews = [...defaultViews, ...views];
    return allViews.filter((v) => {
      // Exclude selected view
      if (v.name === selectedViewName) return false;
      // Include default views
      if (v.isDefault) return true;
      // Include favorite views
      if (v.isFavorite) return true;
      return false;
    });
  });

  // Computed: remaining views (non-default, non-favorite, excluding selected)
  let remainingViews = $derived.by(() => {
    const allViews = [...defaultViews, ...views];
    return allViews.filter((v) => {
      // Exclude selected view
      if (v.name === selectedViewName) return false;
      // Exclude default views
      if (v.isDefault) return false;
      // Exclude favorite views
      if (v.isFavorite) return false;
      return true;
    });
  });

  // Fetch views on mount and when user changes
  $effect(() => {
    if (user && !isPending) {
      fetchViews();
    } else if (!user) {
      views = [];
    }
  });

  async function fetchViews() {
    if (!user || !isEmailVerified) return;

    isLoadingViews = true;
    try {
      const response = await fetch("/api/views");
      if (response.ok) {
        const data = await response.json();
        views = data.views || [];

        // Determine selected view based on current URL (only if not manually selected)
        if (!isManualSelection) {
          const allViews = [...defaultViews, ...views];
          const currentUrl = page.url.search;
          const currentPath = page.url.pathname;

          // Check if current URL matches a default view or user view
          const matchingView = allViews.find((v) => {
            if (v.href === "/" && currentPath === "/" && !currentUrl) return true;
            return v.href === `/${currentUrl}`;
          });

          selectedViewName = matchingView?.name || defaultViews[0].name;
        }
      }
    } catch (error) {
      console.error("Error fetching views:", error);
    } finally {
      isLoadingViews = false;
    }
  }

  function isDefaultView(viewName: string | null): boolean {
    if (!viewName) return false;
    return defaultViews.some((v) => v.name === viewName);
  }

  async function handleSave() {
    if (!user || !selectedViewName || isDefaultView(selectedViewName)) return;

    // Extract current filters from URL
    const currentUrl = page.url;
    const filterLanguage = currentUrl.searchParams.get("filterLanguage") || "";
    const filterTags = currentUrl.searchParams.get("filterTags") || "";
    const filterProgress = currentUrl.searchParams.get("filterProgress") || "";
    const filterType = currentUrl.searchParams.get("filterType") || "";
    const sortBy = currentUrl.searchParams.get("sortBy") || "";
    const sortOrder = currentUrl.searchParams.get("sortOrder") || "";
    const q = currentUrl.searchParams.get("q") || "";

    // Build filters object
    const filters: Record<string, string> = {};
    if (filterLanguage) filters.filterLanguage = filterLanguage;
    if (filterTags) filters.filterTags = filterTags;
    if (filterProgress) filters.filterProgress = filterProgress;
    if (filterType) filters.filterType = filterType;
    if (sortBy) filters.sortBy = sortBy;
    if (sortOrder) filters.sortOrder = sortOrder;
    if (q) filters.q = q;

    try {
      const response = await fetch(`/api/views/${encodeURIComponent(selectedViewName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (response.ok) {
        await fetchViews();
        toast.success("View saved successfully");
      } else {
        const error = await response.json();
        console.error("Error saving view:", error);
        toast.error(error.error || "Failed to save view");
      }
    } catch (error) {
      console.error("Error saving view:", error);
      toast.error("Failed to save view");
    }
  }

  async function handleCreate() {
    if (!user) return;

    // Build URL with current filters
    const currentUrl = page.url.toString();
    const urlObj = new URL(currentUrl);

    try {
      const response = await fetch(`/api/views${urlObj.search}`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        await fetchViews();
        toast.success(`View "${data.view?.name || "View"}" created successfully`);
      } else {
        const error = await response.json();
        console.error("Error creating view:", error);
        toast.error(error.error || "Failed to create view");
      }
    } catch (error) {
      console.error("Error creating view:", error);
      toast.error("Failed to create view");
    }
  }

  function openDeleteDialog() {
    if (!user || !selectedViewName || isDefaultView(selectedViewName)) return;
    viewToDelete = selectedViewName;
    deleteDialogOpen = true;
  }

  async function handleDelete() {
    if (!user || !viewToDelete || isDefaultView(viewToDelete)) return;

    const viewNameToDelete = viewToDelete;

    try {
      const response = await fetch(`/api/views/${encodeURIComponent(viewNameToDelete)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        selectedViewName = defaultViews[0].name;
        await fetchViews();
        deleteDialogOpen = false;
        viewToDelete = null;
        toast.success(`View "${viewNameToDelete}" deleted successfully`);
      } else {
        const error = await response.json();
        console.error("Error deleting view:", error);
        toast.error(error.error || "Failed to delete view");
      }
    } catch (error) {
      console.error("Error deleting view:", error);
      toast.error("Failed to delete view");
    }
  }

  function startEditingName() {
    if (!selectedViewName || isDefaultView(selectedViewName)) return;
    isEditingName = true;
    editedName = selectedViewName;
    // Focus input after it's rendered
    setTimeout(() => {
      nameInputRef?.focus();
      nameInputRef?.select();
    }, 0);
  }

  function cancelEditingName() {
    isEditingName = false;
    editedName = "";
  }

  async function saveName() {
    if (!user || !selectedViewName || isDefaultView(selectedViewName) || !editedName.trim()) {
      cancelEditingName();
      return;
    }

    const trimmedName = editedName.trim();

    // Don't update if name hasn't changed
    if (trimmedName === selectedViewName) {
      cancelEditingName();
      return;
    }

    try {
      const response = await fetch(`/api/views/${encodeURIComponent(selectedViewName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (response.ok) {
        selectedViewName = trimmedName;
        await fetchViews();
        isEditingName = false;
        editedName = "";
        toast.success("View name updated successfully");
      } else {
        const error = await response.json();
        console.error("Error updating view name:", error);
        toast.error(error.error || "Failed to update view name");
      }
    } catch (error) {
      console.error("Error updating view name:", error);
      toast.error("Failed to update view name");
    }
  }

  function handleNameInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditingName();
    }
  }

  function handleClear() {
    if (!selectedView) return;
    // Navigate to the view's original href to restore filters
    isManualSelection = true;
    goto(selectedView.href);
  }

  async function handleCopyUrl() {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      toast.success("Copied!");
    } catch (error) {
      console.error("Error copying URL to clipboard:", error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = window.location.href;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success("Copied!");
      } catch (err) {
        console.error("Fallback copy failed:", err);
        toast.error("Failed to copy URL");
      }
      document.body.removeChild(textArea);
    }
  }

  // Update selected view when URL changes (but respect manual selections)
  $effect(() => {
    const allViews = [...defaultViews, ...views];
    const currentUrl = page.url.search;
    const currentPath = page.url.pathname;

    // Check if current URL matches a default view or user view
    const matchingView = allViews.find((v) => {
      // Normalize hrefs for comparison
      const viewHref = v.href === "/" ? "/" : v.href;
      const currentHref = currentUrl ? `/${currentUrl}` : "/";

      // Match root path (no query params)
      if (viewHref === "/" && currentPath === "/" && !currentUrl) return true;

      // Match with query params
      if (viewHref.startsWith("/?")) {
        return viewHref === currentHref;
      }

      // Match exact path
      return viewHref === currentPath || viewHref === currentHref;
    });

    // Only update if:
    // 1. We found a matching view AND
    // 2. Either it's not a manual selection OR the matching view is different from current selection
    if (matchingView) {
      // If manual selection is active, check if the URL actually matches the selected view
      if (isManualSelection) {
        const selectedViewObj = allViews.find((v) => v.name === selectedViewName);
        // If the URL matches the manually selected view, clear the flag
        if (selectedViewObj && matchingView.name === selectedViewObj.name) {
          isManualSelection = false;
        }
        // Otherwise, respect the manual selection for a bit longer
        return;
      }

      // Update selection if it's different
      if (matchingView.name !== selectedViewName) {
        selectedViewName = matchingView.name;
      }
    } else if (!isManualSelection) {
      // If no match and not manual selection, default to Watchlist
      selectedViewName = defaultViews[0].name;
    }
  });
</script>

<div class="p-4 pt-8 px-4 sm:px-8 md:px-16 md:justify-between items-center flex md:flex-row gap-4 md:gap-8">
  {#if !page.route.id?.startsWith("/(auth)/")}
    <div class="flex items-center gap-4 md:gap-8 w-full md:w-auto md:justify-start">
      <div class="flex items-center gap-2">
        <img src={icon} alt="Watchlist" class="size-6" />
        {#if isEditingName && !isDefaultView(selectedViewName)}
          <Input
            bind:ref={nameInputRef}
            value={editedName}
            oninput={(e) => {
              editedName = (e.currentTarget as HTMLInputElement).value;
            }}
            onkeydown={handleNameInputKeydown}
            class="text-xl font-bold h-auto py-1 px-2"
            onblur={() => {
              // Don't auto-save on blur, let user click check icon
            }}
          />
          <Button variant="ghost" size="icon" class="h-6 w-6 hover:text-accent" onclick={saveName} title="Save name">
            <CheckIcon class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" class="h-6 w-6 hover:text-accent" onclick={cancelEditingName} title="Cancel">
            <XIcon class="size-4" />
          </Button>
        {:else}
          <a href={selectedView?.href || "/"} class="text-xl font-bold hover:underline">{selectedView?.name || "Watchlist"}</a>
          <a href="/about" class="inline-flex items-center justify-center h-6 w-6 hover:text-accent transition-colors" title="About">
            <CircleQuestionMarkIcon class="size-4" />
          </a>
          {#if !isDefaultView(selectedViewName) && user}
            <Button variant="ghost" size="icon" class="h-6 w-6 hover:text-accent" onclick={startEditingName} title="Edit view name">
              <PenLineIcon class="size-4" />
            </Button>
          {/if}
        {/if}
      </div>
      <!-- Desktop: Show badges for default/favorite views, dropdown for remaining -->
      {#if user}
        <div class="hidden md:flex items-end gap-2">
          {#each defaultAndFavoriteViews as view}
            <a
              href={view.href}
              class=""
              onclick={(e) => {
                e.preventDefault();
                isManualSelection = true;
                selectedViewName = view.name;
                goto(view.href);
              }}
            >
              <Badge variant="outline" class="border-primary border-px text-primary hover:border-accent">{view.name}</Badge>
            </a>
          {/each}
          {#if remainingViews.length > 0}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button
                    variant="outline"
                    size="icon"
                    {...props}
                    class="flex items-center justify-center size-5 rounded-full"
                    aria-label="View Menu"
                  >
                    <ChevronDownIcon class="size-4" />
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content class="bg-white/1 backdrop-blur-md" align="end">
                {#each remainingViews as view}
                  <DropdownMenu.Item class="flex items-center justify-between text-[0.625rem] gap-1 py-0 cursor-default">
                    <a
                      href={view.href}
                      class="flex-1"
                      onclick={(e) => {
                        e.preventDefault();
                        isManualSelection = true;
                        selectedViewName = view.name;
                        goto(view.href);
                      }}
                    >
                      {view.name}
                    </a>
                    {#if !view.isDefault}
                      <Button
                        variant="ghost"
                        size="icon"
                        class="dark:hover:bg-transparent p-0 group"
                        onclick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!user) return;
                          const viewName = view.name; // Capture view name before async operation
                          const isCurrentlyFavorite = view.isFavorite;
                          try {
                            const response = await fetch(`/api/views/${encodeURIComponent(viewName)}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                setFavorite: !isCurrentlyFavorite,
                              }),
                            });
                            if (response.ok) {
                              await fetchViews();
                              toast.success(isCurrentlyFavorite ? `Removed "${viewName}" from favorites` : `Added "${viewName}" to favorites`);
                            } else {
                              const error = await response.json();
                              console.error("Error setting favorite:", error);
                              toast.error(error.error || "Failed to update favorite");
                            }
                          } catch (error) {
                            console.error("Error setting favorite:", error);
                            toast.error("Failed to update favorite");
                          }
                        }}
                      >
                        <StarIcon
                          class={`size-3.5 ${view.isFavorite ? "fill-primary" : "fill-transparent"} group-dark:hover:fill-primary group-hover:fill-primary`}
                        />
                      </Button>
                    {/if}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          {/if}
        </div>
      {/if}

      <!-- Mobile: Show all views in dropdown -->
      {#if user}
        <div class="md:hidden">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button variant="outline" size="icon" {...props} class="flex items-center justify-center size-5 rounded-full" aria-label="View Menu">
                  <ChevronDownIcon class="size-4" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content class="bg-white/1 backdrop-blur-md" align="end">
              {#each (() => {
                return [...defaultViews, ...views].filter((v) => v.name !== selectedViewName);
              })() as view}
                <DropdownMenu.Item class="flex items-center text-[0.625rem] gap-1 py-0 cursor-default">
                  <a
                    href={view.href}
                    class="flex-1"
                    onclick={(e) => {
                      e.preventDefault();
                      isManualSelection = true;
                      selectedViewName = view.name;
                      goto(view.href);
                    }}
                  >
                    {view.name}
                  </a>
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      {/if}
      <!-- Desktop: Show action buttons -->
      <div class="hidden md:flex items-end gap-2">
        {#if user}
          <Button
            variant="outline"
            class="text-[0.625rem] border-green-500/30 dark:hover:bg-green-950"
            onclick={handleSave}
            disabled={!selectedViewName || !user || isDefaultView(selectedViewName)}
            title="Save view"
          >
            Save
          </Button>
          <Button
            variant="outline"
            class="text-[0.625rem] border-red-500/30 dark:hover:bg-red-950"
            title="Clear Filters"
            onclick={handleClear}
            disabled={!selectedView}
          >
            Clear
          </Button>
          <Button
            variant="outline"
            class="text-blue-600 border-blue-500/30 hover:text-blue-700 dark:hover:bg-blue-950"
            onclick={handleCreate}
            disabled={!user || isLoadingViews}
            title="New view"
          >
            <PlusIcon />
          </Button>
          <Button
            variant="outline"
            class="text-red-600 border-red-500/30 hover:text-red-700  dark:hover:bg-red-950"
            onclick={openDeleteDialog}
            disabled={!selectedViewName || !user || isDefaultView(selectedViewName)}
            title="Delete view"
          >
            <TrashIcon />
          </Button>
        {/if}
        <Button variant="outline" class="" onclick={handleCopyUrl} title="Share">
          <CopyIcon />
        </Button>
      </div>

      <!-- Mobile: Show copy button only (CRUD buttons hidden on mobile) -->
      <div class="md:hidden">
        <Button variant="outline" size="icon" onclick={handleCopyUrl} title="Copy URL" class="flex items-center justify-center">
          <CopyIcon class="size-4" />
        </Button>
      </div>
    </div>
  {/if}

  <!-- Desktop menu - hidden on mobile/tablet -->
  <div class="hidden md:flex items-center gap-2">
    {#if role === "admin" || role === "contributor"}
      <Badge variant="outline" class="border-accent">
        {role[0].toUpperCase() + role.slice(1)}
      </Badge>
    {/if}
    {#if user}
      <Button variant="outline" class="flex items-center gap-2">
        <UserRoundIcon size={16} />
        {user.username}
      </Button>
      <LogoutButton class="" />
    {/if}
    {#if !isPending && !user && !page.route.id?.startsWith("/(auth)/")}
      <Button variant="outline" class="flex items-center gap-2" onclick={() => goto("/login")}>
        <LogInIcon size={16} class="text-accent" /> Login
      </Button>
    {/if}
    {#if isPending && !page.route.id?.startsWith("/(auth)/")}
      <Button variant="outline" class="flex items-center gap-2">
        <LoaderCircleIcon size={16} class="animate-spin" /> Loading...
      </Button>
    {/if}
  </div>

  <!-- Mobile/Tablet kebab menu - visible only on mobile/tablet -->
  <div class="md:hidden">
    <DropdownMenu.Root bind:open={mobileMenuOpen}>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" size="icon" {...props} class="flex items-center justify-center" aria-label="User Menu">
            <MenuIcon size={20} />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="bg-white/1 backdrop-blur-md" align="end">
        {#if effectiveRole === "mobile"}
          <div class="px-2 py-1.5">
            <Badge variant="outline" class="border-accent">Mobile</Badge>
          </div>
        {:else if role === "admin" || role === "contributor"}
          <div class="px-2 py-1.5">
            <Badge variant="outline" class="border-accent">
              {role[0].toUpperCase() + role.slice(1)}
            </Badge>
          </div>
        {/if}
        {#if user}
          <DropdownMenu.Item class="flex items-center gap-2 cursor-default">
            <UserRoundIcon size={16} />
            <span>{user.username}</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <div class="px-2 py-1">
            <LogoutButton class="" />
          </div>
        {/if}
        {#if !isPending && !user && !page.route.id?.startsWith("/(auth)/")}
          <DropdownMenu.Item
            class="flex items-center gap-2 cursor-pointer"
            onSelect={() => {
              mobileMenuOpen = false;
              goto("/login");
            }}
          >
            <LogInIcon size={16} class="text-accent" />
            <span>Login</span>
          </DropdownMenu.Item>
        {/if}
        {#if isPending && !page.route.id?.startsWith("/(auth)/")}
          <DropdownMenu.Item class="flex items-center gap-2 cursor-default">
            <LoaderCircleIcon size={16} class="animate-spin" />
            <span>Loading...</span>
          </DropdownMenu.Item>
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay />
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Delete View</AlertDialog.Title>
        <AlertDialog.Description>
          Are you sure you want to delete "{viewToDelete}"? This action cannot be undone.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel
          class="dark:hover:bg-white/70 dark:bg-gray-200 text-black hover:text-black"
          onclick={() => {
            viewToDelete = null;
          }}>Cancel</AlertDialog.Cancel
        >
        <AlertDialog.Action onclick={handleDelete} class="dark:bg-rose-500 dark:hover:bg-rose-800">Delete</AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
