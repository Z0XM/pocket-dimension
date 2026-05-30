<script lang="ts">
  import { page } from "$app/state";
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";

  const type = $derived(page.url.searchParams.get("type") ?? "signup");
  const email = $derived(page.url.searchParams.get("email") ?? "");
  const reason = $derived(page.url.searchParams.get("reason") ?? "");

  let resending = $state(false);
  let resendSuccess = $state(false);
  let resendError = $state<string | null>(null);

  const title = $derived.by(() => {
    if (reason === "verify") return "Email verification required";
    if (type === "signup") return "Check your email";
    if (type === "resend") return "Verification email sent";
    if (type === "forgot") return "Check your email";
    return "Check your email";
  });

  const description = $derived.by(() => {
    if (reason === "verify") {
      return "Verify your email to use Chhan Chhan. Check your inbox for the verification link.";
    }
    if (type === "signup") {
      return `We sent a verification link to ${email || "your email"}. Open it to activate your account.`;
    }
    if (type === "resend") {
      return `We sent a new verification link to ${email || "your email"}.`;
    }
    if (type === "forgot") {
      return `If an account exists for ${email || "that email"}, we sent a password reset link.`;
    }
    return "Check your inbox for the email we sent.";
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
    <div class="flex flex-col gap-2">
      <h1 class="font-heading text-2xl font-bold">{title}</h1>
      <p class="text-balance text-sm text-muted-foreground">{description}</p>
    </div>

    {#if resendSuccess}
      <div class="w-full rounded-md border border-(--success)/40 bg-[color-mix(in_srgb,var(--success)_12%,transparent)] p-3 text-sm text-(--success)">
        Verification email sent.
      </div>
    {/if}

    {#if resendError}
      <div class="w-full rounded-md border border-(--danger)/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-3 text-sm text-(--danger)">
        {resendError}
      </div>
    {/if}

    <div class="flex w-full flex-col gap-3">
      {#if type !== "forgot" && email}
        <button
          type="button"
          class="w-full rounded border border-border bg-secondary px-4 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          onclick={handleResendVerification}
          disabled={resending}
        >
          {resending ? "Sending…" : "Resend verification email"}
        </button>
      {/if}

      <a href="/login" class="text-sm text-muted-foreground hover:text-primary-foreground">← Back to sign in</a>
    </div>

    <div class="mt-2 text-xs text-muted-foreground">
      <p>Did not receive it?</p>
      <p>Check spam or try resending.</p>
    </div>
  </div>
</div>
