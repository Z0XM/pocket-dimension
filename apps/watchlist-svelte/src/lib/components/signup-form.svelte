<script lang="ts">
import type { ComponentProps } from "svelte";
import { goto } from "$app/navigation";
import { Button } from "$components/ui/button/index.js";
import * as Card from "$components/ui/card/index.js";
import * as Field from "$components/ui/field/index.js";
import { Input } from "$components/ui/input/index.js";
import { authClient } from "$lib/auth-client.js";

let {
  loginRoute = "/login",
  ...restProps
}: ComponentProps<typeof Card.Root> & { loginRoute: string } = $props();

let name = $state("");
let email = $state("");
let username = $state("");
let password = $state("");
let confirmPassword = $state("");
let error = $state<string | null>(null);
let loading = $state(false);

async function handleSubmit(e: SubmitEvent) {
  e.preventDefault();
  error = null;

  // Validate password confirmation
  if (password !== confirmPassword) {
    error = "Passwords do not match";
    return;
  }

  // Validate password length
  if (password.length < 8) {
    error = "Password must be at least 8 characters long";
    return;
  }

  loading = true;

  try {
    const result = await authClient.signUp.email({
      email,
      password,
      name,
      username,
    });

    if (result.error) {
      error = result.error.message || "Failed to create account. Please try again.";
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

<Card.Root {...restProps}>
	<Card.Header>
		<Card.Title>Create an account</Card.Title>
		<Card.Description>Enter your information below to create your account</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit}>
			{#if error}
				<div class="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}
			<Field.Group>
				<Field.Field>
					<Field.Label for="name">Full Name</Field.Label>
					<Input
						id="name"
						type="text"
						placeholder="John Doe"
						required
						bind:value={name}
						disabled={loading}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="email">Email</Field.Label>
					<Input
						id="email"
						type="email"
						placeholder="m@example.com"
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
					<Field.Label for="username">Username</Field.Label>
					<Input
						id="username"
						type="text"
						placeholder="john_doe"
						required
						bind:value={username}
						disabled={loading}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="password">Password</Field.Label>
					<Input
						id="password"
						type="password"
						required
						bind:value={password}
						disabled={loading}
					/>
					<Field.Description>Must be at least 8 characters long.</Field.Description>
				</Field.Field>
				<Field.Field>
					<Field.Label for="confirm-password">Confirm Password</Field.Label>
					<Input
						id="confirm-password"
						type="password"
						required
						bind:value={confirmPassword}
						disabled={loading}
					/>
					<Field.Description>Please confirm your password.</Field.Description>
				</Field.Field>
				<Field.Group>
					<Field.Field>
						<Button type="submit" disabled={loading}>
							{loading ? "Creating account..." : "Create Account"}
						</Button>
						<!-- <Button variant="outline" type="button">Sign up with Google</Button> -->
						<Field.Description class="px-6 text-center">
							Already have an account? <a href={loginRoute}>Sign in</a>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</Field.Group>
		</form>
	</Card.Content>
</Card.Root>
