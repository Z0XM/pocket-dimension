<script lang="ts">
  import { CircleCheckIcon, CircleXIcon } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "$components/ui/button/index.js";

  // Get error query parameter
  const error = $derived(page.url.searchParams.get("error"));

  // Map error codes to user-friendly messages
  function getErrorMessage(errorCode: string | null): string {
    if (!errorCode) return "";

    const errorMessages: Record<string, string> = {
      token_expired: "This verification link has expired. Please request a new verification email.",
      token_invalid: "This verification link is invalid. Please request a new verification email.",
      token_already_used: "This verification link has already been used. Your email may already be verified.",
      user_not_found: "User account not found. Please sign up again.",
      email_already_verified: "This email address has already been verified.",
      unknown: "An error occurred during verification. Please try again.",
    };

    return errorMessages[errorCode] ?? errorMessages.unknown;
  }

  const errorMessage = $derived(getErrorMessage(error));
  const hasError = $derived(!!error);
</script>

<div class="p-6 md:p-8">
  <div class="flex flex-col items-center gap-6 text-center">
    {#if hasError}
      <!-- Error State -->
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <CircleXIcon class="h-8 w-8 text-destructive" />
      </div>
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold">Verification Failed</h1>
        <p class="text-muted-foreground text-sm text-balance">
          {errorMessage}
        </p>
      </div>
      <div class="flex flex-col gap-3 w-full">
        <Button onclick={() => goto("/login")} class="w-full py-4">Go to Login</Button>
        <Button onclick={() => goto("/sign-up")} class="w-full py-4" variant="outline">Sign Up</Button>
      </div>
    {:else}
      <!-- Success State -->
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <CircleCheckIcon class="h-8 w-8 text-primary" />
      </div>
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold">Email Verified!</h1>
        <p class="text-muted-foreground text-sm text-balance">Your email has been verified successfully. You can now access all features.</p>
      </div>
      <div class="flex flex-col gap-3 w-full">
        <Button onclick={() => goto("/")} class="w-full py-4">Continue to App</Button>
        <Button onclick={() => window.close()} class="w-full py-4" variant="outline">Close Window</Button>
      </div>
    {/if}
  </div>
</div>
