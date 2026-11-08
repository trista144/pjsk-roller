# PJSK 国服小工具｜今天，演奏什么？

给《初音未来：缤纷舞台》国服玩家做的两个小工具，共用一套清新配色和曲库数据：

| 页面 | 文件 | 玩法 |
| --- | --- | --- |
| 🎵 **演奏随机抽签** | `index.html` | 随机抽一首歌 + 一个难度，可限定难度 / 组合 / 等级 |
| 🎧 **听歌识曲** | `quiz.html` | 随机切 5–10 秒试听，限时作答，记录可导出分享 |

两个页面都有站内链接，互相跳转。**每个都是单文件网页**：曲库、样式、脚本全部内嵌，不依赖构建服务。

线上部署：GitHub 仓库存源码 → Cloudflare Pages 自动构建发布 → 访问 <https://pjsk-playbox.pages.dev/>。
根目录的 `_worker.js` 负责把音频和封面转发到站内同域路径（原因见下面「音频与封面是怎么来的」）。

---

## 曲库说明

| 项目 | 数量 |
| --- | --- |
| 国服当前可游玩曲目 | **638 首** |
| 全部可选谱面 | **3318 个** |
| 带 APPEND 的曲目 | **128 首** |
| 听歌识曲可用曲目（有公开试听） | **616 首** |
| 曲库截止日期 | **2026-11-07** |

- 曲库数据来自社区维护的国服 Master DB：[Sekai-World/sekai-master-db-cn-diff](https://github.com/Sekai-World/sekai-master-db-cn-diff)。
- 曲名同时保留**原文**与**国服中文名**。
- 难度包含 EASY、NORMAL、HARD、EXPERT、MASTER、APPEND。
- 已排除尚未上线的未来曲目，以及国服限时活动结束后不可再游玩的 4 个限时谱面。
- 组合标签是多标签：VOCALOID 翻唱可能同时属于「原曲分类」和「翻唱组合」，所以各分类数量相加会大于 638。
- 试听音频来自游戏内 `short.ver` 片段（与 [Sekai Viewer](https://github.com/Sekai-World/sekai-viewer) 同源的公共资产）。国服独占曲目（4 首本地联动曲 + 「未来有你」参赛曲等 18 首）没有公开试听，因此**不进猜歌曲库**，但仍会出现在抽签里。

## 一、演奏随机抽签（`index.html`）

- 按难度、组合、等级范围收窄曲池；每个分类旁会显示当前条件下的可选曲目数。
- 曲名支持「双语 / 中文 / 原文」切换。
- 不重复抽签、最近抽签记录、一键复制结果、空格键快捷抽签。
- 抽到后显示该曲**封面**，便于在游戏内快速识别。
- 抽签规则：先按筛选条件等概率抽歌，再从该曲可用且被选中的难度中等概率抽谱面。

## 二、听歌识曲（`quiz.html`）

- **片段长度** 5–10 秒可调（默认 8 秒），从整首 short.ver 里随机裁切，不一定切在副歌。
- **思考时间** 30 / 60 / 90 / 120 秒或不限时。
- **曲库范围** 与抽签同一套：组合 / 分类多选、按难度存在筛选。
- **作答方式**：系统给出 1 个正确答案 + 7 个干扰项（优先同组合的歌），点选即可；候选中没有时，直接输入中文名或原名搜索。
- **模糊匹配判定**：不必一字不差。系统会把你的输入和中文名 / 原名 / 各版本命名一起比对，忽略空格、大小写、全半角、标点、括号内容、`feat.` / `-reloaded-` 之类的后缀，汉字/假名近似、错字漏字也能认；命中后提示「模糊匹配通过（相似度 xx%）」。答对 +1000 分并按剩余时间加最多 +400 速度分，答错 −100 分，放弃 0 分。
- **边打边猜**：输入时下方实时给出「模糊匹配 · 最接近的曲目」，回车直接提交当前输入交给模糊判定，方向键选择候选。
- **不重复出题**：曲池里的歌都出过之后才重新洗牌。
- **曲目封面**：作答结束揭晓答案时显示该曲封面；抽签页抽到后也会显示，方便在游戏内快速找到。
- **记录**：逐题记录（歌名 / 你的选择 / 用时 / 得分），以及得分、正确率、最长连击、平均用时。成绩与设置保存在本机浏览器，刷新不丢。
- **导出分享**：文本（txt）、JSON、答卷图片（png，用 canvas 现场绘制），以及「生成分享链接」——把当前范围 / 片段长度 / 思考时间编码进网址，发给朋友就能玩同一套规则。
- **极限模式**：盖上题号进度条，挑战感更强。
- 快捷键：空格开始 / 立即作答 / 下一题，方向键选候选，Enter 确认。

> 试听片段在第一次播放时下载，需要联网；网络较慢时会显示「载入片段…」。页面会顺手预取下一条候选，从第二题起基本都是秒开。

### 音频与封面是怎么来的（重要）

试听音频和曲目封面都存在 Cloudflare 之外的公共资产站 `storage.sekai.best`，**该站按来源站拦截浏览器请求**：

| 来源 | 结果 |
| --- | --- |
| 本机双击打开（`file://`） | ✅ 可用 |
| `*.github.io` | ❌ 被拒 |
| `*.pages.dev` | ❌ 被拒 |
| `*.workers.dev`（中国大陆） | ❌ 连不上 |

所以本站不直接引用它，而是在仓库根目录放一个 **`_worker.js`**（Cloudflare Pages 的 Advanced Mode），让**自己的域名**代为取数据：

```text
浏览器 →  https://pjsk-playbox.pages.dev/audio/jacket…   （同域，不跨域）
                    ↓  _worker.js 在边缘节点转发
                  storage.sekai.best/…
```

这样浏览器永远只连 `pjsk-playbox.pages.dev` 一个域名，国内**无需代理**即可播放音频、显示封面。

### `_worker.js` 路由

| 本站路径 | 上游 |
| --- | --- |
| `/audio/<变体>/<变体>_short.mp3` | `storage.sekai.best/sekai-jp-assets/music/short/…` |
| `/image/jacket_s_<编号>/…webp` | `storage.sekai.best/sekai-jp-assets/music/jacket/…` |
| 其他 | 正常返回静态文件（`index.html` / `quiz.html`） |

转发时会带上 `Referer: https://sekai.best/`，否则上游会拒绝；图片响应加了 `Cache-Control: max-age=604800, immutable`，封面不会变，长缓存能省掉大量请求。

改动 `_worker.js` 后同样只要 commit 到 `main`，Cloudflare 会自动重新部署。

### 社区别名（`src/quiz-aliases.txt`）

有些叫法无法从曲库数据推导出来，例如：

- 国服中文名是英文、社区却用中文直译/谐音称呼（`CYBER PUNK DEAD BOY` 常被叫「赛博」）
- 用「角色简称 + 序号」代称活动原创曲（`CYBER PUNK DEAD BOY` 也被叫「类四」）

这类叫法维护在 `src/quiz-aliases.txt`，一行一首歌、用 `|` 分隔：

```text
# 歌曲ID|别名1|别名2|...
452|赛博|赛博朋克|赛博朋克死男孩|类四|deadboy
```

改完运行 `python tools/build_site.py` 重新生成 HTML 即可。

**不需要写进别名表的**：中文名、日文原名、去掉 `-Reloaded-` / `feat.` 后的写法、英文名连写（`Dead Boy` → `deadboy`）、全半角差异、错别字，这些都会被自动处理。

> 「角色 + 箱曲序号」目前只能逐个登记为别名。因为 Master DB 里没有"每期活动的主角角色"这一信息，无法自动算出某个角色是第几首，`类四` 这类编号只能人工维护。

### 模糊匹配是怎么判定的

按顺序尝试，任意一层通过即算答对：

1. **完全相同**（先做归一化：去空格 / 标点 / 括号内容、全半角统一、片假名转平假名、汉字数字转阿拉伯数字）
2. **去掉版本后缀后相同**（`-Reloaded-`、`(feat. xxx)`、`Remix` 等）
3. **只保留字母数字/假名后相同**（忽略符号残留）
4. **前缀命中**：中文 2 字起、拉丁 3 字起（`火花` → `火花 -Reloaded-` 得 95.5 分）
5. **包含 / 反向包含**：中文 3 字起、拉丁 4 字起（`relo` → `Reloaded` 得 90 分）
6. **编辑距离相似度 ≥ 86**：容忍错字、漏字、多字

命中第 4–6 层时，揭晓页会显示「模糊匹配通过（相似度 N%）」，让用户知道是按什么判对的。

### 音频设置的优先级

页面里的音频源顺序是：

```text
1. /audio/                        ← 同域，永远排第一，不受任何残留设置影响
2. localStorage 里存的 ?audio= 值  ← 只作为额外候选
3. storage.sekai.best 源站         ← 最后兜底
```

> 曾经有个坑：用户用 `?audio=<某个地址>` 打开过后，这个地址被存进 `localStorage`（键 `pjsk-quiz-audio-base`），旧版本会让它**压掉默认值**，导致"明明是好的却一直加载失败"。现在同域 `/audio/` 强制排第一，并在设置面板提供 **「重置音频设置」** 按钮。

### 排查方法

设置面板里 **「试听打不开？点这里看解决办法」** 内有 **「运行音频自检」**，会逐个列出音频源的 HTTP 状态码与耗时：

- 全部 `TypeError: Failed to fetch` → 网络 / CDN 可达性问题
- 某个源返回 4xx/5xx → 上游拒绝，检查 `_worker.js`

音频彻底失败时会自动进入 **「无音频出题模式」**，照常出题、计分、记录，不会卡住。

--- | --- |
| 本机双击 HTML（`file://`） | ✅ 可以 |
| `localhost` / 自己的域名 | ✅ 可以 |
| GitHub Pages（`*.github.io`） | ❌ 被拒 |
| Cloudflare Pages（`*.pages.dev`） | ❌ 被拒（连不校验跨域的请求都在服务端被拦，返回状态码 0） |

被拒时页面**不会卡住**：会自动切到「无音频出题模式」——照常出题、作答、计分、记录，只是不播放声音。页面右上会出现黄色条幅，右侧设置面板里也有「试听打不开？点这里看解决办法」。

想真正听到声音，二选一：

1. **自己搭一个反代**（Cloudflare Worker / 自己的服务器），把请求原样转发到 `https://storage.sekai.best/sekai-jp-assets/music/short/`，然后给页面网址加参数：
   ```text
   https://pjsk-roller.pages.dev/quiz?audio=/pjskaudio/
   ```
   支持多个候选源，用英文逗号分隔、按顺序尝试：
   ```text
   ?audio=/pjskaudio/,https://storage.sekai.best/sekai-jp-assets/music/short/
   ```
   `?audio=` 会记在本机浏览器里，下次打开自动沿用。
2. **把两个 HTML 下载到本地双击打开**，实测可直接播放。

> 反代只需要转发这一个路径、响应加 `Access-Control-Allow-Origin: *`（或回显请求的 Origin）和正确的 `Content-Type: audio/mpeg` 即可。

---

## 在本地打开

1. 下载 `index.html` 和 `quiz.html`（或整个压缩包解压）。
2. 双击 `index.html`，两个页面之间照常通过站内链接跳转。

抽签页完全离线可用；猜歌页需要联网加载试听音频。

> 本地双击打开（`file://`）时，音频和封面可以直接从源站加载，实测可用；若浏览器限制本地文件的剪贴板权限，「复制结果」「生成分享链接」可能提示失败，可手动选中文字复制。部署到线上后一切正常。

---

## 部署（Cloudflare Pages + GitHub）

线上地址：<https://pjsk-playbox.pages.dev/>（抽签）/ <https://pjsk-playbox.pages.dev/quiz.html>（听歌识曲）

**不要在 GitHub Pages 上部署这个项目**：`storage.sekai.best` 会拒绝 `*.github.io` 的请求，结果是音频和封面全部加载失败。Cloudflare Pages 的 Advanced Mode（`_worker.js`）才能把资源转成同域请求。

### 首次配置

1. 在 Cloudflare 后台 **Workers & Pages → Create → Pages → Connect to Git**，授权并选中本仓库。
2. 构建设置**全部留空**（这是纯静态成品，不需要构建）：

   | 字段 | 值 |
   | --- | --- |
   | Framework preset | None |
   | Build command | 空 |
   | Build output directory | 空 |
   | Root directory | 空 |

3. 点 **Save and Deploy**，几十秒后即可访问。
4. 仓库根目录**必须**有 `_worker.js`，Cloudflare 会据此自动启用 Advanced Mode（不需要在后台开任何开关）。

### 日常更新

只需要在 GitHub 上改文件并 commit 到 `main`，Cloudflare 约 1 分钟自动重新部署，**地址不变，已分享出去的链接无需更换**：

```bash
git add index.html quiz.html _worker.js
git commit -m "update tools"
git push
```

如果打开还是旧版，等 1–2 分钟强制刷新（Windows：`Ctrl + F5`；手机：清缓存或用隐私窗口）。

### 访问与分享

- 手机上建议「添加到主屏幕」，用起来更像小应用。
- 猜歌页的「生成分享链接」会给出类似 `.../quiz.html#g=idol&g=vocaloid&clip=5&think=60` 的地址，朋友打开就是同一套规则。
- 不要用 `raw.githubusercontent.com` 的链接访问：GitHub 会按纯文本返回，不会渲染成网页。

### 国内访问

页面本身走 `pages.dev`，国内可正常访问；音频与封面经由同域 `/audio/`、`/image/` 转发，**不需要代理**。唯一需要注意的是 **不要用 `*.workers.dev` 作为音频源**，该域名在国内经常无法直连。

---

## 更新曲库（可选，需要 Python）

压缩包里带了数据构建脚本，国服版本更新后可以重新生成两个页面：

```text
data/                 从 CN Master DB 下载的原始 JSON
data/songs.json       构建后的精简曲库（含难度、组合、试听变体）
src/                  两个页面的模板、样式、脚本
src/fuzzy.js          猜歌的模糊匹配逻辑（判定 + 候选排序）
src/quiz-titles.txt   中文名/原名对照，供模糊匹配使用
tools/build_data.py   过滤当前可用曲目，生成 data/songs.json
tools/build_site.py   把 CSS/JS/曲库内嵌成 index.html 与 quiz.html
```

1. 从 [Sekai-World/sekai-master-db-cn-diff](https://github.com/Sekai-World/sekai-master-db-cn-diff) 下载最新的 `musics.json`、`musicDifficulties.json`、`musicTags.json`、`musicVocals.json`、`limitedTimeMusics.json`，放进 `data/`。
2. 运行：

```bash
python -X utf8 tools/build_data.py
python tools/build_site.py
```

3. commit 生成的两个 HTML（Cloudflare 会自动重新部署）。

`build_data.py` 会按运行当天的时间跳过未上线曲目、跳过已结束的限时谱面；`CN_EXCLUSIVE_IDS` 里的国服独占曲目会被标记为「猜歌不参与」。

---

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | **演奏随机抽签**，单文件网页 |
| `quiz.html` | **听歌识曲**，单文件网页 |
| `_worker.js` | 音频 / 封面同域转发（Cloudflare Pages Advanced Mode）|
| `README.md` | 本说明 |
| `pjsk-draw.zip` | 打包文件：两个成品 + `_worker.js` + 说明 + 可选构建源码 |

两个页面都只需要各自的 HTML 就能运行；`src/`、`tools/`、`data/` 是维护用的源文件，不影响部署。

---

## 数据与版权

- 本项目是非官方同人工具，与 SEGA、Colorful Palette、Crypton Future Media 及国服运营方无隶属关系。
- 游戏曲名、角色、谱面、试听音频等版权归原权利方所有；试听音频只引用公共资产 CDN，未重新分发音频文件。
- 页面不收集任何个人信息；筛选设置、抽签 / 答题记录只保存在你自己的浏览器 `localStorage` 中。

## 常见问题

**猜歌页出现了「无音频出题模式」条幅？**  
说明音频没能经由同域 `/audio/` 取到。先在设置面板点「运行音频自检」，再到「音频与封面是怎么来的」章节按诊断结果处理。降级模式下游戏本身照常能玩。

**猜歌页一直显示「载入片段…」？**  
说明试听音频还没下载下来，等几秒或刷新；页面下一题开始会预取缓存。

**为什么有的歌猜歌抽不到？**  
国服独占曲目（本地联动曲、部分参赛曲）没有公开试听，所以只出现在抽签里。页面右上的「首可猜」就是口径。

**抽到重复的歌？**  
抽签页检查「不重复抽签」是否开启；猜歌页出一轮后会重新洗牌，属正常现象。

**为什么一首歌会出现在多个组合里？**  
组合标签按 Master DB 的多标签规则展示，方便按不同维度筛选。

**为什么有的歌没有封面？**  
少数曲目（如国服独占曲）在上游没有公开封面图，此时会回退成原来的渐变底色，不影响使用。

**导出图片失败？**  
换新版 Chrome / Edge / Safari 再试；也可以先导出文本或 JSON。

---

祝你抽到想打的歌，也祝你把每一段前奏都认出来。♪
