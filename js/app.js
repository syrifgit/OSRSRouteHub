(function () {
  "use strict";

  // ---------- Config ----------

  const LEAGUE_SOURCES = {
    LEAGUE_5: "https://raw.githubusercontent.com/syrifgit/OSRSTaskHub/main/leagues/league-5-raging-echoes/LEAGUE_5.full.json",
    LEAGUE_6: "https://raw.githubusercontent.com/syrifgit/OSRSTaskHub/main/leagues/league-6-demonic-pacts/LEAGUE_6.full.json",
  };

  const L6_MAPPING_URL = "https://raw.githubusercontent.com/syrifgit/OSRSTaskHub/main/leagues/league-6-demonic-pacts/mappings/LEAGUE_6-mappings.json";

  const ICONS = {
    GENERAL_STORE: 1448, BANK: 1453, QUEST_START: 1454, MINING_SITE: 1456,
    FURNACE: 1457, ANVIL: 1458, COMBAT_TRAINING: 1459, DUNGEON: 1460,
    ARCHERY_SHOP: 1465, ALTAR: 1467, GEM_SHOP: 1470, CRAFTING_SHOP: 1471,
    FISHING_SPOT: 1474, CLOTHES_SHOP: 1475, PUB: 1479, FOOD_SHOP: 1484,
    COOKING_RANGE: 1488, AGILITY: 1497, SLAYER_MASTER: 1499, FARMING_PATCH: 1501,
    TRANSPORTATION: 1504, HUNTER: 1511, WOODCUTTING: 1519, TASK_MASTER: 1522,
  };

  const ICON_RULES = [
    [/^(quetzal|charter|fairy ring|teleport|travel)/i, ICONS.TRANSPORTATION],
    [/^bank$/i, ICONS.BANK],
    [/general store/i, ICONS.GENERAL_STORE],
    [/flaming arrow|tavern|pub/i, ICONS.PUB],
    [/(floria|clothes)/i, ICONS.CLOTHES_SHOP],
    [/gem store|cut.*(emerald|ruby|sapphire|diamond)/i, ICONS.GEM_SHOP],
    [/artima|craft/i, ICONS.CRAFTING_SHOP],
    [/^(mine|mining)/i, ICONS.MINING_SITE],
    [/^smelt/i, ICONS.FURNACE],
    [/^make.*(bar|bronze|iron|steel|mithril|adamant|rune).*$|anvil/i, ICONS.ANVIL],
    [/^(kill|defeat|attack|attempt)/i, ICONS.COMBAT_TRAINING],
    [/^(pray|activate prayer|restore.*prayer|use.*prayer|altar)/i, ICONS.ALTAR],
    [/^(catch.*(chinchompa|bird|impling)|trap|rumour|box trap|hunter)/i, ICONS.HUNTER],
    [/^(fish|catch.*(shrimp|anchov|tuna|lobster|karamb|swordfish))/i, ICONS.FISHING_SPOT],
    [/^(chop|logs|bird nest)/i, ICONS.WOODCUTTING],
    [/^(burn|firemake)/i, ICONS.WOODCUTTING],
    [/^(cook|make molten)/i, ICONS.COOKING_RANGE],
    [/^(rake|plant|pick|harvest|farm|protect.*crop)/i, ICONS.FARMING_PATCH],
    [/^(agility|lap|course)/i, ICONS.AGILITY],
    [/slayer/i, ICONS.SLAYER_MASTER],
    [/^(complete.*diary|claim.*diary|achievement)/i, ICONS.TASK_MASTER],
    [/^(enter.*dungeon|dungeon)/i, ICONS.DUNGEON],
    [/^(quest|complete.*quest)/i, ICONS.QUEST_START],
  ];

  // ---------- DOM refs ----------

  const inputEl = document.getElementById("input-json");
  const outputEl = document.getElementById("output-json");
  const convertBtn = document.getElementById("convert-btn");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const statusEl = document.getElementById("status-line");
  const detectEl = document.getElementById("detect-line");
  const toastEl = document.getElementById("toast");

  // ---------- State ----------

  const taskMaps = {};        // league -> Map<structId, {name, description}>
  let mappingIndex = null;    // { list, byL5, byPrelim, byLegacy, byReal, byName }
  let lastOutputName = "converted-route";

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

  // ---------- Task data loading ----------

  async function loadTasks(league) {
    if (taskMaps[league]) return taskMaps[league];
    const cacheKey = `routehub-tasks-${league}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        taskMaps[league] = new Map(JSON.parse(cached));
        return taskMaps[league];
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }
    const res = await fetch(LEAGUE_SOURCES[league]);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`${league} task data not yet published.`);
      }
      throw new Error(`Fetch failed for ${league}: ${res.status}`);
    }
    const tasks = await res.json();
    const entries = tasks.map((t) => [t.structId, { name: t.name, description: t.description }]);
    taskMaps[league] = new Map(entries);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(entries)); } catch {}
    return taskMaps[league];
  }

  async function loadMapping() {
    if (mappingIndex) return mappingIndex;
    const res = await fetch(L6_MAPPING_URL);
    if (!res.ok) throw new Error(`Mapping fetch failed: ${res.status}`);
    const list = await res.json();
    const byL5 = new Map();
    const byPrelim = new Map();
    const byLegacy = new Map();
    const byReal = new Map();
    const byName = new Map();
    for (const m of list) {
      if (m.league_5_structId != null) byL5.set(m.league_5_structId, m);
      if (m.league_6_preliminary_id != null) byPrelim.set(m.league_6_preliminary_id, m);
      if (m.league_6_legacy_preliminary_id != null) byLegacy.set(m.league_6_legacy_preliminary_id, m);
      if (m.league_6_real_structId != null) byReal.set(m.league_6_real_structId, m);
      byName.set(normName(m.name), m);
    }
    mappingIndex = { list, byL5, byPrelim, byLegacy, byReal, byName };
    return mappingIndex;
  }

  function normName(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

  // ---------- Icon assignment ----------

  function assignIcon(label) {
    for (const [pattern, icon] of ICON_RULES) {
      if (pattern.test(label)) return icon;
    }
    return undefined;
  }

  // ---------- Route detection ----------

  function detectRouteType(route, mapping, l5TaskMap) {
    let l5Count = 0, prelimCount = 0, legacyCount = 0, realCount = 0, unknownCount = 0, total = 0;
    for (const section of route.sections || []) {
      for (const item of section.items || []) {
        if (typeof item.taskId !== "number") continue;
        total++;
        // Check specificity: real > preliminary (current dbrow_id) > legacy placeholder > L5
        if (mapping.byReal.has(item.taskId)) realCount++;
        else if (mapping.byPrelim.has(item.taskId)) prelimCount++;
        else if (mapping.byLegacy.has(item.taskId)) legacyCount++;
        else if (mapping.byL5.has(item.taskId) || l5TaskMap.has(item.taskId)) l5Count++;
        else unknownCount++;
      }
    }
    const types = [];
    if (l5Count > 0) types.push("L5");
    if (legacyCount > 0) types.push("L6 old placeholders");
    if (prelimCount > 0) types.push("L6 current");
    if (realCount > 0) types.push("L6 real");

    let label;
    if (total === 0) label = "no tasks";
    else if (types.length === 0) label = `all ${unknownCount} tasks unrecognized`;
    else if (types.length === 1) label = types[0] + (unknownCount > 0 ? ` + ${unknownCount} unknown` : "");
    else label = "blend: " + types.join(" + ") + (unknownCount > 0 ? ` + ${unknownCount} unknown` : "");

    return { label, total, l5Count, legacyCount, prelimCount, realCount, unknownCount };
  }

  // ---------- Conversion ----------

  function convertRoute(route, mode, mapping, l5TaskMap) {
    const stats = {
      sections: 0,
      total: 0,
      keptAsTask: 0,           // taskId retained (possibly remapped to a different scheme)
      convertedToCustom: 0,    // taskId -> customItem
      customItemsPassthrough: 0,
      remapped: 0,             // taskId value changed (e.g. L5 -> L6 real)
      unresolved: [],          // tasks that couldn't be mapped and became custom w/ note
      dedupedIds: 0,
    };

    // Collect all existing customItem IDs so new tid-X ids don't collide.
    const usedIds = new Set();
    for (const section of route.sections || []) {
      for (const item of section.items || []) {
        if (item.customItem && item.customItem.id) usedIds.add(item.customItem.id);
      }
    }
    function uniqueId(base) {
      if (!usedIds.has(base)) { usedIds.add(base); return base; }
      let n = 2;
      while (usedIds.has(`${base}-${n}`)) n++;
      const id = `${base}-${n}`;
      usedIds.add(id);
      stats.dedupedIds++;
      return id;
    }

    // Resolve a route item's taskId to a mapping entry (any source).
    function lookup(taskId) {
      return mapping.byReal.get(taskId)
          || mapping.byPrelim.get(taskId)
          || mapping.byLegacy.get(taskId)
          || mapping.byL5.get(taskId)
          || null;
    }

    // Build a custom item from whatever info we have. Preserves any extra fields on `item`.
    function toCustom(item, label, description, note) {
      const baseId = uniqueId(`tid-${item.taskId}`);
      const custom = { id: baseId, label };
      if (description) custom.description = description;
      const icon = assignIcon(label);
      if (icon) custom.icon = icon;
      if (note) custom.note = note;
      delete item.taskId;
      item.customItem = custom;
      stats.convertedToCustom++;
    }

    for (const section of route.sections || []) {
      stats.sections++;
      for (const item of section.items || []) {
        if (item.customItem) {
          stats.customItemsPassthrough++;
          continue;
        }
        if (typeof item.taskId !== "number") continue;
        stats.total++;

        const entry = lookup(item.taskId);
        const fallbackL5 = l5TaskMap.get(item.taskId);
        // Display label/description priority: mapping > L5 full.json > "Task <id>"
        const label = entry ? entry.name : (fallbackL5 ? fallbackL5.name : `Task ${item.taskId}`);
        const description = entry ? undefined : (fallbackL5 ? fallbackL5.description : undefined);

        if (mode === "full-custom") {
          toCustom(item, label, description);
          continue;
        }

        if (mode === "migrate-l6") {
          // Target: the current L6 preliminary_id (= dbrow_id). Covers routes
          // using L5 structIds, old L6 placeholders, or already-current IDs.
          // When real L6 structIds land we can switch target to real_structId.
          if (entry && entry.league_6_preliminary_id != null) {
            if (item.taskId !== entry.league_6_preliminary_id) stats.remapped++;
            item.taskId = entry.league_6_preliminary_id;
            stats.keptAsTask++;
          } else {
            stats.unresolved.push(item.taskId);
            const note = fallbackL5
              ? "This L5 task has no L6 equivalent in the current mapping."
              : "This taskId isn't in the current L6 mapping. May have been renamed or removed on the wiki.";
            toCustom(item, label, description, note);
          }
          continue;
        }
      }
    }

    // Set output taskType based on mode
    if (mode === "migrate-l6") route.taskType = "LEAGUE_6";

    // Clear completion state so the import lands fresh
    if (Array.isArray(route.completed) && route.completed.length > 0) route.completed = [];

    // Final dedup safety pass
    const seenFinal = new Set();
    for (const section of route.sections || []) {
      for (const item of section.items || []) {
        if (!item.customItem || !item.customItem.id) continue;
        let id = item.customItem.id;
        if (seenFinal.has(id)) {
          let n = 2;
          while (seenFinal.has(`${id}-${n}`)) n++;
          id = `${id}-${n}`;
          item.customItem.id = id;
          stats.dedupedIds++;
        }
        seenFinal.add(id);
      }
    }

    // Name + description trailer so users know what mode was applied
    const modeLabel = { "full-custom": "Full Custom", "migrate-l6": "Migrated to L6" }[mode];
    if (route.name && !route.name.includes(`(${modeLabel})`)) {
      route.name = `${route.name} (${modeLabel})`;
    }
    const noteLines = [`Converted by OSRSRouteHub - ${modeLabel} mode.`];
    if (mode === "full-custom") noteLines.push("Every task was turned into a custom item with its name and icon preserved.");
    else if (mode === "migrate-l6") noteLines.push("L5 structIds and old preliminary placeholders were remapped to the new permanent L6 IDs. Tasks without a current L6 equivalent became custom items with notes.");
    route.description = route.description ? `${route.description}\n\n${noteLines.join(" ")}` : noteLines.join(" ");

    return stats;
  }

  // ---------- UI actions ----------

  function getSelectedMode() {
    const sel = document.querySelector('input[name="mode"]:checked');
    return sel ? sel.value : "full-custom";
  }

  async function handleConvert() {
    clearStatus();
    outputEl.value = "";
    copyBtn.disabled = true;
    downloadBtn.disabled = true;

    const raw = inputEl.value.trim();
    if (!raw) { setStatus("Paste a route JSON first.", "error"); return; }

    let route;
    try { route = JSON.parse(raw); }
    catch (e) { setStatus(`Invalid JSON: ${e.message}`, "error"); return; }

    if (!route.taskType) { setStatus('Route is missing "taskType" field.', "error"); return; }
    if (!Array.isArray(route.sections) || route.sections.length === 0) {
      setStatus("Route has no sections.", "error"); return;
    }

    convertBtn.disabled = true;
    convertBtn.textContent = "Converting...";

    let mapping, l5TaskMap;
    try {
      [mapping, l5TaskMap] = await Promise.all([loadMapping(), loadTasks("LEAGUE_5")]);
    } catch (e) {
      setStatus(`Data load failed: ${e.message}`, "error");
      convertBtn.disabled = false;
      convertBtn.textContent = "Convert";
      return;
    }

    // Detect input route type
    const detection = detectRouteType(route, mapping, l5TaskMap);
    setDetect(`Input: ${detection.label} (${detection.total} task items${detection.total ? `: L5=${detection.l5Count}, L6-legacy=${detection.legacyCount}, L6-current=${detection.prelimCount}, L6-real=${detection.realCount}, unknown=${detection.unknownCount}` : ""})`);

    const mode = getSelectedMode();
    const stats = convertRoute(route, mode, mapping, l5TaskMap);
    const pretty = JSON.stringify(route, null, 2);
    outputEl.value = pretty;
    lastOutputName = (route.name || "converted-route").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "converted-route";

    const parts = [
      `${stats.sections} sections`,
      `${stats.total} tasks processed`,
      `${stats.keptAsTask} kept as task${stats.remapped > 0 ? ` (${stats.remapped} remapped)` : ""}`,
      `${stats.convertedToCustom} converted to custom`,
      `${stats.customItemsPassthrough} existing custom items preserved`,
    ];
    if (stats.dedupedIds > 0) parts.push(`${stats.dedupedIds} duplicate IDs deduped`);
    const ok = stats.unresolved.length === 0;
    if (!ok) parts.push(`${stats.unresolved.length} tasks could not be mapped`);

    setStatus(parts.join(" - "), ok ? "success" : "warning");
    if (!ok) {
      const preview = stats.unresolved.slice(0, 10).join(", ");
      const more = stats.unresolved.length > 10 ? ", ..." : "";
      console.warn(`Unresolved task IDs: ${preview}${more}`);
    }

    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    convertBtn.disabled = false;
    convertBtn.textContent = "Convert";
  }

  async function handleCopy() {
    if (!outputEl.value) return;
    try {
      await navigator.clipboard.writeText(outputEl.value);
      toast("Copied to clipboard");
    } catch {
      outputEl.select();
      try {
        document.execCommand("copy");
        toast("Copied to clipboard");
      } catch {
        toast("Copy failed - select the output and copy manually");
      }
    }
  }

  function handleDownload() {
    if (!outputEl.value) return;
    const blob = new Blob([outputEl.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lastOutputName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Helpers ----------

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "status-line";
    if (kind) statusEl.classList.add(`status-${kind}`);
  }

  function setDetect(msg) {
    if (!detectEl) return;
    detectEl.textContent = msg;
    detectEl.className = "status-line status-info";
  }

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.className = "status-line";
    if (detectEl) { detectEl.textContent = ""; detectEl.className = "status-line"; }
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  // ---------- Warmup ----------

  async function warmup() {
    try {
      await Promise.all([loadTasks("LEAGUE_5"), loadMapping()]);
      convertBtn.disabled = false;
      convertBtn.textContent = "Convert";
      setStatus("Task data and L6 mapping loaded. Paste a route and click Convert.", "info");
    } catch (e) {
      convertBtn.disabled = false;
      convertBtn.textContent = "Convert";
      setStatus(`Warmup failed: ${e.message}. Convert will retry on click.`, "warning");
    }
  }

  // ---------- Init ----------

  function init() {
    initTheme();
    convertBtn.addEventListener("click", handleConvert);
    copyBtn.addEventListener("click", handleCopy);
    downloadBtn.addEventListener("click", handleDownload);
    inputEl.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleConvert();
      }
    });
    warmup();
  }

  init();
})();
