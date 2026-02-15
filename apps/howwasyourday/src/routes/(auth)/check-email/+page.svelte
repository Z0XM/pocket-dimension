<script lang="ts">
  import { LoaderCircleIcon, MailCheckIcon, MailIcon } from "@lucide/svelte";
  import { page } from "$app/state";
  import { Button } from "$components/ui/button/index.js";
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";

  // Get query params
  const type = $derived(page.url.searchParams.get("type") ?? "signup");
  const email = $derived(page.url.searchParams.get("email") ?? "");
  const reason = $derived(page.url.searchParams.get("reason") ?? "");

  let resending = $state(false);
  let resendSuccess = $state(false);
  let resendError = $state<string | null>(null);

  const title = $derived.by(() => {
    if (reason === "verify") return "Email Verification Required";
    if (type === "signup") return "Check Your Email";
    if (type === "resend") return "Verification Email Sent";
    if (type === "forgot") return "Check Your Email";
    return "Check Your Email";
  });

  const description = $derived.by(() => {
    if (reason === "verify") {
      return "You need to verify your email address to access this feature. Please check your inbox for the verification link.";
    }
    if (type === "signup") {
      return `We've sent a verification link to ${email || "your email"}. Please check your inbox and click the link to verify your account.`;
    }
    if (type === "resend") {
      return `We've sent a new verification link to ${email || "your email"}. Please check your inbox.`;
    }
    if (type === "forgot") {
      return `If an account exists for ${email || "that email"}, we've sent a password reset link. Please check your inbox.`;
    }
    return "Please check your inbox for the email we sent.";
  });

  async function handleResendVerification() {
    if (!email) {
      resendError = "No email address provided.";
      return;
    }

    resending = true;
    resendError = null;
    resendSuccess = false;

    try {
      const response = await fetch(`${PUBLIC_BASE_AUTH_URL}/send-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          callbackURL: `${window.location.origin}/verify-email`,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        resendError = data.message ?? data.error ?? "Failed to send verification email.";
      } else {
        resendSuccess = true;
      }
    } catch (err) {
      console.error(err);
      resendError = "Failed to send verification email.";
    } finally {
      resending = false;
    }
  }
</script>

<div class="p-6 md:p-8">
  <div class="flex flex-col items-center gap-6 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
      <MailCheckIcon class="h-8 w-8 text-primary" />
    </div>

    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-bold">{title}</h1>
      <p class="text-muted-foreground text-sm text-balance">
        {description}
      </p>
    </div>

    {#if resendSuccess}
      <div class="rounded-md bg-primary/15 p-3 text-sm text-primary w-full">Verification email sent successfully!</div>
    {/if}

    {#if resendError}
      <div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive w-full">
        {resendError}
      </div>
    {/if}

    <div class="flex flex-col gap-3 w-full">
      {#if type !== "forgot" && email}
        <Button variant="outline" onclick={handleResendVerification} disabled={resending} class="w-full py-6">
          {#if resending}
            <LoaderCircleIcon class="animate-spin mr-2 h-4 w-4" />
            Sending...
          {:else}
            <MailIcon class="mr-2 h-4 w-4" />
            Resend Verification Email
          {/if}
        </Button>
      {/if}

      <a href="/login" class="text-sm text-muted-foreground hover:text-primary transition-colors"> ← Back to Login </a>
    </div>

    <div class="text-xs text-muted-foreground mt-4">
      <p>Didn't receive the email?</p>
      <p>Check your spam folder or try resending.</p>
    </div>
  </div>
</div>
