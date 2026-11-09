(() => {
  "use strict";

  /* ============ 数据 ============ */
  const LIBRARY = JSON.parse(document.getElementById("libraryData").textContent);
  const SONGS = LIBRARY.songs;
  const SONG_BY_ID = new Map(SONGS.map((song) => [song.i, song]));

  const DIFFS = [
    { id: "easy", label: "EASY", short: "E", color: "#3fae6a" },
    { id: "normal", label: "NORMAL", short: "N", color: "#3d8fdd" },
    { id: "hard", label: "HARD", short: "H", color: "#e5a12b" },
    { id: "expert", label: "EXPERT", short: "EX", color: "#e05a5a" },
    { id: "master", label: "MASTER", short: "M", color: "#9a6bd6" },
    { id: "append", label: "APPEND", short: "AP", color: "#d24b8c" },
  ];
  const DIFF_BY_ID = Object.fromEntries(DIFFS.map((d) => [d.id, d]));
  const DIFF_ORDER = DIFFS.map((d) => d.id);

  const GROUPS = [
    {
      id: "light_music_club",
      label: "Leo/need",
      short: "Leo/need",
      color: "#2f9e8f",
      unit: true,
    },
    {
      id: "idol",
      label: "MORE MORE JUMP！",
      short: "MMJ！",
      color: "#ff6f9f",
      unit: true,
    },
    {
      id: "street",
      label: "Vivid BAD SQUAD",
      short: "VBS",
      color: "#e05a5a",
      unit: true,
    },
    {
      id: "theme_park",
      label: "Wonderlands×Showtime",
      short: "W×S",
      color: "#e6a12b",
      unit: true,
    },
    {
      id: "school_refusal",
      label: "25时，在Nightcord。",
      short: "25时",
      color: "#8f72d6",
      unit: true,
    },
    {
      id: "vocaloid",
      label: "VOCALOID",
      short: "VOCALOID",
      color: "#1fb8aa",
      unit: false,
    },
    {
      id: "other",
      label: "其他 / 联动",
      short: "其他",
      color: "#7d8f99",
      unit: false,
    },
  ];
  const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const UNIT_IDS = GROUPS.filter((g) => g.unit).map((g) => g.id);
  const ALL_UNITS_GROUP = {
    id: "all_units",
    label: "全组合",
    short: "全组合",
    color: "#4e8f92",
  };
  const COVER_PAIRS = {
    light_music_club: ["#2f9e8f", "#87dcc8"],
    idol: ["#ff6f9f", "#ffc3d5"],
    street: ["#df5b5b", "#f5a27a"],
    theme_park: ["#e6a12b", "#ffe08a"],
    school_refusal: ["#8f72d6", "#c8baf0"],
    vocaloid: ["#1fb8aa", "#77e0d6"],
    other: ["#728a94", "#b5c6cc"],
    all_units: ["#1fb8aa", "#ff9ebd"],
  };

  const MAX_LEVEL = Math.max(37, ...SONGS.flatMap((song) => Object.values(song.d)));
  const TOTAL_CHARTS = SONGS.reduce((sum, song) => sum + Object.keys(song.d).length, 0);
  const STORAGE_KEY = "pjsk-stage-draw-v1";
  const HISTORY_LIMIT = 8;

  /* ============ DOM ============ */
  const $ = (id) => document.getElementById(id);
  const els = {
    heroSongCount: $("heroSongCount"),
    heroChartCount: $("heroChartCount"),
    dataDate: $("dataDate"),
    resultCard: $("resultCard"),
    resultPlaceholder: $("resultPlaceholder"),
    resultContent: $("resultContent"),
    cover: $("cover"),
    coverAppend: $("coverAppend"),
    coverImg: $("coverImg"),
    coverNote: $("coverNote"),
    resultNo: $("resultNo"),
    resultDate: $("resultDate"),
    songTitle: $("songTitle"),
    songOriginal: $("songOriginal"),
    resultTags: $("resultTags"),
    releaseInfo: $("releaseInfo"),
    copyBtn: $("copyBtn"),
    drawBtn: $("drawBtn"),
    drawBtnLabel: $("drawBtnLabel"),
    drawHint: $("drawHint"),
    noRepeat: $("noRepeat"),
    resetRound: $("resetRound"),
    clearHistory: $("clearHistory"),
    historyList: $("historyList"),
    difficultyChips: $("difficultyChips"),
    groupChips: $("groupChips"),
    minLevel: $("minLevel"),
    maxLevel: $("maxLevel"),
    levelSummary: $("levelSummary"),
    allLevels: $("allLevels"),
    resetFilters: $("resetFilters"),
    poolCount: $("poolCount"),
    chartCount: $("chartCount"),
    poolSub: $("poolSub"),
    openPool: $("openPool"),
    poolDialog: $("poolDialog"),
    poolDialogCount: $("poolDialogCount"),
    poolSearch: $("poolSearch"),
    poolList: $("poolList"),
    closePool: $("closePool"),
    toast: $("toast"),
    liveSummary: $("liveSummary"),
  };
  const nameModeButtons = Array.from(document.querySelectorAll("[data-name-mode]"));
  const drawBtnIcon = els.drawBtn.querySelector(".btn-icon");

  /* ============ 状态 ============ */
  const defaultState = () => ({
    diffs: new Set(DIFFS.map((d) => d.id)),
    groups: new Set(GROUPS.map((g) => g.id)),
    minLevel: 1,
    maxLevel: MAX_LEVEL,
    nameMode: "both",
    noRepeat: false,
    drawn: new Set(),
    history: [],
    drawNo: 0,
    result: null,
    isDrawing: false,
  });
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadState() {
    const state = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return state;
      const saved = JSON.parse(raw);

      if (Array.isArray(saved.diffs)) {
        state.diffs = new Set(saved.diffs.filter((id) => DIFF_BY_ID[id]));
      }
      if (Array.isArray(saved.groups)) {
        state.groups = new Set(saved.groups.filter((id) => GROUP_BY_ID[id]));
      }
      if (Number.isFinite(saved.minLevel)) state.minLevel = saved.minLevel;
      if (Number.isFinite(saved.maxLevel)) state.maxLevel = saved.maxLevel;
      state.minLevel = clamp(Math.round(state.minLevel), 1, MAX_LEVEL);
      state.maxLevel = clamp(Math.round(state.maxLevel), 1, MAX_LEVEL);
      if (state.minLevel > state.maxLevel) {
        [state.minLevel, state.maxLevel] = [state.maxLevel, state.minLevel];
      }
      if (["both", "cn", "orig"].includes(saved.nameMode)) {
        state.nameMode = saved.nameMode;
      }
      state.noRepeat = Boolean(saved.noRepeat);
      if (Array.isArray(saved.drawn)) {
        state.drawn = new Set(
          saved.drawn.filter((id) => Number.isFinite(id) && SONG_BY_ID.has(id)),
        );
      }
      if (Number.isInteger(saved.drawNo) && saved.drawNo >= 0) {
        state.drawNo = saved.drawNo;
      }
      if (Array.isArray(saved.history)) {
        state.history = saved.history
          .map((item) => {
            if (!item || !SONG_BY_ID.has(item.i) || !DIFF_BY_ID[item.diff]) {
              return null;
            }
            const song = SONG_BY_ID.get(item.i);
            const level = song.d[item.diff];
            if (!level) return null;
            return {
              ...song,
              diff: item.diff,
              level,
              no: Number.isInteger(item.no) ? item.no : 0,
            };
          })
          .filter(Boolean)
          .slice(0, HISTORY_LIMIT);
      }
    } catch {
      return defaultState();
    }
    return state;
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          diffs: [...state.diffs],
          groups: [...state.groups],
          minLevel: state.minLevel,
          maxLevel: state.maxLevel,
          nameMode: state.nameMode,
          noRepeat: state.noRepeat,
          drawn: [...state.drawn],
          history: state.history.map((item) => ({
            i: item.i,
            diff: item.diff,
            no: item.no,
          })),
          drawNo: state.drawNo,
        }),
      );
    } catch {
      /* localStorage 不可用时静默降级 */
    }
  }

  /* ============ 工具 ============ */
  function shuffleIndex(length) {
    if (length <= 0) return 0;
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const limit = Math.floor(0x100000000 / length) * length;
      const buffer = new Uint32Array(1);
      do {
        window.crypto.getRandomValues(buffer);
      } while (buffer[0] >= limit);
      return buffer[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function randomItem(list) {
    return list[shuffleIndex(list.length)];
  }

  function eligibleDiffs(song) {
    const result = [];
    for (const diff of DIFFS) {
      const level = song.d[diff.id];
      if (
        level != null &&
        state.diffs.has(diff.id) &&
        level >= state.minLevel &&
        level <= state.maxLevel
      ) {
        result.push(diff.id);
      }
    }
    return result;
  }

  function matchesGroups(song) {
    if (!state.groups.size) return false;
    return song.g.some((groupId) => state.groups.has(groupId));
  }

  function currentPool({ ignoreDrawn = false } = {}) {
    const pool = SONGS.filter(
      (song) => matchesGroups(song) && eligibleDiffs(song).length > 0,
    );
    if (state.noRepeat && !ignoreDrawn) {
      return pool.filter((song) => !state.drawn.has(song.i));
    }
    return pool;
  }

  function groupObjects(song) {
    const set = new Set(song.g);
    const units = GROUPS.filter((group) => group.unit && set.has(group.id));
    const result = [];
    if (units.length === UNIT_IDS.length) {
      result.push(ALL_UNITS_GROUP);
    } else {
      result.push(...units);
    }
    if (set.has("vocaloid")) result.push(GROUP_BY_ID.vocaloid);
    if (set.has("other")) result.push(GROUP_BY_ID.other);
    if (!result.length) result.push(GROUP_BY_ID.other);
    return result;
  }

  function coverColors(song) {
    const units = GROUPS.filter(
      (group) => group.unit && song.g.includes(group.id),
    );
    if (units.length === UNIT_IDS.length) return COVER_PAIRS.all_units;
    const key = units[0]?.id || (song.g.includes("vocaloid") ? "vocaloid" : "other");
    return COVER_PAIRS[key] || COVER_PAIRS.other;
  }

  function displayNames(song) {
    const cn = song.c;
    const orig = song.t;
    if (state.nameMode === "cn") {
      return { primary: cn, secondary: "", secondaryLabel: "" };
    }
    if (state.nameMode === "orig") {
      return {
        primary: orig,
        secondary: cn !== orig ? cn : "",
        secondaryLabel: "中文名",
      };
    }
    return {
      primary: cn,
      secondary: orig !== cn ? orig : "",
      secondaryLabel: "原名",
    };
  }

  function altName(song) {
    const primary = state.nameMode === "orig" ? song.t : song.c;
    const other = state.nameMode === "orig" ? song.c : song.t;
    if (other === primary) return "";
    return `${state.nameMode === "orig" ? "中文名" : "原名"} · ${other}`;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2300);
  }

  function debounce(fn, delay) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  }

  /* ============ 筛选 UI ============ */
  function renderChips() {
    renderChipGroup(els.difficultyChips, DIFFS, "diffs", "difficulty");
    renderChipGroup(els.groupChips, GROUPS, "groups", "group");
  }

  function renderChipGroup(container, items, stateKey, kind) {
    container.replaceChildren();
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.id = item.id;
      button.dataset.kind = kind;
      button.style.setProperty("--accent", item.color);
      button.setAttribute("aria-pressed", String(state[stateKey].has(item.id)));

      const dot = document.createElement("span");
      dot.className = "chip-dot";
      dot.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = item.label;

      const count = document.createElement("span");
      count.className = "chip-count";
      count.dataset.count = item.id;
      count.textContent = "0";

      button.append(dot, label, count);
      button.addEventListener("click", () => {
        const set = state[stateKey];
        if (set.has(item.id)) set.delete(item.id);
        else set.add(item.id);
        updateChipPressed();
        updatePoolSummary();
        saveState();
      });
      container.append(button);
    });
  }

  function updateChipPressed() {
    document.querySelectorAll(".chip[data-kind]").forEach((button) => {
      const set = button.dataset.kind === "difficulty" ? state.diffs : state.groups;
      button.setAttribute("aria-pressed", String(set.has(button.dataset.id)));
    });
  }

  function updateChipCounts() {
    document.querySelectorAll(".chip[data-kind='difficulty']").forEach((button) => {
      const id = button.dataset.id;
      const count = SONGS.filter((song) => {
        const level = song.d[id];
        return (
          level != null &&
          level >= state.minLevel &&
          level <= state.maxLevel &&
          matchesGroups(song)
        );
      }).length;
      const countEl = button.querySelector(".chip-count");
      if (countEl) countEl.textContent = String(count);
    });

    document.querySelectorAll(".chip[data-kind='group']").forEach((button) => {
      const id = button.dataset.id;
      const count = SONGS.filter(
        (song) => song.g.includes(id) && eligibleDiffs(song).length > 0,
      ).length;
      const countEl = button.querySelector(".chip-count");
      if (countEl) countEl.textContent = String(count);
    });
  }

  function updateNameModeButtons() {
    nameModeButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.nameMode === state.nameMode),
      );
    });
  }

  /* ============ 曲池 ============ */
  function updatePoolSummary() {
    const pool = currentPool();
    const charts = pool.reduce(
      (sum, song) => sum + eligibleDiffs(song).length,
      0,
    );
    const appendCount = pool.filter((song) => "append" in song.d).length;

    els.poolCount.textContent = String(pool.length);
    els.chartCount.textContent = String(charts);
    els.poolSub.textContent = `曲池含 APPEND ${appendCount} 首 · ${
      state.noRepeat ? `本轮已抽 ${state.drawn.size} 首` : "未开启不重复"
    } · 已按当前条件过滤`;

    els.minLevel.value = String(state.minLevel);
    els.maxLevel.value = String(state.maxLevel);
    els.levelSummary.textContent = `${state.minLevel} - ${state.maxLevel}`;

    els.drawBtn.disabled = state.isDrawing || pool.length === 0;
    els.resetRound.disabled = state.drawn.size === 0;
    els.clearHistory.hidden = state.history.length === 0;

    if (state.isDrawing) {
      els.drawHint.textContent = "正在翻谱…";
    } else if (!state.diffs.size) {
      els.drawHint.textContent = "至少选择一个难度。";
    } else if (!state.groups.size) {
      els.drawHint.textContent = "至少选择一个组合或分类。";
    } else if (!pool.length && state.noRepeat) {
      els.drawHint.textContent = "本轮曲池已抽完，点「重置本轮」继续。";
    } else if (!pool.length) {
      els.drawHint.textContent = "这个范围里没有可抽的曲目，试试放宽条件。";
    } else if (state.noRepeat) {
      els.drawHint.textContent = `本轮剩余 ${pool.length} 首，已抽 ${state.drawn.size} 首。`;
    } else {
      els.drawHint.textContent = "先抽歌，再抽谱面。按空格也可以。";
    }

    updateChipCounts();
  }

  /* ============ 结果渲染 ============ */
  function renderGroupTags(song, container, compact, { clear = true } = {}) {
    if (clear) container.replaceChildren();
    groupObjects(song).forEach((group) => {
      const tag = document.createElement("span");
      tag.className = compact ? "pool-group" : "tag";
      tag.style.setProperty("--tag-color", group.color);
      tag.textContent = compact ? group.short : group.label;
      container.append(tag);
    });
  }

  function fillResult(item, { slot = false } = {}) {
    const names = displayNames(item);
    const diff = DIFF_BY_ID[item.diff];
    const colors = coverColors(item);

    els.songTitle.textContent = names.primary;
    if (names.secondary) {
      els.songOriginal.textContent = `${names.secondaryLabel} · ${names.secondary}`;
      els.songOriginal.hidden = false;
    } else {
      els.songOriginal.textContent = "";
      els.songOriginal.hidden = true;
    }

    els.resultNo.textContent = `第 ${item.no || "—"} 抽`;
    els.resultDate.textContent = slot ? "—" : item.p;
    els.releaseInfo.textContent = slot ? "正在翻谱…" : `国服上线 ${item.p}`;

    els.resultTags.replaceChildren();
    const badge = document.createElement("span");
    badge.className = `diff-badge diff-${item.diff}`;
    const diffName = document.createElement("span");
    diffName.textContent = diff.label;
    const diffLevel = document.createElement("b");
    diffLevel.textContent = String(item.level);
    badge.append(diffName, diffLevel);
    els.resultTags.append(badge);
    renderGroupTags(item, els.resultTags, false, { clear: false });

    els.cover.style.setProperty("--cover-a", colors[0]);
    els.cover.style.setProperty("--cover-b", colors[1]);
    els.coverAppend.hidden = item.diff !== "append";
    applyCover(item);
  }


  /* ============ 曲目封面 ============ */
  // 封面走同域 /image/（由 _worker.js 转发），避免来源站拦截。
  function coverUrl(song) {
    const id = String(song.i).padStart(3, "0");
    const name = `jacket_s_${id}`;
    return `/image/${name}/${name}.webp`;
  }

  // 有封面就显示，加载失败就退回原来的渐变底，不出现裂图。
  function applyCover(song) {
    const img = els.coverImg;
    const note = els.coverNote;
    if (!img || !song) return;
    img.hidden = true;
    els.cover.classList.remove("has-img");
    if (note) note.hidden = false;
    img.onload = () => {
      img.hidden = false;
      els.cover.classList.add("has-img");
      if (note) note.hidden = true;
    };
    img.onerror = () => {
      img.hidden = true;
      els.cover.classList.remove("has-img");
      if (note) note.hidden = false;
    };
    img.alt = `${song.c} 封面`;
    // 不能用 loading="lazy"：img 初始是 hidden，懒加载不会启动，onload 永远不触发。
    img.loading = "eager";
    img.decoding = "async";
    img.src = coverUrl(song);
  }

  function showResult(item, { animate = true } = {}) {
    els.resultPlaceholder.hidden = true;
    els.resultContent.hidden = false;
    fillResult(item);
    state.result = item;

    if (animate) {
      els.resultCard.classList.remove("reveal");
      void els.resultCard.offsetWidth;
      els.resultCard.classList.add("reveal");
      window.setTimeout(() => {
        els.resultCard.classList.remove("reveal");
      }, 700);
    }

    const names = displayNames(item);
    const diff = DIFF_BY_ID[item.diff];
    els.liveSummary.textContent = `抽到 ${names.primary}，${diff.label} ${item.level}。`;
  }

  function renderHistory() {
    els.historyList.replaceChildren();
    if (!state.history.length) {
      const empty = document.createElement("span");
      empty.className = "history-empty";
      empty.textContent = "还没有抽签记录";
      els.historyList.append(empty);
      els.clearHistory.hidden = true;
      return;
    }

    els.clearHistory.hidden = false;
    state.history.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.title = "点击回看这一抽";

      const title = document.createElement("strong");
      title.textContent = displayNames(item).primary;

      const meta = document.createElement("span");
      meta.textContent = `第 ${item.no || "—"} 抽 · ${DIFF_BY_ID[item.diff].label} ${item.level}`;

      button.append(title, meta);
      button.addEventListener("click", () => {
        showResult(item, { animate: false });
        toast("已回看这一抽");
      });
      els.historyList.append(button);
    });
  }

  /* ============ 抽签 ============ */
  function setDrawingUI(isDrawing) {
    state.isDrawing = isDrawing;
    els.drawBtn.classList.toggle("is-drawing", isDrawing);
    els.drawBtnLabel.textContent = isDrawing ? "抽签中…" : "抽一首";
    drawBtnIcon.textContent = isDrawing ? "↻" : "✦";
    els.resultCard.setAttribute("aria-busy", String(isDrawing));
    els.drawBtn.disabled = isDrawing || currentPool().length === 0;
    if (isDrawing) {
      els.resultPlaceholder.hidden = true;
      els.resultContent.hidden = false;
    }
  }

  function animateDraw(pool, finalItem) {
    return new Promise((resolve) => {
      let ticks = 0;
      const totalTicks = 11;
      const timer = window.setInterval(() => {
        const song = randomItem(pool);
        const diffs = eligibleDiffs(song);
        const diff = randomItem(diffs);
        fillResult(
          {
            ...song,
            diff,
            level: song.d[diff],
            no: finalItem.no,
          },
          { slot: true },
        );
        ticks += 1;
        if (ticks >= totalTicks) {
          window.clearInterval(timer);
          resolve();
        }
      }, 58);
    });
  }

  async function draw() {
    if (state.isDrawing) return;
    const pool = currentPool();
    if (!pool.length) {
      updatePoolSummary();
      toast(
        state.noRepeat
          ? "本轮曲池已抽完，点「重置本轮」继续"
          : "当前筛选下没有可抽的曲目",
      );
      return;
    }

    const song = randomItem(pool);
    const diffs = eligibleDiffs(song);
    const diff = randomItem(diffs);
    const item = {
      ...song,
      diff,
      level: song.d[diff],
      no: state.drawNo + 1,
    };

    state.drawNo += 1;
    if (state.noRepeat) state.drawn.add(song.i);
    state.history.unshift(item);
    state.history = state.history.slice(0, HISTORY_LIMIT);

    setDrawingUI(true);
    updatePoolSummary();
    saveState();
    els.liveSummary.textContent = "抽签中，请稍候。";

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!reduceMotion) {
      await animateDraw(pool, item);
    }

    setDrawingUI(false);
    showResult(item, { animate: !reduceMotion });
    renderHistory();
    updatePoolSummary();
    saveState();

    if (state.noRepeat && currentPool().length === 0) {
      toast("本轮曲池已抽完，可以重置后再来一轮");
    }
  }

  /* ============ 操作 ============ */
  function resetRound() {
    state.drawn.clear();
    updatePoolSummary();
    saveState();
    toast("本轮已重置，可以重新抽到相同的歌了");
  }

  function resetFilters() {
    state.diffs = new Set(DIFFS.map((d) => d.id));
    state.groups = new Set(GROUPS.map((g) => g.id));
    state.minLevel = 1;
    state.maxLevel = MAX_LEVEL;
    updateChipPressed();
    updatePoolSummary();
    saveState();
    toast("已恢复全部曲库");
  }

  function clearHistory() {
    state.history = [];
    renderHistory();
    updatePoolSummary();
    saveState();
    toast("抽签记录已清空");
  }

  function applyLevelInput(source) {
    let min = Number.parseInt(els.minLevel.value, 10);
    let max = Number.parseInt(els.maxLevel.value, 10);
    if (!Number.isFinite(min)) min = state.minLevel;
    if (!Number.isFinite(max)) max = state.maxLevel;
    min = clamp(min, 1, MAX_LEVEL);
    max = clamp(max, 1, MAX_LEVEL);

    if (min > max) {
      if (source === "min") max = min;
      else min = max;
    }

    state.minLevel = min;
    state.maxLevel = max;
    els.minLevel.value = String(min);
    els.maxLevel.value = String(max);
    updatePoolSummary();
    saveState();
  }

  function openPoolDialog() {
    els.poolSearch.value = "";
    renderPoolList();
    if (typeof els.poolDialog.showModal === "function") {
      els.poolDialog.showModal();
    } else {
      els.poolDialog.setAttribute("open", "");
    }
    window.setTimeout(() => els.poolSearch.focus(), 30);
  }

  function songSearchText(song) {
    const groupText = groupObjects(song)
      .map((group) => `${group.label} ${group.short}`)
      .join(" ");
    return `${song.c} ${song.t} ${groupText} ${song.g.join(" ")}`.toLowerCase();
  }

  function renderPoolList() {
    const pool = currentPool();
    const query = els.poolSearch.value.trim().toLowerCase();
    const list = query
      ? pool.filter((song) => songSearchText(song).includes(query))
      : pool;
    const charts = list.reduce(
      (sum, song) => sum + eligibleDiffs(song).length,
      0,
    );

    els.poolDialogCount.textContent = `${list.length} 首${
      query ? "匹配" : "可抽"
    } · ${charts} 个谱面${
      state.noRepeat ? " · 已排除本轮抽过的歌" : ""
    }`;

    els.poolList.replaceChildren();
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "pool-empty";
      empty.textContent = query
        ? "没有找到匹配的曲目，换个关键词试试。"
        : "当前条件下没有可抽的曲目，调整筛选后再试。";
      els.poolList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach((song) => {
      const row = document.createElement("div");
      row.className = "pool-row";

      const main = document.createElement("div");
      main.className = "pool-main";
      const title = document.createElement("h3");
      title.textContent = displayNames(song).primary;
      const alt = document.createElement("p");
      alt.textContent = altName(song);
      main.append(title, alt);

      const groups = document.createElement("div");
      groups.className = "pool-groups";
      renderGroupTags(song, groups, true);

      const diffs = document.createElement("div");
      diffs.className = "pool-diffs";
      DIFFS.forEach((diff) => {
        const level = song.d[diff.id];
        if (level == null) return;
        const chip = document.createElement("span");
        chip.className = `mini-diff diff-${diff.id}`;
        chip.textContent = `${diff.short}${level}`;
        chip.title = `${diff.label} ${level}`;
        diffs.append(chip);
      });

      row.append(main, groups, diffs);
      fragment.append(row);
    });
    els.poolList.append(fragment);
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    if (!ok) throw new Error("copy failed");
  }

  async function copyText(text) {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function" &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }
    fallbackCopy(text);
  }

  async function copyResult() {
    if (!state.result) return;
    const song = state.result;
    const diff = DIFF_BY_ID[song.diff];
    const groups = groupObjects(song)
      .map((group) => group.label)
      .join(" / ");
    const title = song.c === song.t ? song.c : `${song.c}（${song.t}）`;
    const text = [
      "【PJSK 国服随机抽签】",
      title,
      `难度：${diff.label} ${song.level}`,
      `组合：${groups}`,
      `第 ${song.no || "—"} 抽`,
    ].join("\n");

    try {
      await copyText(text);
      toast("已复制，发给一起打歌的朋友吧");
    } catch {
      toast("复制失败，请手动选择文字");
    }
  }

  /* ============ 事件绑定 ============ */
  function bindEvents() {
    els.drawBtn.addEventListener("click", draw);
    els.copyBtn.addEventListener("click", copyResult);
    els.resetRound.addEventListener("click", resetRound);
    els.resetFilters.addEventListener("click", resetFilters);
    els.clearHistory.addEventListener("click", clearHistory);
    els.allLevels.addEventListener("click", () => {
      state.minLevel = 1;
      state.maxLevel = MAX_LEVEL;
      updatePoolSummary();
      saveState();
    });

    els.noRepeat.addEventListener("change", () => {
      state.noRepeat = els.noRepeat.checked;
      updatePoolSummary();
      saveState();
      if (state.noRepeat && state.drawn.size) {
        toast(`已排除本轮抽过的 ${state.drawn.size} 首歌`);
      }
    });

    els.minLevel.addEventListener("change", () => applyLevelInput("min"));
    els.maxLevel.addEventListener("change", () => applyLevelInput("max"));
    els.minLevel.addEventListener("blur", () => applyLevelInput("min"));
    els.maxLevel.addEventListener("blur", () => applyLevelInput("max"));

    nameModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.nameMode = button.dataset.nameMode;
        updateNameModeButtons();
        if (state.result) fillResult(state.result);
        renderHistory();
        if (els.poolDialog.open) renderPoolList();
        saveState();
      });
    });

    els.openPool.addEventListener("click", openPoolDialog);
    els.closePool.addEventListener("click", () => els.poolDialog.close());
    els.poolDialog.addEventListener("click", (event) => {
      if (event.target === els.poolDialog) els.poolDialog.close();
    });
    els.poolSearch.addEventListener(
      "input",
      debounce(() => renderPoolList(), 70),
    );

    document.addEventListener("keydown", (event) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (els.poolDialog.open) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        tag === "A" ||
        active?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      draw();
    });
  }

  /* ============ 初始化 ============ */
  function init() {
    els.heroSongCount.textContent = String(SONGS.length);
    els.heroChartCount.textContent = String(TOTAL_CHARTS);
    els.dataDate.textContent = LIBRARY.asOf;

    els.minLevel.max = String(MAX_LEVEL);
    els.maxLevel.max = String(MAX_LEVEL);
    els.minLevel.value = String(state.minLevel);
    els.maxLevel.value = String(state.maxLevel);
    els.noRepeat.checked = state.noRepeat;

    renderChips();
    updateNameModeButtons();
    updatePoolSummary();
    renderHistory();
    bindEvents();
  }

  init();
})();
