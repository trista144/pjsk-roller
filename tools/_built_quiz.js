
/* ============ 多多益善的模糊匹配 ============ */
/* 依赖 quiz.js 内的 DOM helper（$）；这里只放判定与相似度计算。 */
(() => {
  "use strict";

  const PAIRS = (() => {
    try {
      const node = document.getElementById("titlePairs");
      return node ? JSON.parse(node.textContent) : [];
    } catch {
      return [];
    }
  })();

  // 社区惯用别名：{ "452": ["赛博", "类四"] }
  // 有些叫法无法从曲库数据推导（例如「类四」需要"活动主角"信息），只能人工维护。
  const ALIASES = (() => {
    try {
      const node = document.getElementById("titleAliases");
      return node ? JSON.parse(node.textContent) : {};
    } catch {
      return {};
    }
  })();

  const KANA_KATA = {
    "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お", "っ": "つ", "ゃ": "や",
    "ゅ": "ゆ", "ょ": "よ", "ゎ": "わ", "ゔ": "う", "ゕ": "か", "ゖ": "け", "わ゛": "わ",
    "を": "お", "ん": "ん", "ー": "",
  };

  function katakanaToHiragana(text) {
    return text.replace(/[\u30a1-\u30f6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60),
    );
  }

  function foldDigits(text) {
    return text
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
      .replace(/[零一二三四五六七八九十]/g, (ch) => {
        const map = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
        return String(map[ch] ?? ch);
      });
  }

  // 第一层：暴力清洗（空格、标点、符号、全半角、假名归一、去括号内容）。
  function clean(text) {
    return foldDigits(katakanaToHiragana(String(text || "").toLowerCase()))
      .replace(/[（(【\[「『《][^）)】\]」』》]*[）)】\]」』》]/g, "")
      .replace(
        /[\s\u3000\-–—_·・.,，。、!?！？'"“”‘’()（）\[\]【】「」『』<>《》♪♯♭#☆★×÷:：;；/／\\|~～`@\$%^&*+=]+/g,
        "",
      );
  }

  // 第二层：去掉版本后缀 / 副标题（-reloaded-、(feat. xxx) 之类）。
  function core(text) {
    return clean(text)
      .replace(/(feat|ft)\..*$/, "")
      .replace(/(ver|version|remix|miku|sekai|fullsize|short)\.?$/i, "")
      .replace(/[-~〜].*$/, "");
  }

  // 第三层：超宽匹配依据——清洗后只保留字母数字与假名。
  function loose(text) {
    return clean(text).replace(/[^\p{L}\p{N}]/gu, "");
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[b.length];
  }

  // 0~100 的相似度，容忍错字、漏字、多字。
  // 判断是否纯拉丁/数字：这类输入短到 3 个字符就可能有意义（如 "relo" → Reloaded）
  function isLatinOnly(text) {
    return /^[a-z0-9]+$/.test(text);
  }

  // 「答对了一半」的判定：前缀 > 包含 > 反向包含。
  // 长度门槛用来压噪声——中文 2 字起、拉丁 3 字起才算数。
  function partialScore(q, t) {
    if (!q || !t) return 0;
    const latin = isLatinOnly(q);
    const minPrefix = latin ? 3 : 2;
    const minInner = latin ? 4 : 3;
    if (q.length >= minPrefix && t.startsWith(q)) return 0.955;
    if (q.length >= minInner && t.includes(q)) return 0.9;
    if (q.length >= minInner && q.includes(t)) return 0.88;
    return 0;
  }

  function similarity(query, target) {
    const q = clean(query);
    const t = clean(target);
    if (!q || !t) return 0;
    if (q === t) return 100;
    const max = Math.max(q.length, t.length);
    const d = levenshtein(q, t);
    const ratio = d >= max ? 0 : 1 - d / max;
    return Math.round(Math.max(ratio, partialScore(q, t)) * 100);
  }

  let pairsBySong = new Map();

  // 一首歌的全部"可被接受的写法"：中文名、原名、外加社区别名。
  function namesFor(song) {
    const list = [song.c, song.t];
    const extra = ALIASES[String(song.i)];
    if (Array.isArray(extra)) {
      for (const alias of extra) if (alias) list.push(alias);
    }
    return list.filter(Boolean);
  }

  function titlePairs(songId) {
    return pairsBySong.get(songId) || [];
  }

  function ensurePairIndex(songs) {
    if (pairsBySong.size) return;
    pairsBySong = new Map(songs.map((s) => [s.i, namesFor(s)]));
  }

  // 判定：模糊匹配。返回 {ok, how}，how 用来在页面上解释“算你过”的原因。
  function judge(guess, song, pairsFor) {
    if (!guess) return { ok: false, how: "none" };
    if (guess.i === song.i) return { ok: true, how: "exact" };
    // 注意：空数组在 JS 里是真值，不能写 `pairsFor(x) || 兜底`。
    // 用户直接手打文字时没有歌曲 id，查表会得到空数组，必须回退到文字本身。
    const namesOf = (entity) => {
      const viaPairs = pairsFor ? pairsFor(entity) : null;
      if (Array.isArray(viaPairs) && viaPairs.length) return viaPairs.filter(Boolean);
      return [entity && entity.c, entity && entity.t].filter(Boolean);
    };
    const guessNames = namesOf(guess);
    const answerNames = namesOf(song);
    for (const g of guessNames) {
      for (const a of answerNames) {
        if (!g || !a) continue;
        if (clean(g) === clean(a)) return { ok: true, how: "clean" };
        if (core(g) && core(g) === core(a)) return { ok: true, how: "core" };
        if (loose(g) && loose(g) === loose(a)) return { ok: true, how: "loose" };
      }
    }
    // 字面相似度兜底：正确曲名的另一个命名与猜测名称非常接近也算对。
    let best = 0;
    for (const g of guessNames) {
      for (const a of answerNames) best = Math.max(best, similarity(g, a));
    }
    if (best >= 86) return { ok: true, how: "fuzzy", score: best };
    return { ok: false, how: "none", score: best };
  }

  // 输入时的模糊推荐：返回 [{song, score}]，过滤掉 35 分以下的噪音。
  function suggestSongs(query, songs, limit = 5) {
    const q = clean(query);
    const qCore = core(query);
    if (!q || q.length < 2) return [];
    const scored = [];
    for (const song of songs) {
      const names = namesFor(song);
      let best = 0;
      for (const name of names) {
        if (!name) continue;
        const n = clean(name);
        if (!n) continue;
        if (n.startsWith(q) || n.includes(q)) best = Math.max(best, 96);
        else if (qCore && core(name).includes(qCore)) best = Math.max(best, 92);
        else best = Math.max(best, similarity(query, name) - 6);
      }
      if (best >= 45) scored.push({ song, score: best });
    }
    scored.sort((a, b) => b.score - a.score || a.song.c.length - b.song.c.length);
    const dedup = [];
    const seen = new Set();
    for (const item of scored) {
      if (seen.has(item.song.i)) continue;
      seen.add(item.song.i);
      dedup.push(item);
      if (dedup.length >= limit) break;
    }
    return dedup;
  }

  // 导出给页面脚本用（不挂在 window 上，避免污染全局命名）。
  window.PJSK_FUZZY = {
    PAIRS,
    clean,
    core,
    loose,
    similarity,
    judge,
    suggestSongs,
    ensurePairIndex,
    titlePairs,
  };
})();

(() => {
  "use strict";

  /* ============ 数据 ============ */
  const LIBRARY = JSON.parse(document.getElementById("libraryData").textContent);
  const FUZZY = window.PJSK_FUZZY || null;
  const ALL_SONGS = LIBRARY.songs;
  // 国服独占曲目没有公开试听音频，不进猜歌曲库。
  const QUIZ_SONGS = ALL_SONGS.filter((song) => song.qc === 1 && song.av && song.av.length);
  const SONG_BY_ID = new Map(ALL_SONGS.map((song) => [song.i, song]));

  const DIFFS = [
    { id: "easy", label: "EASY", short: "E", color: "#3fae6a" },
    { id: "normal", label: "NORMAL", short: "N", color: "#3d8fdd" },
    { id: "hard", label: "HARD", short: "H", color: "#e5a12b" },
    { id: "expert", label: "EXPERT", short: "EX", color: "#e05a5a" },
    { id: "master", label: "MASTER", short: "M", color: "#9a6bd6" },
    { id: "append", label: "APPEND", short: "AP", color: "#d24b8c" },
  ];
  const DIFF_BY_ID = Object.fromEntries(DIFFS.map((d) => [d.id, d]));

  const GROUPS = [
    { id: "light_music_club", label: "Leo/need", short: "Leo/need", color: "#2f9e8f", unit: true },
    { id: "idol", label: "MORE MORE JUMP！", short: "MMJ！", color: "#ff6f9f", unit: true },
    { id: "street", label: "Vivid BAD SQUAD", short: "VBS", color: "#e05a5a", unit: true },
    { id: "theme_park", label: "Wonderlands×Showtime", short: "W×S", color: "#e6a12b", unit: true },
    { id: "school_refusal", label: "25时，在Nightcord。", short: "25时", color: "#8f72d6", unit: true },
    { id: "vocaloid", label: "VOCALOID", short: "VOCALOID", color: "#1fb8aa", unit: false },
    { id: "other", label: "其他 / 联动", short: "其他", color: "#7d8f99", unit: false },
  ];
  const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const UNIT_IDS = GROUPS.filter((g) => g.unit).map((g) => g.id);
  const ALL_UNITS_GROUP = { id: "all_units", label: "全组合", short: "全组合", color: "#4e8f92" };

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

  const THINK_CHOICES = [30, 60, 90, 120, 0];
  const CLIP_MIN = 5;
  const CLIP_MAX = 10;
  // short.ver 片段从头播放一部分；素材里的前奏通常比较安静，跳过一点更容易听出旋律。
  const CLIP_START_MARGIN = 3;
  const CLIP_END_MARGIN = 12;
  const REMOTE_AUDIO_BASE = "https://storage.sekai.best/sekai-jp-assets/music/short/";
  // 默认走同域名下的 /audio/（由仓库根目录的 _worker.js 转发）。
  // 同域请求不受来源站白名单影响，也不用连 workers.dev，国内可直连。
  const DEFAULT_AUDIO_BASE = "/audio/";
  const AUDIO_BASE_KEY = "pjsk-quiz-audio-base";
  // 音频源可以在网址里指定，支持逗号分隔多个（从左到右依次尝试）：
  //   ?audio=/pjskaudio/,https://storage.sekai.best/sekai-jp-assets/music/short/
  // 选择会记在本机浏览器里。公共资产库会按来源站拦截，见 README「如果试听加载不出来」。
  function normalizeBase(raw) {
    const base = String(raw || "").trim();
    if (!base) return "";
    return base.includes("{v}") || base.endsWith("/") ? base : `${base}/`;
  }

  const AUDIO_SOURCES = (() => {
    // 同域 /audio/ 永远排第一：它不受来源站白名单影响，也不依赖任何外部域名。
    // 用户之前用 ?audio= 存下的地址只作为"额外候选"排在后面，不能压掉默认值。
    const list = [DEFAULT_AUDIO_BASE];
    const add = (raw) => {
      const base = normalizeBase(raw);
      if (base && !list.includes(base)) list.push(base);
    };
    try {
      const param = new URLSearchParams(window.location.search).get("audio");
      if (param) {
        param.split(",").forEach(add);
        window.localStorage.setItem(AUDIO_BASE_KEY, list.slice(1).join(","));
      } else {
        const saved = window.localStorage.getItem(AUDIO_BASE_KEY);
        if (saved) saved.split(",").forEach(add);
      }
    } catch {
      /* 隐私模式下 localStorage 可能不可用，忽略即可 */
    }
    add(REMOTE_AUDIO_BASE);
    return list;
  })();
  const AUDIO_BASE = AUDIO_SOURCES[0];
  // 供"音频自检"和排查使用：暴露当前实际使用的音频源顺序。
  try {
    window.__PJSK_AUDIO = { sources: AUDIO_SOURCES.slice(), base: AUDIO_BASE };
  } catch {
    /* ignore */
  }
  const STORAGE_KEY = "pjsk-quiz-v1";

  /* ============ DOM ============ */
  const $ = (id) => document.getElementById(id);
  const els = {
    quizStage: $("quizStage"),
    heroSongCount: $("heroSongCount"),
    heroRoundCount: $("heroRoundCount"),
    dataDate: $("dataDate"),
    roundPill: $("roundPill"),
    streakPill: $("streakPill"),
    quizIntro: $("quizIntro"),
    introTitle: $("introTitle"),
    introSub: $("introSub"),
    introHint: $("introHint"),
    startBtn: $("startBtn"),
    startBtnLabel: $("startBtnLabel"),
    quizPlay: $("quizPlay"),
    speakerPlay: $("speakerPlay"),
    bits: $("speakerPlay"),
    wave: $("wave"),
    playTimer: $("playTimer"),
    stopBtn: $("stopBtn"),
    quizAnswer: $("quizAnswer"),
    timerFill: $("timerFill"),
    timerNum: $("timerNum"),
    answerInput: $("answerInput"),
    suggest: $("suggest"),
    guessEcho: $("guessEcho"),
    fuzzyBox: $("fuzzyBox"),
    pickInfo: $("pickInfo"),
    skipBtn: $("skipBtn"),
    submitBtn: $("submitBtn"),
    answerHint: $("answerHint"),
    quizReveal: $("quizReveal"),
    revealBadge: $("revealBadge"),
    revealNote: $("revealNote"),
    revealDate: $("revealDate"),
    revealFragment: $("revealFragment"),
    cover: $("cover"),
    coverAppend: $("coverAppend"),
    coverImg: $("coverImg"),
    coverNote: $("coverNote"),
    songTitle: $("songTitle"),
    songOriginal: $("songOriginal"),
    resultTags: $("resultTags"),
    nextBtn: $("nextBtn"),
    replayBtn: $("replayBtn"),
    quizUnderline: $("quizUnderline"),
    hardcore: $("hardcore"),
    stopGame: $("stopGame"),
    groupChips: $("groupChips"),
    difficultyChips: $("difficultyChips"),
    clipRange: $("clipRange"),
    clipValue: $("clipValue"),
    thinkChips: $("thinkChips"),
    thinkValue: $("thinkValue"),
    resetAll: $("resetAll"),
    poolCount: $("poolCount"),
    playedCount: $("playedCount"),
    poolSub: $("poolSub"),
    changeSettings: $("changeSettings"),
    statsMeta: $("statsMeta"),
    statAnswered: $("statAnswered"),
    statCorrect: $("statCorrect"),
    statRate: $("statRate"),
    statStreak: $("statStreak"),
    statAvg: $("statAvg"),
    statScore: $("statScore"),
    rounds: $("rounds"),
    shareCanvas: $("shareCanvas"),
    toast: $("toast"),
    liveSummary: $("liveSummary"),
    audio: $("audio"),
  };
  const exportButtons = Array.from(document.querySelectorAll("[data-export]"));

  /* ============ 通用 ============ */
  function shuffleIndex(length) {
    if (length <= 0) return 0;
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const limit = Math.floor(0x100000000 / length) * length;
      const buffer = new Uint32Array(1);
      do window.crypto.getRandomValues(buffer);
      while (buffer[0] >= limit);
      return buffer[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function randomItem(list) {
    return list[shuffleIndex(list.length)];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseHashQuery() {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return {};
    const params = new URLSearchParams(raw);
    const pick = (key) => params.getAll(key).filter(Boolean);
    const num = (key) => {
      const value = Number.parseInt(params.get(key) || "", 10);
      return Number.isFinite(value) ? value : null;
    };
    return {
      groups: pick("g").filter((id) => GROUP_BY_ID[id]),
      diffs: pick("d").filter((id) => DIFF_BY_ID[id]),
      clip: num("clip"),
      think: num("think"),
      hard: params.get("hard") === "1",
    };
  }

  function toast(message, duration = 2400) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), duration);
  }

  /* ============ 状态 ============ */
  const overlay = parseHashQuery();

  const defaultSettings = () => ({
    groups: (overlay.groups || []).length ? new Set(overlay.groups) : new Set(GROUPS.map((g) => g.id)),
    diffs: (overlay.diffs || []).length ? new Set(overlay.diffs) : new Set(),
    clip: overlay.clip && overlay.clip >= CLIP_MIN && overlay.clip <= CLIP_MAX ? overlay.clip : 8,
    think: overlay.think !== null && THINK_CHOICES.includes(overlay.think) ? overlay.think : 30,
    hard: Boolean(overlay.hard),
  });

  const defaultState = () => ({
    settings: defaultSettings(),
    score: 0,
    carousel: [],
    played: new Set(),
    answers: [],
  });

  let round = null; // 当前题目
  let saving = 0; // 本轮未写入 localStorage 的作答数据
  const ui = {
  phase: "idle",
  startedAt: 0,
  timer: 0,
  timerEnd: 0,
  selected: -1,
};
let state = defaultState();

  function loadState() {
    const fresh = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      const saved = JSON.parse(raw);
      if (saved && saved.settings) {
        if (Array.isArray(saved.settings.groups)) {
          const groups = saved.settings.groups.filter((id) => GROUP_BY_ID[id]);
          if (groups.length) fresh.settings.groups = new Set(groups);
        }
        if (Array.isArray(saved.settings.diffs)) {
          fresh.settings.diffs = new Set(saved.settings.diffs.filter((id) => DIFF_BY_ID[id]));
        }
        if (Number.isFinite(saved.settings.clip)) {
          fresh.settings.clip = clamp(Math.round(saved.settings.clip), CLIP_MIN, CLIP_MAX);
        }
        if (THINK_CHOICES.includes(saved.settings.think)) fresh.settings.think = saved.settings.think;
        fresh.settings.hard = Boolean(saved.settings.hard);
      }
      if (saved && Array.isArray(saved.answers)) {
        fresh.answers = saved.answers.filter(
          (a) => a && SONG_BY_ID.has(a.i) && (a.m === 1 || a.m === 0 || a.m === -1),
        );
        fresh.score = fresh.answers.reduce((sum, a) => sum + (a.pts || 0), 0);
        fresh.played = new Set(fresh.answers.filter((a) => a.m !== -1).map((a) => a.i));
      }
    } catch {
      return defaultState();
    }
    return fresh;
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: 1,
          settings: {
            groups: [...state.settings.groups],
            diffs: [...state.settings.diffs],
            clip: state.settings.clip,
            think: state.settings.think,
            hard: state.settings.hard,
          },
          answers: state.answers.slice(-400),
        }),
      );
    } catch {
      /* 隐私模式等场景静默失败 */
    }
  }

  /* ============ 音频 ============ */
  const audio = els.audio;
  let currentAudioSong = 0;

  function buildUrl(base, name) {
    return base.includes("{v}") || base.includes("{f}")
      ? base.replace("{v}", name).replace("{f}", "_short")
      : `${base}${name}/${name}_short.mp3`;
  }

  function clipsFor(song) {
    // 按歌曲变体 × 来源基址展开，去重后按顺序尝试；任一通路成功就能玩。
    const all = [];
    for (const base of AUDIO_SOURCES) {
      for (const name of song.av || []) all.push(buildUrl(base, name));
    }
    // 源站已在 AUDIO_SOURCES 末尾，这里无需重复追加。
    return [...new Set(all.filter(Boolean))];
  }

  audio.addEventListener("ended", () => {
    if (ui.phase === "playing") endSegment();
  });
  // 用 audio 自己的时钟收尾，别用 rAF：切到后台标签页时 rAF 会停。
  audio.addEventListener("timeupdate", () => {
    updatePlayTimer();
    if (ui.phase === "playing" && round && audio.currentTime >= round.end - 0.05) {
      endSegment();
    }
  });
  audio.addEventListener("error", () => {
    if (ui.phase === "playing") endSegment();
  });

  // 手机弱网下偶尔会 stall。这里先尝试自己恢复，恢复不了就提前进入作答，
  // 不让用户对着卡住的界面干等。
  let stallTimer = 0;
  const clearStall = () => {
    if (stallTimer) {
      window.clearTimeout(stallTimer);
      stallTimer = 0;
    }
  };
  audio.addEventListener("waiting", () => {
    if (ui.phase !== "playing") return;
    clearStall();
    stallTimer = window.setTimeout(() => {
      if (ui.phase !== "playing") return;
      audio.play().catch(() => {});
      window.setTimeout(() => {
        if (ui.phase !== "playing") return;
        if (audio.paused || audio.readyState < 3) {
          toast("网络不太稳定，片段提前结束", 2600);
          endSegment();
        }
      }, 1200);
    }, 1500);
  });
  audio.addEventListener("playing", clearStall);
  audio.addEventListener("canplay", clearStall);
  audio.addEventListener("ended", clearStall);

  function updatePlayTimer() {
    if (!round) return;
    const full = round.clip;
    const played = clamp(audio.currentTime - round.start, 0, full);
    els.playTimer.textContent = `${played.toFixed(1)} / ${full.toFixed(1)} s`;
  }

  // 预取缓存：答完一题就悄悄下载下一题的 short.ver，轮到它时秒开。
  const clipCache = new Map();
  const clipInflight = new Set();
  const CLIP_CACHE_LIMIT = 8;

  function rememberClip(url, blob) {
    if (clipCache.size >= CLIP_CACHE_LIMIT) {
      const oldest = clipCache.keys().next().value;
      if (oldest) clipCache.delete(oldest);
    }
    clipCache.set(url, blob);
  }

  function prefetchClip(song) {
    if (ui.phase === "playing") return; // 播放期间不抢带宽
    const urls = clipsFor(song).slice(0, 1); // 只预取最可能用到的那一路
    for (const url of urls) {
      if (clipCache.has(url) || clipInflight.has(url)) continue;
      clipInflight.add(url);
      fetch(url, { credentials: "omit", cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          if (!blob.size) return;
          rememberClip(url, blob);
          if (currentClipSong && currentClipSong.i === song.i) {
            // 当前题刚好缺音频，补上重试一次。
            retryCurrentClip();
          }
        })
        .catch(() => {})
        .finally(() => clipInflight.delete(url));
      break;
    }
  }

  let currentClipSong = null;
  let retriedClip = false;

  function retryCurrentClip() {
    if (retriedClip || !currentClipSong || ui.phase === "playing") return;
    retriedClip = true;
    els.startBtn.disabled = false;
    els.startBtnLabel.textContent = "音频就绪，开始播放";
    toast("试听已下载好，再点一次开始吧", 3000);
  }

  function warmNextClip() {
    const upcoming = state.carousel[0];
    if (upcoming) prefetchClip(upcoming);
  }

  // 每路音频最多等 4 秒；全部失败时返回 {ok:false, error:true}，
  // 和"这首歌没有试听"区分开，给出不同的提示。
  // 下载整首 short.ver 到内存再播放。
  // 边下边播在手机 / 弱网下很容易中途断流（表现就是音乐停住、动画停住），
  // 而整首只有几百 KB，先缓冲完再播最稳。
  async function fetchClipBlob(url) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller
      ? window.setTimeout(() => controller.abort(), 15000)
      : 0;
    try {
      const response = await fetch(url, {
        cache: "force-cache",
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("empty body");
      return blob;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  function loadClip(song, clip) {
    return new Promise((resolve) => {
      let source = 0;
      let settled = false;
      let timer = 0;
      let sawSource = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        resolve(result);
      };
      audio.pause();
      audio.removeAttribute("src");
      retriedClip = false;
      currentClipSong = song;
      const sources = clipsFor(song);

      const useBlob = (blob, url, cached) => {
        audio.src = URL.createObjectURL(blob);
        audio.load();
        audio.onloadedmetadata = () => {
          window.clearTimeout(timer);
          if (!Number.isFinite(audio.duration) || audio.duration < clip + 1) {
            source += 1;
            attempt();
            return;
          }
          currentAudioSong = song.i;
          finish({ ok: true, error: false, url, cached, buffered: true });
        };
        audio.onerror = () => {
          window.clearTimeout(timer);
          source += 1;
          attempt();
        };
      };

      const attempt = async () => {
        if (source >= sources.length) {
          finish({
            ok: false,
            error: true,
            reachable: sawSource,
            lastUrl: sources[sources.length - 1],
          });
          return;
        }
        const url = sources[source];

        // 1) 预取缓存命中
        const cached = clipCache.get(url);
        if (cached) {
          sawSource = true;
          useBlob(cached, url, true);
          return;
        }

        // 2) 先整段下载
        timer = window.setTimeout(() => {
          source += 1;
          attempt();
        }, 15000);
        try {
          const blob = await fetchClipBlob(url);
          window.clearTimeout(timer);
          sawSource = true;
          rememberClip(url, blob);
          if (settled) return;
          useBlob(blob, url, false);
        } catch {
          window.clearTimeout(timer);
          // 3) 下载失败时退回边下边播，至少还有机会出声
          if (settled) return;
          timer = window.setTimeout(() => {
            source += 1;
            attempt();
          }, 9000);
          audio.src = url;
          audio.load();
          audio.onloadedmetadata = () => {
            window.clearTimeout(timer);
            sawSource = true;
            if (!Number.isFinite(audio.duration) || audio.duration < clip + 1) {
              source += 1;
              attempt();
              return;
            }
            currentAudioSong = song.i;
            finish({ ok: true, error: false, url, buffered: false });
          };
          audio.onerror = () => {
            window.clearTimeout(timer);
            source += 1;
            attempt();
          };
        }
      };
      attempt();
    });
  }

  function pickSegment(song, clip) {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 32;
    const maxStart = Math.max(0, duration - clip - 1);
    const lo = Math.min(CLIP_START_MARGIN, maxStart);
    const hi = Math.max(lo, Math.min(duration - clip - CLIP_END_MARGIN, maxStart));
    const start = Math.round((lo + Math.random() * (hi - lo)) * 10) / 10;
    return { start, end: Math.round((start + clip) * 10) / 10 };
  }

  function playClip(song) {
    if (currentAudioSong !== song.i) return false;
    audio.currentTime = round.start;
    audio.play().catch(() => {});
    return true;
  }

  /* ============ 曲池 ============ */
  function inRange(song) {
    if (!song.g.some((id) => state.settings.groups.has(id))) return false;
    if (state.settings.diffs.size === 0) return true;
    return [...state.settings.diffs].every((diff) => song.d[diff] != null);
  }

  function quizPool() {
    return QUIZ_SONGS.filter(inRange);
  }

  function buildCarousel() {
    const pool = quizPool();
    const fresh = pool.filter((song) => !state.played.has(song.i));
    const source = fresh.length ? fresh : pool;
    if (!source.length) {
      state.carousel = [];
      return;
    }
    state.carousel = source
      .map((song) => ({ song, order: Math.random() }))
      .sort((a, b) => a.order - b.order)
      .map((item) => item.song);
    if (!fresh.length && pool.length) toast("曲池里能出的歌都出过了，已重新洗牌");
  }

  function nextSong() {
    if (!state.carousel.length) buildCarousel();
    return state.carousel.shift();
  }

  /* ============ 渲染：结果与标签 ============ */
  function groupObjects(song) {
    const set = new Set(song.g);
    const units = GROUPS.filter((group) => group.unit && set.has(group.id));
    const result = [];
    if (units.length === UNIT_IDS.length) result.push(ALL_UNITS_GROUP);
    else result.push(...units);
    if (set.has("vocaloid")) result.push(GROUP_BY_ID.vocaloid);
    if (set.has("other")) result.push(GROUP_BY_ID.other);
    if (!result.length) result.push(GROUP_BY_ID.other);
    return result;
  }

  function coverColors(song) {
    const units = GROUPS.filter((group) => group.unit && song.g.includes(group.id));
    if (units.length === UNIT_IDS.length) return COVER_PAIRS.all_units;
    const key = units[0]?.id || (song.g.includes("vocaloid") ? "vocaloid" : "other");
    return COVER_PAIRS[key] || COVER_PAIRS.other;
  }

  function fillSong(song, fragmentText) {
    const colors = coverColors(song);
    els.songTitle.textContent = song.c;
    if (song.c !== song.t) {
      els.songOriginal.textContent = `原名 · ${song.t}`;
      els.songOriginal.hidden = false;
    } else {
      els.songOriginal.hidden = true;
    }
    els.revealDate.textContent = `国服上线 ${song.p}`;
    if (fragmentText) {
      els.revealFragment.textContent = fragmentText;
      els.revealFragment.hidden = false;
    } else {
      els.revealFragment.hidden = true;
    }
    els.cover.style.setProperty("--cover-a", colors[0]);
    els.cover.style.setProperty("--cover-b", colors[1]);
    els.coverAppend.hidden = true;

    els.resultTags.replaceChildren();
    GROUPS.forEach((group) => {
      const level = song.d[group.id];
      if (level == null) return;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.style.setProperty("--tag-color", group.color);
      tag.textContent = group.short;
      els.resultTags.append(tag);
    });
  }

  /* ============ 设置 UI ============ */
  function renderGroupChips() {
    els.groupChips.replaceChildren();
    GROUPS.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.id = group.id;
      button.style.setProperty("--accent", group.color);
      button.setAttribute("aria-pressed", String(state.settings.groups.has(group.id)));
      const dot = document.createElement("span");
      dot.className = "chip-dot";
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = group.label;
      const count = document.createElement("span");
      count.className = "chip-count";
      button.append(dot, label, count);
      button.addEventListener("click", () => {
        // 题中也可以改范围，改动在「应用新设置」或下一题开始时生效。
        const set = state.settings.groups;
        if (set.has(group.id)) set.delete(group.id);
        else set.add(group.id);
        syncSettingsUI();
        saveState();
      });
      els.groupChips.append(button);
    });
  }

  function renderDiffChips() {
    els.difficultyChips.replaceChildren();
    const none = document.createElement("button");
    none.type = "button";
    none.className = "chip";
    none.dataset.id = "any";
    none.style.setProperty("--accent", "#8aa0a3");
    none.innerHTML = '<span class="chip-dot" aria-hidden="true"></span><span>不限</span>';
    none.setAttribute("aria-pressed", String(state.settings.diffs.size === 0));
    none.addEventListener("click", () => {
      state.settings.diffs.clear();
      syncSettingsUI();
      saveState();
    });
    els.difficultyChips.append(none);

    DIFFS.forEach((diff) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.id = diff.id;
      button.style.setProperty("--accent", diff.color);
      button.setAttribute("aria-pressed", String(state.settings.diffs.has(diff.id)));
      const dot = document.createElement("span");
      dot.className = "chip-dot";
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = diff.label;
      const count = document.createElement("span");
      count.className = "chip-count";
      button.append(dot, label, count);
      button.addEventListener("click", () => {
        const set = state.settings.diffs;
        if (set.has(diff.id)) set.delete(diff.id);
        else set.add(diff.id);
        syncSettingsUI();
        saveState();
      });
      els.difficultyChips.append(button);
    });
  }

  function renderThinkChips() {
    els.thinkChips.replaceChildren();
    THINK_CHOICES.forEach((seconds) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.think = String(seconds);
      button.style.setProperty("--accent", "#8f72d6");
      button.setAttribute("aria-pressed", String(state.settings.think === seconds));
      button.innerHTML = `<span class="chip-dot" aria-hidden="true"></span><span>${
        seconds === 0 ? "不限时" : `${seconds} 秒`
      }</span>`;
      button.addEventListener("click", () => {
        state.settings.think = seconds;
        syncSettingsUI();
        saveState();
      });
      els.thinkChips.append(button);
    });
  }

  function syncSettingsUI() {
    const pool = quizPool();
    els.groupChips.querySelectorAll(".chip").forEach((button) => {
      const active = state.settings.groups.has(button.dataset.id);
      button.setAttribute("aria-pressed", String(active));
      const count = button.querySelector(".chip-count");
      if (count) {
        // 计数表示"加上这个分类后，曲池会多出多少首"。
        const others = [...state.settings.groups].filter((id) => id !== button.dataset.id);
        const added = QUIZ_SONGS.filter(
          (song) =>
            song.g.includes(button.dataset.id) &&
            (others.length === 0 || !others.some((id) => song.g.includes(id))),
        ).length;
        count.textContent = String(added);
      }
    });
    els.difficultyChips.querySelectorAll(".chip").forEach((button) => {
      const id = button.dataset.id;
      const active = id === "any" ? state.settings.diffs.size === 0 : state.settings.diffs.has(id);
      button.setAttribute("aria-pressed", String(active));
      const count = button.querySelector(".chip-count");
      if (count && id !== "any") {
        const others = [...state.settings.diffs].filter((d) => d !== id);
        count.textContent = String(
          QUIZ_SONGS.filter(
            (song) => song.d[id] != null && others.every((d) => song.d[d] != null),
          ).length,
        );
      }
    });
    els.thinkChips.querySelectorAll(".chip").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.think) === state.settings.think),
      );
    });
    els.hardcore.checked = state.settings.hard;
    els.clipRange.value = String(state.settings.clip);
    els.clipValue.textContent = `${state.settings.clip} 秒`;
    els.thinkValue.textContent =
      state.settings.think === 0 ? "不限时" : `${state.settings.think} 秒`;
    els.poolCount.textContent = String(pool.length);
    els.playedCount.textContent = String(state.played.size);
    els.poolSub.textContent = `猜歌可用 ${QUIZ_SONGS.length} 首${
      pool.length === QUIZ_SONGS.length ? "" : ` · 当前范围 ${pool.length} 首`
    } · 国服独占曲目暂无公开试听`;
    els.changeSettings.disabled = pool.length === 0;
    els.startBtn.disabled = pool.length === 0;
    els.introHint.textContent = pool.length
      ? "按空格键也可以开始。"
      : "当前范围里没有可猜的歌，先放宽组合或难度。";
  }

  /* ============ 主流程 ============ */
  function showOnly(phase) {
    els.quizIntro.hidden = phase !== "intro";
    els.quizPlay.hidden = phase !== "playing";
    els.quizAnswer.hidden = phase !== "answering";
    els.quizReveal.hidden = phase !== "reveal";
    els.quizUnderline.hidden = phase !== "playing" && phase !== "answering";
  }

  function setIntro() {
    ui.phase = "intro";
    showOnly("intro");
    els.startBtn.disabled = quizPool().length === 0;
    if (round && round.resume) {
      els.introTitle.textContent = "继续这一题";
      els.introSub.textContent = "刚才的片段已经放完，准备好后点击显示答案。";
      els.startBtnLabel.textContent = "开始作答";
    } else {
      els.introTitle.textContent = "准备好了吗？";
      els.introSub.textContent = "点「开始播放」，片段会随机裁切，听完后限时作答。";
      els.startBtnLabel.textContent = "开始播放";
    }
    syncSettingsUI();
    renderStats();
  }

  async function startRound() {
    if (ui.phase === "playing") {
      endSegment();
      return;
    }
    if (round && round.resume) {
      beginAnswering();
      return;
    }
    const song = nextSong();
    if (!song) {
      toast("曲池为空，先放宽筛选吧");
      return;
    }
    const clip = state.settings.clip;
    els.startBtn.disabled = true;
    els.startBtnLabel.textContent = "载入片段…";
    round = { song, clip, start: 0, end: 0, resume: false };
    const loaded = FORCE_FAIL
      ? { ok: false, error: true, reachable: false }
      : await loadClip(song, clip);
    if (!loaded.ok) {
      els.startBtn.disabled = false;
      els.startBtnLabel.textContent = "重新开始";
      round = null;
      if (!loaded.reachable) {
        // 所有音频地址都没应答：先探测一次，判断是"网络连不上"还是"来源站拒绝"。
        const verdict = await diagnoseAudio();
        enterFallbackMode(verdict);
        beginFallbackRound(song, clip);
        return;
      }
      toast("这首的试听还没更新到，换下一题吧");
      // 顺手在后台预取这首歌，失败时用户再点一次就有机会秒开。
      if (song) prefetchClip(song);
      return;
    }
    const segment = pickSegment(song, clip);
    round.start = segment.start;
    round.end = segment.end;
    round.location = `${segment.start.toFixed(1)} – ${segment.end.toFixed(1)} s`;
    beginPlaying();
  }

  /* ---- 无音频备用模式：音频站按来源站拦截，浏览器拿不到音频时 ---- */
  // 探测一次，判定失败原因：网络不通 / 被来源站拒绝 / 其他
  async function diagnoseAudio() {
    const probeUrl = buildUrl(AUDIO_SOURCES[0], "0001_01");
    const started = performance.now();
    // 探测本身必须有超时：否则网络挂起时会把"进入作答"拖很久。
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const abortTimer = controller
      ? window.setTimeout(() => controller.abort(), 6000)
      : 0;
    try {
      const response = await fetch(probeUrl, {
        method: "GET",
        cache: "no-store",
        ...(controller ? { signal: controller.signal } : {}),
      });
      window.clearTimeout(abortTimer);
      const ms = Math.round(performance.now() - started);
      if (response.ok || response.status === 206) {
        return { kind: "ok", ms };
      }
      // 能拿到 HTTP 状态码 → 网络是通的，问题在服务端
      return { kind: "server", status: response.status, ms };
    } catch (error) {
      window.clearTimeout(abortTimer);
      const ms = Math.round(performance.now() - started);
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      // 规则：请求压根没拿到响应（TypeError / 超时）都算"网络层失败"
      return { kind: offline ? "offline" : "network", ms, message: error && error.message };
    }
  }

  function enterFallbackMode(verdict) {
    ui.fallback = true;
    document.body.classList.add("quiz-no-audio");
    const reason = verdict && verdict.kind;
    if (reason === "network" || reason === "offline") {
      toast("试听音频连不上（网络或 CDN 可达性问题），已切换为「无音频出题」模式", 5000);
    } else if (reason === "server") {
      toast("试听音频被服务端拒绝，已切换为「无音频出题」模式；点条幅可看解决办法", 5000);
    } else {
      toast("试听音频未能加载，已切换为「无音频出题」模式；点条幅可看解决办法", 5000);
    }
    showFallbackBanner(verdict);
  }

  function showFallbackBanner(verdict) {
    const existing = document.getElementById("audioFallbackBar");
    if (existing) existing.remove();
    const bar = document.createElement("div");
    bar.id = "audioFallbackBar";
    bar.className = "audio-fallback-bar";
    const icon = document.createElement("span");
    icon.className = "audio-fallback-icon";
    icon.textContent = "🔇";
    const text = document.createElement("div");
    text.className = "audio-fallback-text";
    const title = document.createElement("strong");
    title.textContent = "无音频出题模式";
    const desc = document.createElement("span");
    const kind = verdict && verdict.kind;
    if (kind === "network" || kind === "offline") {
      desc.textContent = "浏览器连不上音频地址（网络 / CDN 可达性）。点这里看解决办法。";
    } else if (kind === "server") {
      desc.textContent = `音频服务回应了 ${verdict.status}，拒绝了这次请求。点这里看解决办法。`;
    } else {
      desc.textContent = "音频加载失败。点这里看解决办法。";
    }
    text.append(title, desc);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "audio-fallback-close";
    close.setAttribute("aria-label", "关闭提示");
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      bar.remove();
    });
    bar.append(icon, text, close);
    bar.addEventListener("click", () => {
      document.getElementById("openAudioHelp").click();
    });
    els.quizStage.prepend(bar);
  }

  function beginFallbackRound(song, clip) {
    round = {
      song,
      clip,
      resume: false,
      fallback: true,
      start: 0,
      end: 0,
      location: "",
    };
    els.startBtn.disabled = false;
    els.startBtnLabel.textContent = "开始出题";
    ui.phase = "playing";
    showOnly("playing");
    els.speakerPlay.classList.remove("is-playing");
    els.playTimer.textContent = "本模式不播放音频";
    els.roundPill.textContent = `第 ${state.answers.length + 1} 题`;
    els.wave.replaceChildren();
    for (let i = 0; i < 22; i += 1) {
      const bar = document.createElement("i");
      bar.style.animationDelay = `${(i * 0.07).toFixed(2)}s`;
      bar.style.animationDuration = `${(0.8 + Math.random() * 0.7).toFixed(2)}s`;
      els.wave.append(bar);
    }
    els.stopBtn.querySelector("span:last-child").textContent = "开始作答";
    window.setTimeout(() => {
      if (ui.phase === "playing" && round && round.fallback) endSegment();
    }, 900);
  }

  // 用真实数据里的第一首构造一个"所有音频来源都失败"的场景，便于自检兜底流程。
  const FORCE_FAIL = new URLSearchParams(window.location.search).get("forceaudio") === "fail";

  function beginPlaying() {
    ui.phase = "playing";
    showOnly("playing");
    els.speakerPlay.classList.add("is-playing");
    els.roundPill.textContent = `第 ${state.answers.length + 1} 题`;
    els.wave.replaceChildren();
    for (let i = 0; i < 22; i += 1) {
      const bar = document.createElement("i");
      bar.style.animationDelay = `${(i * 0.07).toFixed(2)}s`;
      bar.style.animationDuration = `${(0.8 + Math.random() * 0.7).toFixed(2)}s`;
      els.wave.append(bar);
    }
    playClip(round.song);
    ui.startedAt = Date.now();
    updatePlayTimer();
    startPlayWatchdog(round.clip);
  }

  // 兜底：无论音频是否真的在走（自动播放被拦、解码失败、后台节流），
  // 到时间都必须进入作答，绝不能让用户卡在"片段播放中"。
  function startPlayWatchdog(clip) {
    window.clearTimeout(ui.playdog);
    // 完整缓冲过的情况下，正常在 clip 秒内结束；这里留足余量只作最后保险。
    const limit = (clip + 6) * 1000;
    ui.playdog = window.setTimeout(() => {
      if (ui.phase === "playing") endSegment();
    }, limit);
  }

  function endSegment() {
    if (ui.phase !== "playing") return;
    window.clearTimeout(ui.playdog);
    audio.pause();
    els.speakerPlay.classList.remove("is-playing");
    els.stopBtn.querySelector("span:last-child").textContent = "立即作答";
    beginAnswering();
  }

  function beginAnswering() {
    if (!round) return;
    round.answerStart = Date.now();
    ui.phase = "answering";
    showOnly("answering");
    els.answerInput.value = "";
    els.suggest.hidden = true;
    els.fuzzyBox.hidden = true;
    els.guessEcho.hidden = true;
    els.suggest.replaceChildren();
    els.fuzzyBox.replaceChildren();
    fuzzyList = [];
    els.pickInfo.textContent = "候选里没有？直接输入歌名搜索";
    els.submitBtn.disabled = true;
    els.submitBtn.querySelector("span:last-child").textContent = "确认答案";
    ui.selected = -1;
    els.liveSummary.textContent = "片段已结束，请作答。";

    // 干扰候选
    const pool = quizPool();
    const sameGroup = pool.filter(
      (song) => song.i !== round.song.i && song.g.some((id) => round.song.g.includes(id)),
    );
    const rest = pool.filter((song) => song.i !== round.song.i && !sameGroup.includes(song));
    const candidates = [round.song];
    for (let i = 0; i < 5 && sameGroup.length; i += 1) {
      candidates.push(sameGroup.splice(shuffleIndex(sameGroup.length), 1)[0]);
    }
    for (let i = 0; i < 3 && rest.length; i += 1) {
      candidates.push(rest.splice(shuffleIndex(rest.length), 1)[0]);
    }
    round.candidates = candidates
      .filter(Boolean)
      .map((song) => ({ song, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .map((item) => item.song);
    round.selected = null;
    renderSuggest(round.candidates);

    if (state.settings.think > 0) {
      ui.timerEnd = Date.now() + state.settings.think * 1000;
      els.timerFill.classList.remove("is-low", "is-critical");
      tickTimer();
    } else {
      cancelAnimationFrame(ui.timer);
      els.timerFill.style.width = "100%";
      els.timerFill.classList.remove("is-low", "is-critical");
      els.timerNum.textContent = "∞";
    }
    els.answerInput.focus();
    warmNextClip();
  }

  function tickTimer() {
    cancelAnimationFrame(ui.timer);
    const total = state.settings.think * 1000;
    const tick = () => {
      if (ui.phase !== "answering") return;
      const left = Math.max(0, ui.timerEnd - Date.now());
      const ratio = total ? left / total : 1;
      els.timerFill.style.width = `${(ratio * 100).toFixed(1)}%`;
      els.timerNum.textContent = `${Math.ceil(left / 1000)}s`;
      els.timerFill.classList.toggle("is-low", ratio <= 0.34 && ratio > 0.15);
      els.timerFill.classList.toggle("is-critical", ratio <= 0.15);
      if (left <= 0) {
        submitAnswer(round && round.selected ? round.selected : null, els.answerInput.value.trim());
        return;
      }
      ui.timer = requestAnimationFrame(tick);
    };
    ui.timer = requestAnimationFrame(tick);
  }

  let fuzzyList = [];

  function chooseSong(song) {
    if (ui.phase !== "answering") return;
    round.selected = song;
    els.answerInput.value = song.c === song.t ? song.c : `${song.c} / ${song.t}`;
    els.pickInfo.textContent = `已选：${song.c}`;
    els.submitBtn.disabled = false;
    els.suggest.hidden = true;
    els.fuzzyBox.hidden = true;
    els.guessEcho.hidden = true;
    ui.selected = -1;
    renderStats();
  }

  function answerNames(song) {
    return FUZZY && FUZZY.PAIRS.length ? FUZZY.titlePairs(song.i) : [song.c, song.t];
  }

  function sameSong(guess, song) {
    if (!guess) return false;
    if (FUZZY) return FUZZY.judge(guess, song, answerNames).ok;
    return guess.i === song.i || guess.c === song.c || guess.t === song.t;
  }

  function suggestPool() {
    // 候选局限在当前曲池里：曲池太小时补上全部可猜曲目，避免搜不到干扰项。
    const pool = quizPool();
    return pool.length >= 20 ? pool : QUIZ_SONGS;
  }

  // 把输入当作"我的答案"：先尝试模糊命中正确答案，其次找高分候选。
  function resolvePicked(text) {
    const typed = String(text || "").trim();
    if (!typed) return null;
    const exact = matchTyped(typed);
    if (exact) return exact;
    if (FUZZY) {
      // 输入形如 "中文名 / 原名"，取其中一段看看是否是某首歌。
      const parts = typed.split(/[\/／|｜]/).map((part) => part.trim()).filter(Boolean);
      for (const part of parts) {
        const hit = matchTyped(part);
        if (hit) return hit;
      }
    }
    return null;
  }

  function matchTyped(text) {
    const q = String(text || "").trim().toLowerCase();
    if (!q) return null;
    const pool = suggestPool();
    for (const song of pool) {
      if (song.c.toLowerCase() === q || song.t.toLowerCase() === q) return song;
      if (`${song.c} / ${song.t}`.toLowerCase() === q) return song;
    }
    if (FUZZY) {
      const fuzzy = FUZZY.suggestSongs(text, pool, 1);
      if (fuzzy.length && fuzzy[0].score >= 96) return fuzzy[0].song;
    }
    return null;
  }

  function resolveGuess(text) {
    const base = suggestPool();
    const guesses = FUZZY ? FUZZY.suggestSongs(text, base, 5) : [];
    if (FUZZY) {
      // 正确答案被模糊命中时，直接让它排在第一位。
      const direct = FUZZY.judge(
        { i: -1, c: text, t: text },
        round.song,
        answerNames,
      );
      if (direct.ok) {
        const idx = guesses.findIndex((item) => item.song.i === round.song.i);
        if (idx > 0) guesses.splice(idx, 1);
        guesses.unshift({ song: round.song, score: Math.max(90, direct.score || 90) });
      }
    }
    return guesses;
  }

  function renderFuzzy(text) {
    fuzzyList = [];
    els.fuzzyBox.hidden = true;
    els.fuzzyBox.replaceChildren();
    if (!FUZZY || !round || !text.trim()) return;
    const items = resolveGuess(text);
    if (!items.length) {
      els.fuzzyTitle = null;
      const hint = document.createElement("p");
      hint.className = "fuzzy-empty";
      hint.textContent = "没找到相近的曲名。可以只输入一两个关键字，或按 Backspace 继续挑候选。";
      const title = document.createElement("div");
      title.className = "fuzzy-title";
      title.textContent = "模糊匹配";
      els.fuzzyBox.append(title, hint);
      els.fuzzyBox.hidden = false;
      return;
    }
    fuzzyList = items;
    ui.selected = 0;
    els.fuzzyBox.append(buildFuzzyContent());
    els.fuzzyBox.hidden = false;
  }

  function buildFuzzyContent() {
    const wrap = document.createDocumentFragment();
    const title = document.createElement("div");
    title.className = "fuzzy-title";
    title.textContent = "模糊匹配 · 最接近的曲目";
    wrap.append(title);
    fuzzyList.forEach((item, index) => {
      const song = item.song;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fuzzy-item";
      button.setAttribute("aria-selected", String(index === ui.selected));
      const main = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = song.c;
      const small = document.createElement("small");
      small.textContent = song.c === song.t ? `${song.p} 上线` : `原名 · ${song.t}`;
      main.append(strong, small);
      const score = document.createElement("span");
      score.className = "fuzzy-score";
      const isAnswer = sameSong(song, round.song);
      score.textContent = `${item.score}%`;
      button.append(main, score);
      button.dataset.answer = String(isAnswer);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => chooseSong(song));
      wrap.append(button);
    });
    const actions = document.createElement("div");
    actions.className = "fuzzy-actions";
    const hint = document.createElement("span");
    hint.className = "fuzzy-hint";
    hint.textContent = "不是它？按 Backspace 改字，或点选其他候选。";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "fuzzy-ok";
    ok.textContent = "就选第一个";
    ok.addEventListener("click", () => {
      const first = fuzzyList[0];
      if (first) chooseSong(first.song);
    });
    actions.append(hint, ok);
    wrap.append(actions);
    return wrap;
  }

  function highlightFuzzy() {
    els.fuzzyBox.querySelectorAll(".fuzzy-item").forEach((item, index) => {
      item.setAttribute("aria-selected", String(index === ui.selected));
      if (index === ui.selected) item.scrollIntoView({ block: "nearest" });
    });
  }

  function updateEcho() {
    const text = els.answerInput.value.trim();
    if (!text || !round) {
      els.guessEcho.hidden = true;
      return;
    }
    els.guessEcho.replaceChildren();
    const label = document.createElement("span");
    label.textContent = "你输入的是：";
    const value = document.createElement("b");
    value.textContent = text;
    els.guessEcho.append(label, value);
    els.guessEcho.hidden = false;
  }

  function searchSongs(query) {
    const base = suggestPool();
    const text = query.trim().toLowerCase();
    if (!text) return round.candidates.slice(0, 8);
    const scored = [];
    base.forEach((song) => {
      const c = song.c.toLowerCase();
      const t = song.t.toLowerCase();
      let rank = -1;
      if (c.startsWith(text) || t.startsWith(text)) rank = 0;
      else if (c.includes(text) || t.includes(text)) rank = 1;
      else if (FUZZY) {
        const fuzzy = FUZZY.similarity(query, song.c);
        if (fuzzy >= 60) rank = 2;
      }
      if (rank >= 0) scored.push({ song, rank });
    });
    scored.sort((a, b) => a.rank - b.rank || a.song.c.length - b.song.c.length ||
      (a.song.c < b.song.c ? -1 : a.song.c > b.song.c ? 1 : 0));
    return scored.slice(0, 12).map((item) => item.song);
  }

  function renderSuggest(list) {
    els.suggest.replaceChildren();
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "suggest-empty";
      empty.textContent = "没有匹配的歌曲，换个关键词试试。";
      els.suggest.append(empty);
      els.suggest.hidden = false;
      return;
    }
    list.forEach((song, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggest-item";
      button.setAttribute("aria-selected", String(index === ui.selected));
      const main = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = song.c;
      const small = document.createElement("small");
      small.textContent = song.c === song.t ? `${song.p} 上线` : song.t;
      main.append(strong, small);
      const badge = document.createElement("span");
      badge.className = "suggest-group";
      badge.textContent = groupObjects(song)[0].short;
      button.append(main, badge);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => chooseSong(song));
      els.suggest.append(button);
    });
    els.suggest.hidden = false;
    els.suggest.dataset.count = String(list.length);
  }

  function moveSelection(delta) {
    const count = Number(els.suggest.dataset.count || "0");
    if (!count) return;
    ui.selected = (ui.selected + delta + count) % count;
    els.suggest.querySelectorAll(".suggest-item").forEach((item, index) => {
      item.setAttribute("aria-selected", String(index === ui.selected));
      if (index === ui.selected) item.scrollIntoView({ block: "nearest" });
    });
  }

  /* ============ 判定（模糊匹配） ============ */
  function judgeGuess(guess, typed) {
    // guess: 选中的歌曲对象；typed: 用户实际敲的字（可能比 guess 更"野生"）。
    if (guess && guess.i === round.song.i) return { ok: true, how: "exact" };
    if (FUZZY) {
      const typedResult = typed ? FUZZY.judge({ i: -1, c: typed, t: typed }, round.song, answerNames) : null;
      if (typedResult && typedResult.ok) return typedResult;
      if (guess) return FUZZY.judge(guess, round.song, answerNames);
    }
    if (guess) {
      const names = [round.song.c, round.song.t];
      if (names.includes(guess.c) || names.includes(guess.t)) return { ok: true, how: "exact" };
    }
    return { ok: false, how: "none" };
  }

  function submitAnswer(guessSong, typedText) {
    if (ui.phase !== "answering" || !round) return;
    cancelAnimationFrame(ui.timer);
    els.suggest.hidden = true;
    els.fuzzyBox.hidden = true;
    els.guessEcho.hidden = true;
    audio.pause();
    const elapsed = Math.max(0.2, (Date.now() - round.answerStart) / 1000);
    const typedClean = String(typedText || "").trim();
    // 有输入就算作答（哪怕没匹配到候选），只有真正空着提交才是"放弃"。
    const hasAnswer = Boolean(guessSong) || typedClean.length > 0;
    let judged = hasAnswer ? judgeGuess(guessSong, typedClean) : { ok: false, how: "none" };
    if (hasAnswer && !judged.ok && FUZZY && typedClean) {
      // 兜底：用户敲的字本身足够接近答案，就按模糊匹配通过处理。
      const direct = FUZZY.judge({ i: -1, c: typedClean, t: typedClean }, round.song, answerNames);
      if (direct.ok) judged = direct;
    }
    const correct = judged.ok;
    // m 的含义：1 = 猜对，0 = 猜错，-1 = 放弃。三者互斥，记录和统计都按它来显示。
    const mode = !hasAnswer ? -1 : correct ? 1 : 0;
    const limit = state.settings.think || 999;
    const speedBonus = correct && limit > 0 ? Math.round(400 * clamp(1 - elapsed / limit, 0, 1)) : 0;
    const pts = correct ? 1000 + speedBonus : hasAnswer ? -100 : 0;

    state.answers.push({
      i: round.song.i,
      m: mode,
      g: hasAnswer && guessSong ? guessSong.i : null,
      v: hasAnswer && typedClean ? typedClean.slice(0, 60) : null,
      h: hasAnswer ? judged.how : null,
      s: judged.score || null,
      t: Math.round(elapsed * 10) / 10,
      pts,
    });
    state.played.add(round.song.i);
    state.score += pts;
    saving += 1;
    if (saving >= 3) {
      saving = 0;
      saveState();
    }

    reveal(correct, mode, elapsed, pts, judged);
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

  function reveal(correct, mode, elapsed, pts, judged = { how: "none" }) {
    ui.phase = "reveal";
    showOnly("reveal");
    if (round.song.d.append) els.coverAppend.hidden = false;
    applyCover(round.song);
    const showFragment = !state.settings.hard && !ui.fallback && !round.fallback && !!round.location;
    fillSong(round.song, showFragment ? `片段位置 ${round.location}` : "");

    els.revealBadge.className = "reveal-badge";
    els.revealNote.classList.remove("is-fuzzy");
    els.replayBtn.textContent = ui.fallback ? "查看音频解决办法" : "重听这一段";
    if (correct) {
      els.revealBadge.textContent = "猜对了！";
      els.revealBadge.style.background = "";
      const fuzzyFine = judged.how && judged.how !== "exact";
      if (fuzzyFine) els.revealNote.classList.add("is-fuzzy");
      const tail = fuzzyFine
        ? `模糊匹配通过${judged.score ? `（相似度 ${judged.score}%）` : ""}`
        : "完全命中";
      const shown = state.answers[state.answers.length - 1].v;
      const typedTail = shown ? ` · 你输入的是「${shown}」` : "";
      els.revealNote.textContent = `用时 ${elapsed.toFixed(1)} 秒 · +${pts} 分 · ${tail}${typedTail}`;
    } else if (mode === 0) {
      els.revealBadge.classList.add("is-wrong");
      els.revealBadge.textContent = "猜错了";
      const answer = state.answers[state.answers.length - 1];
      const guessSong = answer.g ? SONG_BY_ID.get(answer.g) : null;
      const typed = answer.v ? `「${answer.v}」` : null;
      const picked = sameSong(guessSong, round.song) ? null : guessSong ? `「${guessSong.c}」` : null;
      els.revealNote.textContent = [typed || picked, `${pts} 分`, "相似度没到线"]
        .filter(Boolean)
        .join(" · ");
    } else {
      els.revealBadge.classList.add("is-skip");
      els.revealBadge.textContent = "放弃了这题";
      els.revealNote.textContent = "看一下正确答案，下一题加油";
    }
    els.roundPill.textContent = `第 ${state.answers.length} 题`;
    saveState();
    renderStats();
    els.liveSummary.textContent = `正确答案是 ${round.song.c}。`;
  }

  function nextRound() {
    window.clearTimeout(ui.playdog);
    audio.pause();
    round = null;
    setIntro();
  }

  /* ============ 统计与导出 ============ */
  function statsSummary() {
    const answers = state.answers;
    const answered = answers.length;
    const correct = answers.filter((a) => a.m === 1).length;
    let streak = 0;
    let best = 0;
    answers.forEach((a) => {
      if (a.m === 1) {
        streak += 1;
        best = Math.max(best, streak);
      } else if (a.m === 0) {
        streak = 0;
      }
    });
    const timed = answers.filter((a) => a.m !== -1);
    const avg = timed.length ? timed.reduce((sum, a) => sum + a.t, 0) / timed.length : null;
    const attempted = answers.filter((a) => a.m !== -1).length;
    return {
      answered,
      correct,
      wrong: answers.filter((a) => a.m === 0).length,
      skipped: answers.filter((a) => a.m === -1).length,
      rate: attempted ? correct / attempted : null,
      best,
      avg,
      score: state.score,
    };
  }

  function renderStats() {
    const summary = statsSummary();
    els.heroRoundCount.textContent = String(summary.score);
    const label = state.settings.hard ? "极限" : "常规";
    els.statsMeta.textContent = summary.answered
      ? `${label}模式 · 共 ${summary.answered} 题 · ${state.settings.clip} 秒片段${
          state.settings.think ? ` · ${state.settings.think} 秒思考` : " · 不限时"
        }`
      : "还没有开始";
    els.statAnswered.textContent = String(summary.answered);
    els.statCorrect.textContent = String(summary.correct);
    els.statRate.textContent =
      summary.rate === null ? "—" : `${Math.round(summary.rate * 100)}%`;
    els.statStreak.textContent = String(summary.best);
    els.statAvg.textContent =
      summary.avg === null ? "—" : `${summary.avg.toFixed(1)}s`;
    els.statScore.textContent = String(summary.score);

    if (ui.phase === "answering" && round && round.selected) {
      els.pickInfo.textContent = `已选：${round.selected.c}`;
    }
    if (ui.phase === "intro" && round && round.resume) {
      els.startBtnLabel.textContent = "开始作答";
    }

    const streakNow = (() => {
      let n = 0;
      for (const a of state.answers) {
        if (a.m === 1) n += 1;
        else break;
      }
      return n;
    })();
    if (streakNow >= 2) {
      els.streakPill.hidden = false;
      els.streakPill.textContent = `连击 ${streakNow}`;
    } else {
      els.streakPill.hidden = true;
    }

    renderRounds();
  }

  function renderRounds() {
    if (!state.answers.length) {
      els.rounds.replaceChildren();
      const empty = document.createElement("p");
      empty.className = "rounds-empty";
      empty.textContent = "答完第一题后，这里会出现逐题记录。";
      els.rounds.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    state.answers.slice(-60).reverse().forEach((answer) => {
      const index = state.answers.indexOf(answer);
      const song = SONG_BY_ID.get(answer.i);
      if (!song) return;
      const row = document.createElement("div");
      row.className =
        "round-row " + (answer.m === 1 ? "is-correct" : answer.m === 0 ? "is-wrong" : "");
      const idx = document.createElement("span");
      idx.className = "round-index";
      idx.textContent = String(index + 1);
      const answerEl = document.createElement("span");
      answerEl.className = "round-answer";
      answerEl.textContent = song.c;
      const guessEl = document.createElement("span");
      guessEl.className = "round-guess";
      if (answer.m === 1) guessEl.textContent = "✓ 猜对";
      else if (answer.m === 0) {
        const guessSong = answer.g ? SONG_BY_ID.get(answer.g) : null;
        guessEl.innerHTML = "";
        guessEl.append(document.createTextNode("✗ "));
        const b = document.createElement("b");
        b.textContent = guessSong ? guessSong.c : "（放弃）";
        guessEl.append(b);
      } else guessEl.textContent = "－ 放弃";
      const time = document.createElement("span");
      time.className = "round-time";
      time.textContent = answer.m === -1 ? "—" : `${answer.t.toFixed(1)}s`;
      const score = document.createElement("span");
      score.className = "round-score";
      score.textContent = answer.pts > 0 ? `+${answer.pts}` : String(answer.pts);
      row.append(idx, answerEl, guessEl, time, score);
      fragment.append(row);
    });
    els.rounds.replaceChildren(fragment);
  }

  function settingsSummary() {
    const groups = GROUPS.filter((g) => state.settings.groups.has(g.id)).map((g) => g.short);
    const diffs = state.settings.diffs.size
      ? [...state.settings.diffs].map((id) => DIFF_BY_ID[id].label).join(" / ")
      : "不限";
    return {
      groups: groups.length === GROUPS.length ? "全部组合" : groups.join("、"),
      diffs,
    };
  }

  function exportPayload() {
    const summary = statsSummary();
    const settings = settingsSummary();
    return {
      app: "PJSK 国服听歌识曲",
      libraryAsOf: LIBRARY.asOf,
      exportedAt: new Date().toISOString(),
      mode: state.settings.hard ? "hardcore" : "normal",
      clipSeconds: state.settings.clip,
      thinkSeconds: state.settings.think,
      filter: settings,
      stats: summary,
      rounds: state.answers.map((answer, index) => {
        const song = SONG_BY_ID.get(answer.i);
        const guess = answer.g ? SONG_BY_ID.get(answer.g) : null;
        return {
          no: index + 1,
          songId: answer.i,
          title: song ? song.c : "?",
          original: song ? song.t : "?",
          result: answer.m === 1 ? "correct" : answer.m === 0 ? "wrong" : "skipped",
          guessId: answer.g,
          guess: guess ? guess.c : null,
          seconds: answer.t,
          points: answer.pts,
        };
      }),
    };
  }

  function exportText() {
    const payload = exportPayload();
    const lines = [
      "【PJSK 国服 · 听歌识曲】",
      `${payload.filter.groups} · 难度 ${payload.filter.diffs} · 片段 ${payload.clipSeconds}s · 思考 ${
        payload.thinkSeconds ? `${payload.thinkSeconds}s` : "不限时"
      }`,
      `得分 ${payload.stats.score} · 共 ${payload.stats.answered} 题 · 猜对 ${payload.stats.correct} · 最长连击 ${payload.stats.best}`,
      "",
    ];
    payload.rounds.forEach((item) => {
      const mark = item.result === "correct" ? "✓" : item.result === "wrong" ? "✗" : "－";
      const guess =
        item.result === "correct"
          ? ""
          : item.result === "wrong"
            ? `（你的选择：${item.guess || "—"}）`
            : "（放弃）";
      lines.push(
        `${String(item.no).padStart(2, "0")}. ${mark} ${item.title}${guess} · ${
          item.result === "skipped" ? "—" : `${item.seconds.toFixed(1)}s`
        } · ${item.points > 0 ? "+" : ""}${item.points}`,
      );
    });
    lines.push("", "曲库数据来自 Sekai-World · 国服曲库");
    return lines.join("\n");
  }

  function exportJson() {
    return JSON.stringify(exportPayload(), null, 2);
  }

  function settingsHash() {
    const params = new URLSearchParams();
    GROUPS.filter((g) => state.settings.groups.has(g.id)).forEach((g) => params.append("g", g.id));
    [...state.settings.diffs].forEach((id) => params.append("d", id));
    params.set("clip", String(state.settings.clip));
    params.set("think", String(state.settings.think));
    if (state.settings.hard) params.set("hard", "1");
    return params.toString();
  }

  function shareLink() {
    const base = window.location.href.split("#")[0];
    return `${base}#${settingsHash()}`;
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* 分享图片：用 canvas 现画，不依赖第三方库 */
  function drawShareImage() {
    const canvas = els.shareCanvas;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const payload = exportPayload();
    const rows = payload.rounds.slice(-12);

    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#f3fcfa");
    gradient.addColorStop(0.55, "#f8f6ff");
    gradient.addColorStop(1, "#fff4f8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const blobs = [
      [120, 90, 330, "rgba(255,111,159,0.16)"],
      [W - 130, 140, 360, "rgba(31,184,170,0.18)"],
      [W - 200, H - 120, 300, "rgba(143,114,214,0.14)"],
    ];
    blobs.forEach(([x, y, r, color]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#1f3540";
    ctx.font = "900 60px 'Trebuchet MS', 'Microsoft YaHei', sans-serif";
    ctx.fillText("听歌识曲", 72, 152);
    ctx.fillStyle = "#0c8b80";
    ctx.font = "800 24px 'Trebuchet MS', 'Microsoft YaHei', sans-serif";
    ctx.fillText("PJSK 国服 · 猜歌答卷", 74, 96);
    ctx.fillStyle = "#6d8490";
    ctx.font = "400 24px 'Microsoft YaHei', sans-serif";
    ctx.fillText(
      `${payload.filter.groups} · 难度 ${payload.filter.diffs}`,
      74,
      208,
    );
    ctx.fillText(
      `片段 ${payload.clipSeconds}s · 思考 ${
        payload.thinkSeconds ? `${payload.thinkSeconds}s` : "不限时"
      } · ${payload.mode === "hardcore" ? "极限模式" : "常规模式"}`,
      74,
      246,
    );

    const cards = [
      ["得分", String(payload.stats.score), "#0c8b80"],
      ["猜对", `${payload.stats.correct}/${payload.stats.answered}`, "#a33f78"],
      ["正确率", payload.stats.rate === null ? "—" : `${Math.round(payload.stats.rate * 100)}%`, "#7d6bb5"],
      ["最长连击", String(payload.stats.best), "#0e7f74"],
    ];
    const cardW = (W - 144 - 3 * 22) / 4;
    cards.forEach(([label, value, color], index) => {
      const x = 72 + index * (cardW + 22);
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      roundRect(ctx, x, 290, cardW, 150, 26);
      ctx.fill();
      ctx.strokeStyle = "rgba(31,184,170,0.18)";
      ctx.lineWidth = 2;
      roundRect(ctx, x, 290, cardW, 150, 26);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "900 52px 'Trebuchet MS', 'Microsoft YaHei', sans-serif";
      ctx.fillText(value, x + 26, 388);
      ctx.fillStyle = "#7d9296";
      ctx.font = "800 20px 'Microsoft YaHei', sans-serif";
      ctx.fillText(label, x + 26, 420);
    });

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    roundRect(ctx, 72, 480, W - 144, 850, 30);
    ctx.fill();
    ctx.fillStyle = "#39545b";
    ctx.font = "900 26px 'Microsoft YaHei', sans-serif";
    ctx.fillText("逐题记录", 104, 540);
    ctx.fillStyle = "#9aafb2";
    ctx.font = "400 20px 'Microsoft YaHei', sans-serif";
    ctx.fillText("✓ 猜对 / ✗ 猜错 / － 放弃", 260, 540);

    let y = 590;
    if (!rows.length) {
      ctx.fillStyle = "#9aafb2";
      ctx.font = "400 24px 'Microsoft YaHei', sans-serif";
      ctx.fillText("还没有作答记录", 104, y + 40);
    }
    rows.forEach((item) => {
      const mark = item.result === "correct" ? "✓" : item.result === "wrong" ? "✗" : "－";
      const markColor =
        item.result === "correct" ? "#1fb8aa" : item.result === "wrong" ? "#d24b6b" : "#9aafb2";
      ctx.fillStyle = "#c9dcda";
      ctx.font = "800 22px 'Trebuchet MS', sans-serif";
      ctx.fillText(String(item.no).padStart(2, "0"), 104, y + 30);
      ctx.fillStyle = markColor;
      ctx.font = "900 26px 'Trebuchet MS', sans-serif";
      ctx.fillText(mark, 156, y + 30);
      ctx.fillStyle = "#2b444c";
      ctx.font = "800 25px 'Microsoft YaHei', sans-serif";
      ctx.fillText(truncate(ctx, item.title, 480), 196, y + 30);
      ctx.fillStyle = "#9aafb2";
      ctx.font = "400 21px 'Microsoft YaHei', sans-serif";
      ctx.fillText(
        item.result === "skipped" ? "放弃" : `${item.seconds.toFixed(1)}s`,
        W - 330,
        y + 30,
      );
      ctx.fillStyle = item.points > 0 ? "#159a8a" : "#c9d6d5";
      ctx.font = "900 24px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(item.points > 0 ? `+${item.points}` : String(item.points), W - 110, y + 30);
      ctx.textAlign = "left";
      y += 62;
      if (y > 1240) return;
    });

    ctx.fillStyle = "#8fa5a8";
    ctx.font = "400 20px 'Microsoft YaHei', sans-serif";
    ctx.fillText(
      `曲库截至 ${payload.libraryAsOf} · ${new Date(payload.exportedAt).toLocaleString("zh-CN")}`,
      74,
      H - 42,
    );

    return canvas;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
      out = out.slice(0, -1);
    }
    return `${out}…`;
  }

  function exportImage() {
    const canvas = drawShareImage();
    canvas.toBlob((blob) => {
      if (!blob) {
        toast("图片生成失败");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pjsk-quiz-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("答卷图片已保存");
    }, "image/png");
  }

  /* ============ 事件 ============ */
  function bindEvents() {
    els.startBtn.addEventListener("click", startRound);
    els.stopBtn.addEventListener("click", endSegment);
    els.submitBtn.addEventListener("click", () => {
      if (!round) return;
      const typed = els.answerInput.value.trim();
      // 以输入框里的内容为准重新解析：点按钮会让输入框失焦、电压候选列表被收起，
      // 不能依赖模糊列表的选中项。
      const pick =
        resolvePicked(typed) ||
        round.selected ||
        fuzzyList[ui.selected >= 0 ? ui.selected : 0] ||
        null;
      if (pick) {
        submitAnswer(pick, typed);
      } else if (typed) {
        // 没有定位到歌曲时把原文交给模糊匹配判定，而不是当成"放弃"。
        submitAnswer(null, typed);
      }
    });
    els.skipBtn.addEventListener("click", () => submitAnswer(null));
    els.nextBtn.addEventListener("click", nextRound);
    els.replayBtn.addEventListener("click", () => {
      if (!round) return;
      if (round.fallback || ui.fallback) {
        document.getElementById("openAudioHelp").click();
        return;
      }
      audio.currentTime = round.start;
      audio.play().catch(() => toast("重听失败，请再点一次"));
    });
    els.answerInput.addEventListener("input", () => {
      const typed = els.answerInput.value;
      const list = searchSongs(typed);
      ui.selected = -1;
      renderSuggest(list);
      updateEcho();
      renderFuzzy(typed);
      if (!typed.trim()) {
        els.pickInfo.textContent = "候选里没有？直接输入歌名搜索";
        els.submitBtn.disabled = true;
        round.selected = null;
        return;
      }
      // 输入内容直接对上了某首歌，就把它当作答案（模糊匹配在提交时再复核）。
      const hit = matchTyped(typed);
      if (hit) {
        round.selected = hit;
        els.submitBtn.disabled = false;
        els.pickInfo.textContent = `将按「${hit.c}」判定`;
      } else {
        round.selected = null;
        els.submitBtn.disabled = true;
        els.pickInfo.textContent = "还没定位到曲目，可从模糊匹配里选一个";
      }
    });
    els.answerInput.addEventListener("focus", () => {
      if (ui.phase === "answering") {
        renderSuggest(searchSongs(els.answerInput.value));
      }
    });
    els.answerInput.addEventListener("keydown", (event) => {
      const fuzzyOpen = !els.fuzzyBox.hidden;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (fuzzyOpen && fuzzyList.length) {
          ui.selected = (ui.selected + 1) % fuzzyList.length;
          highlightFuzzy();
        } else {
          moveSelection(1);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (fuzzyOpen && fuzzyList.length) {
          ui.selected = (ui.selected - 1 + fuzzyList.length) % fuzzyList.length;
          highlightFuzzy();
        } else {
          moveSelection(-1);
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        const typed = els.answerInput.value.trim();
        if (round && round.selected) {
          // 已经是某首歌：提交时把原始输入一起带上，交给模糊判定复核。
          submitAnswer(round.selected, typed);
        } else if (fuzzyList.length) {
          const pick = fuzzyList[ui.selected >= 0 ? ui.selected : 0];
          if (pick) submitAnswer(pick.song, typed);
        } else if (typed) {
          // 没定位到任何歌也允许提交，让模糊匹配给出结论。
          submitAnswer(null, typed);
        }
      } else if (event.key === "Escape") {
        els.suggest.hidden = true;
        els.fuzzyBox.hidden = true;
        els.guessEcho.hidden = true;
      }
    });
    els.answerInput.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (document.activeElement === els.answerInput) return;
        els.suggest.hidden = true;
      }, 120);
    });

    els.clipRange.addEventListener("input", () => {
      state.settings.clip = Number(els.clipRange.value);
      syncSettingsUI();
      saveState();
    });
    els.hardcore.addEventListener("change", () => {
      state.settings.hard = els.hardcore.checked;
      saveState();
      renderStats();
    });
    els.resetAll.addEventListener("click", () => {
      const answers = state.answers;
      const score = state.score;
      const played = state.played;
      state.settings = defaultSettings();
      state.answers = answers;
      state.score = score;
      state.played = played;
      syncSettingsUI();
      saveState();
      toast("已恢复默认设置");
    });
    const diagBtn = document.getElementById("audioDiagBtn");
    if (diagBtn) {
      diagBtn.addEventListener("click", async () => {
        const out = document.getElementById("audioDiagOut");
        out.hidden = false;
        out.textContent = "检测中…";
        const lines = [];
        lines.push(`页面地址：${location.origin}${location.pathname}`);
        lines.push(`在线状态：${navigator.onLine ? "online" : "offline"}`);
        for (const base of AUDIO_SOURCES) {
          const url = buildUrl(base, "0001_01");
          const t0 = performance.now();
          try {
            const r = await fetch(url, { method: "GET", cache: "no-store" });
            const ms = Math.round(performance.now() - t0);
            lines.push(`✅ ${url}\n   HTTP ${r.status} · ${ms}ms · ${r.headers.get("Content-Type") || "?"}`);
          } catch (error) {
            const ms = Math.round(performance.now() - t0);
            lines.push(`❌ ${url}\n   ${error.name}: ${error.message} · ${ms}ms`);
          }
        }
        const verdict = lines.some((line) => line.startsWith("✅"))
          ? "至少一个音频源可用，若仍无声请检查设备音量或浏览器自动播放限制。"
          : "所有音频源都不可用：说明是网络 / CDN 可达性问题，不是代码问题。";
        lines.push("", verdict);
        out.textContent = lines.join("\n");
      });
    }
    const resetAudio = document.getElementById("audioResetBtn");
    if (resetAudio) {
      resetAudio.addEventListener("click", () => {
        try {
          window.localStorage.removeItem(AUDIO_BASE_KEY);
        } catch {
          /* ignore */
        }
        const out = document.getElementById("audioDiagOut");
        if (out) {
          out.hidden = false;
          out.textContent = "已清除保存的音频地址。刷新页面后会自动使用同域 /audio/。";
        }
        toast("已重置音频设置，刷新后生效", 3000);
      });
    }
    els.changeSettings.addEventListener("click", () => {
      buildCarousel();
      round = null;
      setIntro();
      toast(`曲池已更新：${quizPool().length} 首`);
    });
    els.stopGame.addEventListener("click", () => {
      audio.pause();
      cancelAnimationFrame(ui.timer);
      round = null;
      setIntro();
      toast("本轮结束，成绩保留在下方答卷");
    });

    exportButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!state.answers.length) {
          toast("还没有作答记录可以导出");
          return;
        }
        const kind = button.dataset.export;
        const stamp = new Date().toISOString().slice(0, 10);
        if (kind === "text") download(`pjsk-quiz-${stamp}.txt`, exportText(), "text/plain;charset=utf-8");
        else if (kind === "json") download(`pjsk-quiz-${stamp}.json`, exportJson(), "application/json");
        else exportImage();
      });
    });

    els.shareBtn.addEventListener("click", async () => {
      const link = shareLink();
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(link);
        } else {
          const helper = document.createElement("textarea");
          helper.value = link;
          helper.style.position = "fixed";
          helper.style.opacity = "0";
          document.body.append(helper);
          helper.select();
          document.execCommand("copy");
          helper.remove();
        }
        toast("已复制设置链接，发给朋友就能玩同一套规则");
      } catch {
        toast(`复制失败，链接：${link}`);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
      if (ui.phase === "intro") {
        event.preventDefault();
        startRound();
      } else if (ui.phase === "playing") {
        event.preventDefault();
        endSegment();
      } else if (ui.phase === "reveal") {
        event.preventDefault();
        nextRound();
      }
    });

    window.addEventListener("beforeunload", () => {
      if (saving) saveState();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) audio.pause();
    });
  }

  /* ============ 初始化 ============ */
  function init() {
    state = loadState();
    if (FUZZY) FUZZY.ensurePairIndex(QUIZ_SONGS);
    els.heroSongCount.textContent = String(QUIZ_SONGS.length);
    els.dataDate.textContent = LIBRARY.asOf;
    renderGroupChips();
    renderDiffChips();
    renderThinkChips();
    els.clipRange.value = String(state.settings.clip);
    els.hardcore.checked = state.settings.hard;
    bindEvents();
    setIntro();
    if (state.answers.length) {
      toast("已恢复个人答题记录");
    }
  }

  init();
})();

  