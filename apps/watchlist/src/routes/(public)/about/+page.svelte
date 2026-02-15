<script lang="ts">
  import * as Card from "$lib/components/ui/card";
</script>

<div class="h-screen overflow-y-scroll pb-24">
  <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <!-- Page Title -->
    <div class="text-center space-y-2 mb-8">
      <h1 class="text-3xl font-medium">About</h1>
      <p class="text-muted-foreground text-sm">Code: Myurazaki</p>
    </div>

    <!-- Introduction Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Introduction</Card.Title>
      </Card.Header>
      <Card.Content>
        <p class="text-xs/relaxed text-muted-foreground">
          This is one of my hobby project to track and maintain a list of media with additional features enabled smooth operations for myself. Though
          this is free to use for anyone who wishes.
        </p>
        <p class="text-xs/relaxed text-muted-foreground mt-3">
          You may ask for contributor access via email. You need contributor access to add new media titles. This is not meant to be a replacement of
          rating platform like RottenTomatoes or Moctale, The primary goal of this app is to give a quick readable, searchable, sortable, viewable,
          configurable and easily shareable list of media with ratings as a feature. Thankyou!
        </p>
      </Card.Content>
    </Card.Root>

    <!-- Design Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Design</Card.Title>
      </Card.Header>
      <Card.Content>
        <p class="text-xs/relaxed text-muted-foreground">
          The theme and style of this app has its roots in the color purple (Myurazaki in japanese). The whole app has a glass and highlight inspired
          design system. A Major focus has been on UX hence there are small features to enhance user experience. The entire app has only 1 actionable
          page that is the home page following the goal of less navigations and more of data at once.
        </p>
      </Card.Content>
    </Card.Root>

    <!-- Features Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Features</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4">
        <!-- Core Features -->
        <div>
          <h3 class="text-xs font-medium mb-2">Core Features</h3>
          <ul class="text-xs/relaxed text-muted-foreground space-y-1 list-disc list-inside">
            <li>Search and filter media by title, language, tags, type, and progress status</li>
            <li>Sort by multiple columns with customizable sort order</li>
            <li>Infinite scroll for seamless browsing</li>
            <li>Column visibility settings - show or hide columns as needed</li>
            <li>Save and manage custom views with filters and sorting preferences</li>
            <li>Shareable URLs with query parameters for easy sharing</li>
            <li>User-specific rating columns for preferred users</li>
            <li>Responsive design optimized for desktop and mobile devices</li>
          </ul>
        </div>

        <!-- Mobile Limitations -->
        <div>
          <h3 class="text-xs font-medium mb-2">Mobile Limitations</h3>
          <p class="text-xs/relaxed text-muted-foreground mb-2">
            On mobile devices, only limited features are available. Mobile users have read-only access and can view, search, filter, and sort the
            watchlist, but cannot edit, add, or delete media items. For full functionality including editing capabilities, please use a desktop or
            tablet device.
          </p>
        </div>

        <!-- User Role Features -->
        <div>
          <h3 class="text-xs font-medium mb-2">User Features</h3>
          <ul class="text-xs/relaxed text-muted-foreground space-y-1 list-disc list-inside">
            <li>Rate media with custom ratings</li>
            <li>Mark media as "infinity" or "shitty"</li>
            <li>Track your progress status (watching, completed, etc.)</li>
            <li>View and manage your personal ratings</li>
            <li>Create and save custom views</li>
          </ul>
        </div>

        <!-- Contributor Role Features -->
        <div>
          <h3 class="text-xs font-medium mb-2">Contributor Features</h3>
          <ul class="text-xs/relaxed text-muted-foreground space-y-1 list-disc list-inside">
            <li>All user features, plus:</li>
            <li>Add new media titles to the watchlist</li>
            <li>Edit existing media information (title, language, type, tags)</li>
            <li>Bulk edit multiple items at once</li>
            <li>Manage tags and metadata</li>
          </ul>
        </div>

        <!-- Admin Role Features -->
        <div>
          <h3 class="text-xs font-medium mb-2">Admin Features</h3>
          <ul class="text-xs/relaxed text-muted-foreground space-y-1 list-disc list-inside">
            <li>All contributor features, plus:</li>
            <li>Delete media items from the watchlist</li>
            <li>Full access to all administrative functions</li>
          </ul>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Credits Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Credits</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4">
        <!-- Developer -->
        <div>
          <h3 class="text-xs font-medium mb-2">Developer</h3>
          <p class="text-xs/relaxed text-muted-foreground">
            <a href="mailto:mukulz2020@gmail.com" class="text-accent hover:underline">mukulz2020@gmail.com</a>
          </p>
          <p class="text-xs/relaxed text-muted-foreground mt-1">
            <a href="https://github.com/z0xm" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">github.com/z0xm</a>
          </p>
        </div>

        <!-- Project -->
        <div>
          <h3 class="text-xs font-medium mb-2">Project</h3>
          <p class="text-xs/relaxed text-muted-foreground">
            <a href="https://github.com/Z0XM/pocket-dimension" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline"
              >https://github.com/Z0XM/pocket-dimension</a
            >
          </p>
        </div>

        <!-- Tools -->
        <div>
          <h3 class="text-xs font-medium mb-2">Tools</h3>
          <p class="text-xs/relaxed text-muted-foreground">Figma, Cursor, Hostinger, Resend</p>
        </div>

        <!-- Stack -->
        <div>
          <h3 class="text-xs font-medium mb-2">Stack</h3>
          <p class="text-xs/relaxed text-muted-foreground">SvelteKit 5, Tailwind, Postgres, Better Auth</p>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>
