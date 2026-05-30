<script lang="ts">
  import { sampleCategories, sampleTags, samplePivots, sampleCardConfigs, formatMoney } from "$lib/demo/mock-data";

  let cards = $state(sampleCardConfigs.map((c) => ({ ...c })));
  let tags = $state(sampleTags.map((t) => ({ ...t })));
  let newTag = $state("");

  function addTag() {
    const name = newTag.trim().replace(/^#/, "");
    if (!name) return;
    tags = [...tags, { name, count: 0 }];
    newTag = "";
  }

  function removeTag(name: string) {
    tags = tags.filter((t) => t.name !== name);
  }
</script>

<svelte:head><title>Control · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1>CONTROL</h1>
    <p class="sub">Categories · tags · pivots · cards</p>
  </div>
  <a class="back" href="/app">← Transactions</a>
</header>

<div class="cols">
  <section class="panel">
    <h2>Categories</h2>
    <ul class="list">
      {#each sampleCategories as c}
        <li>
          <span class="cat"><span class="sq" style="background:{c.color}"></span>{c.name}</span>
          <span class="kind kind-{c.kind}">{c.kind}</span>
          <span class="mono">{formatMoney(c.monthlyMinor)}</span>
        </li>
      {/each}
    </ul>
    <button class="add" type="button">+ ADD</button>
  </section>

  <section class="panel">
    <h2>Tags</h2>
    <div class="tag-add">
      <input bind:value={newTag} placeholder="tag" onkeydown={(e) => e.key === "Enter" && addTag()} />
      <button type="button" onclick={addTag}>ADD</button>
    </div>
    <div class="chips">
      {#each tags as t}
        <span class="chip"
          ><span class="tag-hash" aria-hidden="true">#</span>{t.name}<small>{t.count}</small><button type="button" onclick={() => removeTag(t.name)}
            >×</button
          ></span
        >
      {/each}
    </div>
  </section>

  <section class="panel">
    <h2>Pivots</h2>
    <ul class="list">
      {#each samplePivots as p}
        <li>
          <span>{p.name}</span>
          <span class="kind">{p.groupBy}</span>
          <span class="mono dim">{p.range}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section class="panel">
    <h2>Cards</h2>
    <ul class="config">
      {#each cards as c}
        <li>
          <label><input type="checkbox" bind:checked={c.enabled} /><span>{c.label}</span></label>
          <code>{c.metric}</code>
        </li>
      {/each}
    </ul>
  </section>
</div>
