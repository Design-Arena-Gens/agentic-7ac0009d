const state = {
  prompts: [],
  categories: [],
  activeCategory: null,
  search: "",
  favoritesOnly: false,
  favorites: new Set(JSON.parse(localStorage.getItem("gptp_fav") || "[]")),
};

const els = {
  viewHome: document.getElementById("viewHome"),
  viewList: document.getElementById("viewList"),
  search: document.getElementById("searchInput"),
  drawer: document.getElementById("drawer"),
  drawerContent: document.getElementById("drawerContent"),
  favoritesToggle: document.getElementById("favoritesToggle"),
  chipFilters: document.getElementById("chipFilters"),
  toast: document.getElementById("toast"),
};

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 1400);
}

async function loadData() {
  const res = await fetch("./data/prompts.json", { cache: "no-store" });
  const all = await res.json();
  state.prompts = all;
  // derive categories
  const catMap = new Map();
  for (const p of all) {
    const key = p.category;
    const c = catMap.get(key) || { key, slug: slugify(key), name: key, desc: p.categoryDesc || "", count: 0 };
    c.count += 1;
    catMap.set(key, c);
  }
  state.categories = Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z?-??0-9\-]/g, "")
    .replace(/-+/g, "-");
}

function routeTo(hash) {
  location.hash = hash;
}

function getRoute() {
  const h = location.hash || "";
  const mCat = h.match(/^#\/category\/([^\n#?]+)/);
  const mPr = h.match(/^#\/prompt\/([^\n#?]+)/);
  if (mPr) return { name: "prompt", id: mPr[1] };
  if (mCat) return { name: "category", slug: mCat[1] };
  return { name: "home" };
}

function renderChips() {
  els.chipFilters.innerHTML = "";
  const allChip = chip("???", state.activeCategory === null, () => {
    state.activeCategory = null;
    updateView();
  });
  els.chipFilters.appendChild(allChip);
  for (const c of state.categories) {
    const pressed = state.activeCategory === c.slug;
    const ch = chip(`${c.name}`, pressed, () => {
      state.activeCategory = pressed ? null : c.slug;
      if (state.activeCategory) routeTo(`#/category/${state.activeCategory}`);
      else routeTo("");
      updateView();
    });
    els.chipFilters.appendChild(ch);
  }
}

function chip(label, active, onClick) {
  const el = document.createElement("button");
  el.className = "chip";
  el.type = "button";
  el.setAttribute("aria-pressed", String(!!active));
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

function renderHome() {
  els.viewHome.innerHTML = "";
  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "?????????";
  els.viewHome.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "grid";
  els.viewHome.appendChild(grid);

  for (const c of state.categories) {
    const card = document.createElement("a");
    card.href = `#/category/${c.slug}`;
    card.className = "card a";
    card.innerHTML = `
      <div class="name">${escapeHtml(c.name)}</div>
      <div class="desc">????-???????? ????????? ? ???????? ??????????</div>
      <div class="meta"><span class="pill">${c.count} ???????</span></div>
    `;
    grid.appendChild(card);
  }
}

function renderList() {
  els.viewList.innerHTML = "";
  const header = document.createElement("div");
  const currentCat = state.activeCategory ? state.categories.find(c => c.slug === state.activeCategory) : null;
  header.className = "section-title";
  const base = state.favoritesOnly ? "?????????" : (currentCat ? currentCat.name : "??? ??????");
  header.textContent = base;
  els.viewList.appendChild(header);

  const list = document.createElement("div");
  list.className = "list";

  let items = state.prompts.slice();
  if (state.favoritesOnly) {
    items = items.filter(p => state.favorites.has(p.id));
  }
  if (state.activeCategory) {
    items = items.filter(p => slugify(p.category) === state.activeCategory);
  }
  const q = state.search.trim().toLowerCase();
  if (q) {
    items = items.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  for (const p of items) {
    list.appendChild(renderListItem(p));
  }

  els.viewList.appendChild(list);
}

function renderListItem(p) {
  const el = document.createElement("div");
  el.className = "item";
  const left = document.createElement("div");
  const right = document.createElement("div");
  right.className = "right";

  left.innerHTML = `
    <h3 class="h">${escapeHtml(p.title)}</h3>
    <div class="d">${escapeHtml(p.description)}</div>
    <div class="tags">${(p.tags||[]).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
  `;

  const openBtn = document.createElement("button");
  openBtn.className = "btn";
  openBtn.textContent = "???????";
  openBtn.addEventListener("click", () => openPrompt(p.id));

  const favBtn = document.createElement("button");
  favBtn.className = "btn btn-ghost";
  favBtn.setAttribute("aria-pressed", String(state.favorites.has(p.id)));
  favBtn.textContent = state.favorites.has(p.id) ? "?" : "?";
  favBtn.title = "???????? ? ?????????";
  favBtn.addEventListener("click", () => toggleFavorite(p.id, favBtn));

  right.appendChild(openBtn);
  right.appendChild(favBtn);

  el.appendChild(left);
  el.appendChild(right);
  return el;
}

function toggleFavorite(id, btn) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }
  localStorage.setItem("gptp_fav", JSON.stringify(Array.from(state.favorites)));
  if (btn) {
    btn.setAttribute("aria-pressed", String(state.favorites.has(id)));
    btn.textContent = state.favorites.has(id) ? "?" : "?";
  }
}

function openPrompt(id) {
  const p = state.prompts.find(x => x.id === id);
  if (!p) return;
  location.hash = `#/prompt/${encodeURIComponent(id)}`;
  renderDrawer(p);
}

function closeDrawer() {
  els.drawer.classList.add("hidden");
  els.drawer.setAttribute("aria-hidden", "true");
  if (getRoute().name === "prompt") {
    // return to list without full reload
    if (state.activeCategory) routeTo(`#/category/${state.activeCategory}`);
    else routeTo("");
  }
}

function renderDrawer(p) {
  els.drawerContent.innerHTML = "";
  const title = document.createElement("h2");
  title.textContent = p.title;

  const meta = document.createElement("dl");
  meta.className = "kv";
  meta.innerHTML = `
    <dt>?????????</dt><dd>${escapeHtml(p.category)}</dd>
    <dt>????????</dt><dd>${escapeHtml(p.description)}</dd>
    <dt>????</dt><dd>${(p.tags||[]).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</dd>
  `;

  const prompt = document.createElement("div");
  prompt.className = "code";
  prompt.innerHTML = escapeHtml(p.prompt).replace(/\{\{(.*?)\}\}/g, '<span class="var">{{$1}}</span>');

  const btns = document.createElement("div");
  btns.style.display = "flex";
  btns.style.gap = "8px";
  const copyBtn = buttonPrimary("??????????? ?????", async () => {
    await copy(p.prompt);
    showToast("????? ??????????");
  });
  const copyVarsBtn = document.createElement("button");
  copyVarsBtn.className = "btn";
  copyVarsBtn.textContent = "??????????? ??????????";
  copyVarsBtn.addEventListener("click", async () => {
    const vars = (p.variables||[]).map(v => `${v.name}=`).join("\n");
    await copy(vars || "??? ??????????");
    showToast("?????? ?????????? ??????????");
  });
  btns.appendChild(copyBtn);
  btns.appendChild(copyVarsBtn);

  const how = document.createElement("div");
  how.innerHTML = `<div class="section-title">?????????? ?? ?????????????</div>` +
    `<ol>${(p.instructions||[]).map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`;

  els.drawerContent.appendChild(title);
  els.drawerContent.appendChild(meta);
  els.drawerContent.appendChild(btns);
  els.drawerContent.appendChild(document.createElement("hr"));
  els.drawerContent.appendChild(prompt);
  els.drawerContent.appendChild(document.createElement("hr"));
  els.drawerContent.appendChild(how);

  els.drawer.classList.remove("hidden");
  els.drawer.setAttribute("aria-hidden", "false");
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateView() {
  const r = getRoute();
  const showList = r.name === "category" || state.search || state.favoritesOnly;
  els.viewHome.classList.toggle("hidden", !!showList);
  els.viewList.classList.toggle("hidden", !showList);
  if (r.name === "category") {
    state.activeCategory = r.slug;
  }
  renderChips();
  if (!showList) renderHome();
  else renderList();
}

function bindEvents() {
  els.search.addEventListener("input", () => {
    state.search = els.search.value;
    updateView();
  });

  els.favoritesToggle.addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    els.favoritesToggle.setAttribute("aria-pressed", String(state.favoritesOnly));
    updateView();
  });

  els.drawer.addEventListener("click", (e) => {
    if (e.target.matches('[data-close]')) closeDrawer();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  window.addEventListener("hashchange", () => {
    const r = getRoute();
    if (r.name === "prompt") {
      const p = state.prompts.find(x => x.id === r.id);
      if (p) renderDrawer(p);
    } else {
      els.drawer.classList.add("hidden");
      updateView();
    }
  });
}

(async function init() {
  await loadData();
  bindEvents();
  updateView();
  const r = getRoute();
  if (r.name === "prompt") {
    const p = state.prompts.find(x => x.id === r.id);
    if (p) renderDrawer(p);
  }
})();

function buttonPrimary(text, onClick) {
  const b = document.createElement("button");
  b.className = "btn btn-primary";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
