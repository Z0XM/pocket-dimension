<script lang="ts">
import type { ComponentProps } from "svelte";
import { goto } from "$app/navigation";
import { Button } from "$components/ui/button/index.js";
import * as Card from "$components/ui/card/index.js";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "$components/ui/field/index.js";
import { Input } from "$components/ui/input/index.js";
import { authClient } from "$lib/auth-client.js";

const id = $props.id();

let {
  signupRoute = "/sign-up",
  ...restProps
}: ComponentProps<typeof Card.Root> & { signupRoute: string } = $props();

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
    });

    if (result.error) {
      error = result.error.message || "Invalid email or password";
      loading = false;
      return;
    }

    // Redirect to list page on success
    await goto("/list");
  } catch (err) {
    error = err instanceof Error ? err.message : "An unexpected error occurred";
    loading = false;
  }
}
</script>

<Card.Root {...restProps} class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description>Enter your email below to login to your account</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit}>
			{#if error}
				<div class="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}
			<FieldGroup>
				<Field>
					<FieldLabel for="email-{id}">Email</FieldLabel>
					<Input
						id="email-{id}"
						type="email"
						placeholder="m@example.com"
						required
						bind:value={email}
						disabled={loading}
					/>
				</Field>
				<Field>
					<div class="flex items-center">
						<FieldLabel for="password-{id}">Password</FieldLabel>
						<a href="##" class="ms-auto inline-block text-sm underline">
							Forgot your password?
						</a>
					</div>
					<Input
						id="password-{id}"
						type="password"
						required
						bind:value={password}
						disabled={loading}
					/>
				</Field>
				<Field>
					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? "Logging in..." : "Login"}
					</Button>
					<!-- <Button variant="outline" class="w-full">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
							<path
								d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
								fill="currentColor"
							/>
						</svg>
						Login with Google
					</Button> -->
					<FieldDescription class="text-center">
						Don't have an account? <a href={signupRoute}>Sign up</a>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	</Card.Content>
</Card.Root>
