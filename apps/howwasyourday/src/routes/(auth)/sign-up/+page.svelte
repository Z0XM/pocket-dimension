<script lang="ts">
import { LoaderCircleIcon } from "@lucide/svelte";
import { goto } from "$app/navigation";
import { Button } from "$components/ui/button/index.js";
import * as Field from "$components/ui/field/index.js";
import { Input } from "$components/ui/input/index.js";
import { authClient } from "$lib/auth-client.js";

const id = $props.id();

let name = $state("");
let email = $state("");
let username = $state("");
let password = $state("");
let confirmPassword = $state("");
let error = $state<string | null>(null);
let loading = $state(false);

// Strong password regex: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

async function handleSubmit(e: SubmitEvent) {
  e.preventDefault();
  error = null;

  // Validate password confirmation
  if (password !== confirmPassword) {
    error = "Passwords do not match";
    return;
  }

  // Validate strong password pattern
  if (!strongPasswordRegex.test(password)) {
    error = "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character";
    return;
  }

  loading = true;

  try {
    const result = await authClient.signUp.email({
      email,
      password,
      name,
      username,
      callbackURL: `${window.location.origin}/verify-email`,
    });

    if (result.error) {
      error = result.error.message ?? "Failed to create account. Please try again.";
      loading = false;
      return;
    }

    // Redirect to check-email page on success
    await goto(`/check-email?type=signup&email=${encodeURIComponent(email)}`);
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
  <Field.Group>
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">Create your account</h1>
      <p class="text-muted-foreground text-sm text-balance">
        Enter your email below to create your account
      </p>
    </div>
    <Field.Field>
      <Field.Label for="email-{id}">Email</Field.Label>
      <Input
        id="email-{id}"
        type="email"
        placeholder="m@z0xm.com"
        required
        bind:value={email}
        disabled={loading}
      />
      <Field.Description>
        We'll use this to contact you. We will not share your email with anyone
        else.
      </Field.Description>
    </Field.Field>
    <Field.Field>
      <Field.Field class="grid grid-cols-2 gap-4">
        <Field.Field>
          <Field.Label for="name-{id}">Name</Field.Label>
          <Input
            id="name-{id}"
            type="text"
            required
            bind:value={name}
            disabled={loading}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="username-{id}">Username</Field.Label>
          <Input
            id="username-{id}"
            type="text"
            required
            bind:value={username}
            disabled={loading}
          />
        </Field.Field>
      </Field.Field>
    </Field.Field>
    <Field.Field>
      <Field.Field class="grid grid-cols-2 gap-4">
        <Field.Field>
          <Field.Label for="password-{id}">Password</Field.Label>
          <Input
            id="password-{id}"
            type="password"
            required
            bind:value={password}
            disabled={loading}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="confirm-password-{id}">Confirm Password</Field.Label
          >
          <Input
            id="confirm-password-{id}"
            type="password"
            required
            bind:value={confirmPassword}
            disabled={loading}
          />
        </Field.Field>
      </Field.Field>
      <Field.Description>Choose a strong password.</Field.Description>
    </Field.Field>
    <Field.Field>
      <Button type="submit" disabled={loading}>
        {#if loading}
          <LoaderCircleIcon class="animate-spin" />
        {:else}
          Create Account
        {/if}
      </Button>
    </Field.Field>
    <Field.Description class="text-center">
      Already have an account? <a href="/login">Sign in</a>
    </Field.Description>
  </Field.Group>
</form>
