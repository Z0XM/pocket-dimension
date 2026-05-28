<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const error = $derived(page.url.searchParams.get("error"));

  function getErrorMessage(errorCode: string | null): string {
    if (!errorCode) return "";

    const errorMessages: Record<string, string> = {
      token_expired: "This verification link has expired. Request a new verification email.",
      token_invalid: "This verification link is invalid. Request a new verification email.",
      token_already_used: "This link was already used. Your email may already be verified.",
      user_not_found: "User account not found. Please sign up again.",
      email_already_verified: "This email address is already verified.",
      unknown: "Verification failed. Please try again.",
    };

    return errorMessages[errorCode] ?? errorMessages.unknown;
  }

  const errorMessage = $derived(getErrorMessage(error));
  const hasError = $derived(!!error);
</script>

<div class="p-6 md:p-8">
  <div class="flex flex-col items-center gap-6 text-center">
    {#if hasError}
      <div class="flex flex-col gap-2">
        <h1 class="font-heading text-2xl font-bold">Verification failed</h1>
        <p class="text-balance text-sm text-muted-foreground">{errorMessage}</p>
      </div>
      <div class="flex w-full flex-col gap-3">
        <button
          type="button"
          class="w-full rounded border border-border bg-secondary px-4 py-3 text-sm font-medium hover:bg-muted"
          onclick={() => goto("/login")}
        >
          Go to sign in
        </button>
        <button
          type="button"
          class="w-full rounded border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted"
          onclick={() => goto("/sign-up")}
        >
          Sign up
        </button>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        <h1 class="font-heading text-2xl font-bold">Email verified</h1>
        <p class="text-balance text-sm text-muted-foreground">You can continue to Chhan Chhan.</p>
      </div>
      <div class="flex w-full flex-col gap-3">
        <button
          type="button"
          class="w-full rounded border border-border bg-secondary px-4 py-3 text-sm font-medium hover:bg-muted"
          onclick={() => goto("/app")}
        >
          Open app
        </button>
        <button
          type="button"
          class="w-full rounded border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted"
          onclick={() => window.close()}
        >
          Close window
        </button>
      </div>
    {/if}
  </div>
</div>
