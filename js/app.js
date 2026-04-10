(function () {
  "use strict";

  const MANIFEST_URL = "routes/manifest.json";
  const routeListEl = document.getElementById("route-list");
  const searchEl = document.getElementById("search");
  const leagueFilterEl = document.getElementById("league-filter");
  const toastEl = document.getElementById("toast");

  let manifest = [];

  // ---------- Theme ----------

  function initTheme() {
    const saved = localStorage.getItem("routehub-theme") || "dark";
    setTheme(saved);

    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => setTheme(btn.dataset.theme));
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("routehub-theme", theme);
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });
  }

  // ---------- Init ----------

  async function init() {
    initTheme();
    try {
      const res = await fetch(MANIFEST_URL);
      manifest = await res.json();
    } catch {
      routeListEl.innerHTML = '<div class="loading">Failed to load routes.</div>';
      return;
    }

    populateLeagueFilter();
    render();

    searchEl.addEventListener("input", render);
    leagueFilterEl.addEventListener("change", render);
  }

  // ---------- Filters ----------

  function populateLeagueFilter() {
    const leagues = [...new Set(manifest.map((r) => r.league))].sort();
    for (const league of leagues) {
      const opt = document.createElement("option");
      opt.value = league;
      opt.textContent = league;
      leagueFilterEl.appendChild(opt);
    }
  }

  function getFiltered() {
    const q = searchEl.value.toLowerCase().trim();
    const league = leagueFilterEl.value;
    return manifest.filter((r) => {
      if (league && r.league !== league) return false;
      if (q) {
        const haystack = [r.name, r.author, r.description, ...(r.tags || [])]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  // ---------- Render ----------

  function render() {
    const routes = getFiltered();
    if (routes.length === 0) {
      routeListEl.innerHTML = '<div class="loading">No routes found.</div>';
      return;
    }
    routeListEl.innerHTML = routes.map(cardHTML).join("");
    routeListEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", handleAction);
    });
  }

  function cardHTML(route) {
    const tags = (route.tags || [])
      .map((t) => `<span class="tag">${esc(t)}</span>`)
      .join("");

    return `
      <article class="route-card" data-id="${esc(route.id)}">
        <div class="route-card-header">
          <div>
            <h3>${esc(route.name)}</h3>
            <span class="route-author">by ${esc(route.author)}</span>
          </div>
          <span class="route-league">${esc(route.league)}</span>
        </div>
        <p class="route-description">${esc(route.description)}</p>
        <div class="route-stats">
          <span>${route.sections} sections</span>
          <span>${route.taskCount} tasks</span>
          <span>${route.totalSteps} total steps</span>
        </div>
        ${tags ? `<div class="route-tags">${tags}</div>` : ""}
        <div class="route-actions">
          <button class="btn btn-primary" data-action="copy" data-file="${esc(route.file)}">Copy JSON</button>
          <button class="btn" data-action="download" data-file="${esc(route.file)}" data-name="${esc(route.id)}">Download</button>
          <button class="btn" data-action="preview" data-file="${esc(route.file)}">Preview</button>
        </div>
      </article>`;
  }

  // ---------- Actions ----------

  async function handleAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const file = btn.dataset.file;

    if (action === "copy") {
      try {
        const json = await fetchRoute(file);
        await navigator.clipboard.writeText(json);
        toast("Copied to clipboard - paste into your tool to import");
      } catch {
        toast("Failed to copy route");
      }
    } else if (action === "download") {
      try {
        const json = await fetchRoute(file);
        downloadFile(json, btn.dataset.name + ".json");
      } catch {
        toast("Failed to download route");
      }
    } else if (action === "preview") {
      try {
        const json = await fetchRoute(file);
        const data = JSON.parse(json);
        togglePreview(btn.closest(".route-card"), data);
      } catch {
        toast("Failed to load preview");
      }
    }
  }

  // ---------- Route fetching (cached) ----------

  const routeCache = {};

  async function fetchRoute(file) {
    if (routeCache[file]) return routeCache[file];
    const res = await fetch("routes/" + file);
    const text = await res.text();
    routeCache[file] = text;
    return text;
  }

  // ---------- Preview toggle ----------

  function togglePreview(card, data) {
    const existing = card.querySelector(".route-sections");
    if (existing) {
      existing.remove();
      return;
    }

    const sections = data.sections || [];
    const items = sections
      .map((s) => {
        const taskCount = s.items
          ? s.items.filter((i) => i.taskId).length
          : 0;
        const customCount = s.items
          ? s.items.filter((i) => i.customItem).length
          : 0;
        const parts = [];
        if (taskCount) parts.push(`${taskCount} tasks`);
        if (customCount) parts.push(`${customCount} waypoints`);
        return `<li>${esc(s.name)} <span class="section-count">(${parts.join(", ")})</span></li>`;
      })
      .join("");

    const details = document.createElement("div");
    details.className = "route-sections";
    details.innerHTML = `<details open>
      <summary>Sections</summary>
      <ul class="section-list">${items}</ul>
    </details>`;
    card.appendChild(details);
  }

  // ---------- Helpers ----------

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  function esc(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  // ---------- Go ----------

  init();
})();
