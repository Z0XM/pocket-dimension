<script lang="ts">
import { LoaderCircle } from "@lucide/svelte";
import { goto } from "$app/navigation";
import { Button } from "$components/ui/button/index.js";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "$components/ui/field/index.js";
import { Input } from "$components/ui/input/index.js";
import { authClient } from "$lib/auth-client.js";

const id = $props.id();

let email = $state("");
let password = $state("");
let error = $state<string | null>(null);
let loading = $state(false);

async function handleSubmit(e: SubmitEvent) {
  e.preventDefault();
  error = null;
  loading = true;

  try {
    const result = await authClient.signIn.email({
      email,
      password,
      rememberMe: true,
    });

    console.log(result);

    if (result.error) {
      error = result.error.message ?? "Unable to login";
      loading = false;
      return;
    }

    // Redirect to list page on success
    await goto("/");
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
      <h1 class="text-2xl font-bold">Welcome back</h1>
      <p class="text-muted-foreground text-balance">
        Login to your account
      </p>
    </div>
    <Field>
      <FieldLabel for="email-{id}">Email</FieldLabel>
      <Input id="email-{id}" type="email" placeholder="m@z0xm.com" bind:value={email} required disabled={loading} />
    </Field>
    <Field>
      <div class="flex items-center">
        <FieldLabel for="password-{id}">Password</FieldLabel>
        <a href="##" class="ms-auto text-sm underline-offset-2 hover:underline">
          Forgot your password?
        </a>
      </div>
      <Input id="password-{id}" type="password" bind:value={password} required disabled={loading} />
    </Field>
    <Field>
      <Button type="submit" disabled={loading}>
        {#if loading}
          <LoaderCircle class="animate-spin"/>
        {:else}
          Login
        {/if}
      </Button>
    </Field>
    <FieldDescription class="text-center">
      Don't have an account? <a href="/sign-up">Sign up</a>
    </FieldDescription>
  </FieldGroup>
</form>
