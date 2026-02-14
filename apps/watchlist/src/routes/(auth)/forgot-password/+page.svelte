<script lang="ts">
import { KeyIcon, LoaderCircleIcon } from "@lucide/svelte";
import { goto } from "$app/navigation";
import { Button } from "$components/ui/button/index.js";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "$components/ui/field/index.js";
import { Input } from "$components/ui/input/index.js";
import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";

const id = $props.id();

let email = $state("");
let error = $state<string | null>(null);
let loading = $state(false);

async function handleSubmit(e: SubmitEvent) {
  e.preventDefault();
  error = null;
  loading = true;

  try {
    const response = await fetch(`${PUBLIC_BASE_AUTH_URL}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      error = data.message ?? data.error ?? "Failed to send reset email. Please try again.";
      loading = false;
      return;
    }

    // Redirect to check-email page
    await goto(`/check-email?type=forgot&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error(err);
    error = "Something went wrong!";
    loading = false;
  }
}
</script>

<form class="p-6 md:p-8" onsubmit={handleSubmit}>
  {#if error}
    <div class="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
      {error}
    </div>
  {/if}

  <FieldGroup>
    <div class="flex flex-col items-center gap-2 text-center">
      <div
        class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2"
      >
        <KeyIcon class="h-6 w-6 text-primary" />
      </div>
      <h1 class="text-2xl font-bold">Forgot Password?</h1>
      <p class="text-muted-foreground text-sm text-balance">
        Enter your email address and we'll send you a link to reset your
        password.
      </p>
    </div>

    <Field>
      <FieldLabel for="email-{id}">Email</FieldLabel>
      <Input
        id="email-{id}"
        type="email"
        placeholder="m@z0xm.com"
        bind:value={email}
        required
        disabled={loading}
      />
      <FieldDescription>
        We'll send a password reset link to this email.
      </FieldDescription>
    </Field>

    <Field>
      <Button type="submit" disabled={loading} class="w-full">
        {#if loading}
          <LoaderCircleIcon class="animate-spin mr-2" />
          Sending...
        {:else}
          Send Reset Link
        {/if}
      </Button>
    </Field>

    <FieldDescription class="text-center">
      Remember your password? <a href="/login">Sign in</a>
    </FieldDescription>
  </FieldGroup>
</form>
