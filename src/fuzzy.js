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
