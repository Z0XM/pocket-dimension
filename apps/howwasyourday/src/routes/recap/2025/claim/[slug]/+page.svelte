<script lang="ts">
  import { goto } from "$app/navigation";

  const { data } = $props();

  let step = $state<"confirm" | "otp" | "done">("confirm");
  let code = $state("");
  let error = $state<string | null>(null);
  let busy = $state(false);
  let linked = $state(false);
  let claimSignedIn = $state(data.signedIn);

  async function sendOtp() {
    error = null;
    busy = true;
    try {
      const res = await fetch("/api/recap/2025/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: data.slug }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = body.error || "Could not send code";
        return;
      }
      step = "otp";
    } finally {
      busy = false;
    }
  }

  async function verifyOtp() {
    error = null;
    busy = true;
    try {
      const res = await fetch("/api/recap/2025/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: data.slug, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = body.error || "Could not verify code";
        return;
      }
      linked = !!body.linked;
      claimSignedIn = !!body.signedIn;
      step = "done";
      if (body.redirectTo) {
        setTimeout(() => goto(body.redirectTo), linked || claimSignedIn ? 600 : 1800);
      }
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Claim {data.displayName} · 2025 recap</title>
</svelte:head>

<main class="claim" style={`--accent: ${data.accentColor || "#214247"}`}>
  <a class="back" href="/recap/2025">All dashboards</a>

  <p class="eyebrow">Year recap · 2025 · claim</p>
  <h1>{data.displayName}</h1>

  {#if step === "confirm"}
    <p class="lede">
      Confirm this is your dashboard. We’ll email a one-time code to
      <strong>{data.emailMask}</strong>.
    </p>
    {#if error}
      <p class="err" role="alert">{error}</p>
    {/if}
    <button type="button" class="cta" disabled={busy} onclick={sendOtp}>
      {busy ? "Sending…" : "Confirm & send code"}
    </button>
  {:else if step === "otp"}
    <p class="lede">Enter the 6-digit code sent to <strong>{data.emailMask}</strong>.</p>
    <label class="code-label">
      <span>Code</span>
      <input class="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" bind:value={code} disabled={busy} />
    </label>
    {#if error}
      <p class="err" role="alert">{error}</p>
    {/if}
    <div class="row">
      <button type="button" class="cta" disabled={busy || code.replace(/\s/g, "").length !== 6} onclick={verifyOtp}>
        {busy ? "Checking…" : "Verify & open"}
      </button>
      <button type="button" class="ghost" disabled={busy} onclick={sendOtp}>Resend</button>
    </div>
  {:else}
    <p class="lede">You’re in. Opening your dashboard…</p>
    {#if !claimSignedIn}
      <p class="nudge">
        Sign in to Pocket Dimension to keep access without OTP next time.
        <a href={`/login?redirectTo=${encodeURIComponent(`/recap/2025/${data.slug}`)}`}>Sign in</a>
      </p>
    {:else if linked}
      <p class="nudge ok">Linked to your Pocket Dimension account.</p>
    {/if}
  {/if}
</main>

<style>
  .claim {
    --display: "Fraunces", Georgia, serif;
    --sans: "Outfit", system-ui, sans-serif;
    --paper: #f3f6f4;
    --ink: #142326;
    --ink-soft: #3d5256;
    --ink-mute: #6a7f83;
    min-height: 100vh;
    padding: clamp(1.5rem, 4vw, 3.5rem);
    color: var(--ink);
    background:
      radial-gradient(120% 80% at 10% -10%, color-mix(in srgb, var(--accent) 28%, #f3f6f4), transparent 55%),
      linear-gradient(180deg, #eef4f1 0%, var(--paper) 40%, #e7efeb 100%);
  }

  .back {
    display: inline-block;
    margin-bottom: 1.5rem;
    font-size: 0.85rem;
    color: var(--ink-mute);
    text-decoration: none;
  }

  .back:hover {
    color: var(--accent);
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  h1 {
    margin: 0;
    font-family: var(--display);
    font-size: clamp(2.6rem, 8vw, 4.5rem);
    font-weight: 500;
    line-height: 0.95;
    color: var(--accent);
  }

  .lede {
    margin: 1.25rem 0 0;
    max-width: 28rem;
    color: var(--ink-soft);
    line-height: 1.55;
  }

  .cta {
    margin-top: 1.5rem;
    padding: 0.85rem 1.35rem;
    border: none;
    border-radius: 0.55rem;
    background: var(--accent);
    color: #fff;
    font-family: var(--sans);
    font-size: 0.95rem;
    cursor: pointer;
  }

  .cta:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .ghost {
    margin-top: 1.5rem;
    padding: 0.85rem 1rem;
    border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 0.55rem;
    background: transparent;
    color: var(--ink-soft);
    font-family: var(--sans);
    cursor: pointer;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .code-label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 1.25rem;
    max-width: 12rem;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  .code {
    font-family: ui-monospace, monospace;
    font-size: 1.5rem;
    letter-spacing: 0.35em;
    padding: 0.65rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 0.55rem;
    background: #fff;
    color: var(--ink);
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .code:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
  }

  .err {
    margin: 1rem 0 0;
    color: #9b1c1c;
  }

  .nudge {
    margin: 1.25rem 0 0;
    max-width: 28rem;
    color: var(--ink-soft);
    line-height: 1.5;
  }

  .nudge a {
    color: var(--accent);
  }

  .nudge.ok {
    color: var(--accent);
  }
</style>
