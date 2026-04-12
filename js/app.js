(function () {
  "use strict";

  // ---------- Config ----------

  const LEAGUE_SOURCES = {
    LEAGUE_5: "https://raw.githubusercontent.com/syrifgit/OSRSTaskHub/main/leagues/league-5-raging-echoes/LEAGUE_5.full.json",
    LEAGUE_6: "https://raw.githubusercontent.com/syrifgit/OSRSTaskHub/main/leagues/league-6-demonic-pacts/LEAGUE_6.full.json",
  };

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
  const toastEl = document.getElementById("toast");

  // ---------- State ----------

  const taskMaps = {}; // league -> Map<structId, {name, description}>
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
        const entries = JSON.parse(cached);
        taskMaps[league] = new Map(entries);
        return taskMaps[league];
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const url = LEAGUE_SOURCES[league];
    if (!url) throw new Error(`Unknown league: ${league}`);

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`${league} task data not yet published. Try again after launch.`);
      }
      throw new Error(`Fetch failed for ${league}: ${res.status}`);
    }
    const tasks = await res.json();

    const entries = tasks.map((t) => [t.structId, { name: t.name, description: t.description }]);
    taskMaps[league] = new Map(entries);

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(entries));
    } catch {
      // Storage full or unavailable - keep in-memory copy only
    }

    return taskMaps[league];
  }

  // ---------- Icon assignment ----------

  function assignIcon(label) {
    for (const [pattern, icon] of ICON_RULES) {
      if (pattern.test(label)) return icon;
    }
    return undefined;
  }

  // ---------- Conversion ----------

  function convertRoute(route, taskMap) {
    const stats = {
      sections: 0,
      tasksConverted: 0,
      customItemsPassthrough: 0,
      unresolvedTasks: [],
      dedupedIds: 0,
    };

    // Pre-collect all existing customItem IDs so a converted tid-X never
    // collides with a pre-existing id (e.g. a bank waypoint) or with an
    // earlier converted tid that shared the same structId.
    const usedIds = new Set();
    for (const section of route.sections || []) {
      for (const item of section.items || []) {
        if (item.customItem && item.customItem.id) {
          usedIds.add(item.customItem.id);
        }
      }
    }

    function uniqueId(base) {
      if (!usedIds.has(base)) {
        usedIds.add(base);
        return base;
      }
      let n = 2;
      while (usedIds.has(`${base}-${n}`)) n++;
      const id = `${base}-${n}`;
      usedIds.add(id);
      stats.dedupedIds++;
      return id;
    }

    for (const section of route.sections || []) {
      stats.sections++;
      for (const item of section.items || []) {
        if (item.customItem) {
          stats.customItemsPassthrough++;
          continue;
        }
        if (typeof item.taskId === "number") {
          const task = taskMap.get(item.taskId);
          const label = task ? task.name : `Task ${item.taskId}`;
          const description = task ? task.description : "";
          if (!task) stats.unresolvedTasks.push(item.taskId);

          const id = uniqueId(`tid-${item.taskId}`);

          const newCustom = { id, label };
          if (description) newCustom.description = description;
          const icon = assignIcon(label);
          if (icon) newCustom.icon = icon;

          delete item.taskId;
          item.customItem = newCustom;
          stats.tasksConverted++;
        }
      }
    }

    // Final safety check: scan for any duplicate customItem IDs and fix in place.
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

    if (route.name && !route.name.endsWith(" (Converted)")) {
      route.name = `${route.name} (Converted)`;
    }
    const note = "Converted from taskIds to customItems for manual walkthrough testing. Task names pulled from OSRSTaskHub.";
    route.description = route.description ? `${route.description}\n\n${note}` : note;

    if (Array.isArray(route.completed) && route.completed.length > 0) {
      route.completed = [];
    }

    return stats;
  }

  // ---------- UI actions ----------

  async function handleConvert() {
    clearStatus();
    outputEl.value = "";
    copyBtn.disabled = true;
    downloadBtn.disabled = true;

    const raw = inputEl.value.trim();
    if (!raw) {
      setStatus("Paste a route JSON first.", "error");
      return;
    }

    let route;
    try {
      route = JSON.parse(raw);
    } catch (e) {
      setStatus(`Invalid JSON: ${e.message}`, "error");
      return;
    }

    if (!route.taskType) {
      setStatus('Route is missing "taskType" field. Expected "LEAGUE_5" or "LEAGUE_6".', "error");
      return;
    }
    if (!LEAGUE_SOURCES[route.taskType]) {
      setStatus(`Unsupported taskType: "${route.taskType}". Supported: ${Object.keys(LEAGUE_SOURCES).join(", ")}.`, "error");
      return;
    }
    if (!Array.isArray(route.sections) || route.sections.length === 0) {
      setStatus('Route has no sections.', "error");
      return;
    }

    convertBtn.disabled = true;
    convertBtn.textContent = "Converting...";

    let taskMap;
    try {
      taskMap = await loadTasks(route.taskType);
    } catch (e) {
      setStatus(`Could not load ${route.taskType} task data: ${e.message}`, "error");
      convertBtn.disabled = false;
      convertBtn.textContent = "Convert";
      return;
    }

    const stats = convertRoute(route, taskMap);
    const pretty = JSON.stringify(route, null, 2);
    outputEl.value = pretty;
    lastOutputName = (route.name || "converted-route").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "converted-route";

    const parts = [
      `${stats.sections} sections`,
      `${stats.tasksConverted} tasks converted`,
      `${stats.customItemsPassthrough} existing customItems preserved`,
    ];
    if (stats.dedupedIds > 0) parts.push(`${stats.dedupedIds} duplicate IDs deduped`);
    const ok = stats.unresolvedTasks.length === 0;
    if (!ok) parts.push(`${stats.unresolvedTasks.length} unresolved task IDs`);

    setStatus(parts.join(" - "), ok ? "success" : "warning");
    if (!ok) {
      const preview = stats.unresolvedTasks.slice(0, 10).join(", ");
      const more = stats.unresolvedTasks.length > 10 ? ", ..." : "";
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
      // Fallback: select + execCommand
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

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.className = "status-line";
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  // ---------- Warmup: preload L5 so the Convert button is instant ----------

  async function warmup() {
    try {
      await loadTasks("LEAGUE_5");
      convertBtn.disabled = false;
      convertBtn.textContent = "Convert";
      setStatus("Task data loaded. Paste a route and click Convert.", "info");
    } catch (e) {
      convertBtn.disabled = false;
      convertBtn.textContent = "Convert";
      setStatus(`Task data warmup failed: ${e.message}. The Convert button will retry on click.`, "warning");
    }
  }

  // ---------- Init ----------

  function init() {
    initTheme();
    convertBtn.addEventListener("click", handleConvert);
    copyBtn.addEventListener("click", handleCopy);
    downloadBtn.addEventListener("click", handleDownload);
    // Also allow Ctrl+Enter in the input textarea to convert
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
