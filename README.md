# PJSK 国服小工具｜今天，演奏什么？

给《初音未来：缤纷舞台》国服玩家做的两个小工具，共用一套清新配色和曲库数据：

| 页面 | 文件 | 玩法 |
| --- | --- | --- |
| 🎵 **演奏随机抽签** | `index.html` | 随机抽一首歌 + 一个难度，可限定难度 / 组合 / 等级 |
| 🎧 **听歌识曲** | `quiz.html` | 随机切 5–10 秒试听，限时作答，记录可导出分享 |

两个页面都有站内链接，互相跳转。**每个都是单文件网页**：曲库、样式、脚本全部内嵌，不依赖构建服务，GitHub Pages 上传即用。

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
- 抽签规则：先按筛选条件等概率抽歌，再从该曲可用且被选中的难度中等概率抽谱面。

## 二、听歌识曲（`quiz.html`）

- **片段长度** 5–10 秒可调（默认 8 秒），从整首 short.ver 里随机裁切，不一定切在副歌。
- **思考时间** 30 / 60 / 90 / 120 秒或不限时。
- **曲库范围** 与抽签同一套：组合 / 分类多选、按难度存在筛选。
- **作答方式**：系统给出 1 个正确答案 + 7 个干扰项（优先同组合的歌），点选即可；候选中没有时，直接输入中文名或原名搜索。
- **判定**：选中文名或原名都算对；答对 +1000 分并按剩余时间加最多 +400 速度分，答错 −100 分，放弃 0 分。
- **不重复出题**：曲池里的歌都出过之后才重新洗牌。
- **记录**：逐题记录（歌名 / 你的选择 / 用时 / 得分），以及得分、正确率、最长连击、平均用时。成绩与设置保存在本机浏览器，刷新不丢。
- **导出分享**：文本（txt）、JSON、答卷图片（png，用 canvas 现场绘制），以及「生成分享链接」——把当前范围 / 片段长度 / 思考时间编码进网址，发给朋友就能玩同一套规则。
- **极限模式**：盖上题号进度条，挑战感更强。
- 快捷键：空格开始 / 立即作答 / 下一题，方向键选候选，Enter 确认。

> 试听片段会在第一次播放时才从网上下载，需要联网；网络较慢时会显示「载入片段…」，稍等即可。

---

## 在本地打开

1. 下载 `index.html` 和 `quiz.html`（或整个压缩包解压）。
2. 双击 `index.html`，两个页面之间照常通过站内链接跳转。

抽签页完全离线可用；猜歌页需要联网加载试听音频。若浏览器限制本地文件的剪贴板权限，「复制结果」「生成分享链接」可能提示失败，可手动选中文字复制；部署到 GitHub Pages 后一切正常。

---

## 上传到 GitHub Pages（推荐）

### 方法 A：网页上传（不需要装 Git）

1. 登录 GitHub，点右上角 **+ → New repository**。
2. 仓库名填 `pjsk-draw`（或任意名字），选择 **Public**，点 **Create repository**。
3. 进入仓库，点 **Add file → Upload files**。
4. 把 `index.html` 和 `quiz.html` 放进去（`README.md` 可选，一并上传）。
5. 点 **Commit changes**。
6. 打开仓库的 **Settings → Pages**。
7. 在 **Build and deployment** 中：
   - **Source** 选 `Deploy from a branch`
   - **Branch** 选 `main`，目录选 `/ (root)`
   - 点 **Save**
8. 等待 1–3 分钟，刷新 Settings → Pages，顶部会出现访问地址。

访问地址通常是：

```text
https://<你的 GitHub 用户名>.github.io/pjsk-draw/          ← 抽签
https://<你的 GitHub 用户名>.github.io/pjsk-draw/quiz.html ← 听歌识曲
```

例如用户名为 `miku39`、仓库名为 `pjsk-draw`：

```text
https://miku39.github.io/pjsk-draw/
https://miku39.github.io/pjsk-draw/quiz.html
```

> 如果仓库名取成 `<你的用户名>.github.io`，访问地址会变成 `https://<你的用户名>.github.io/`，猜歌页则是 `https://<你的用户名>.github.io/quiz.html`。
> 仓库必须是 Public；Private 仓库的 Pages 需要 GitHub 付费方案。

### 方法 B：命令行上传

在本目录执行（把 `<用户名>` 和 `<仓库名>` 换成你的）：

```bash
git init
git add index.html quiz.html README.md
git commit -m "feat: PJSK draw + guess the song"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

然后按方法 A 的第 6–8 步开启 GitHub Pages。

### 访问与分享

- 直接打开上面的两个网址即可；两个页面互相链接。
- 手机上也能用：浏览器菜单里选「添加到主屏幕」，用起来更像一个小应用。
- 猜歌页的「生成分享链接」会给出类似 `.../quiz.html#g=idol&g=vocaloid&clip=5&think=60` 的地址，朋友打开就是同一套规则。
- 不要用 `raw.githubusercontent.com` 的链接直接访问：GitHub 会把它当纯文本返回，不会渲染成网页。要用 GitHub Pages 的地址。

### 更新页面

改完重新上传 / commit 即可，GitHub Pages 会自动重新发布：

```bash
git add index.html quiz.html
git commit -m "update tools"
git push
```

如果打开还是旧版，等 1–2 分钟并强制刷新（Windows：`Ctrl + F5`；手机：清缓存或换隐私窗口）。

### 国内访问慢怎么办？

GitHub Pages 在国内偶尔会慢或连接不稳定，而猜歌还需要加载试听音频：

- 抽签工具：把 `index.html` 下载到本地，双击打开，完全离线可用。
- 猜歌工具：部署到 Cloudflare Pages、Netlify、Vercel 等静态托管访问会更快，无需改代码。
- 试听音频本身来自公共 CDN（`storage.sekai.best`），与页面放在哪里无关。

---

## 更新曲库（可选，需要 Python）

压缩包里带了数据构建脚本，国服版本更新后可以重新生成两个页面：

```text
data/                 从 CN Master DB 下载的原始 JSON
data/songs.json       构建后的精简曲库（含难度、组合、试听变体）
src/                  两个页面的模板、样式、脚本
tools/build_data.py   过滤当前可用曲目，生成 data/songs.json
tools/build_site.py   把 CSS/JS/曲库内嵌成 index.html 与 quiz.html
```

1. 从 [Sekai-World/sekai-master-db-cn-diff](https://github.com/Sekai-World/sekai-master-db-cn-diff) 下载最新的 `musics.json`、`musicDifficulties.json`、`musicTags.json`、`musicVocals.json`、`limitedTimeMusics.json`，放进 `data/`。
2. 运行：

```bash
python -X utf8 tools/build_data.py
python tools/build_site.py
```

3. 重新上传生成的两个 HTML。

`build_data.py` 会按运行当天的时间跳过未上线曲目、跳过已结束的限时谱面；`CN_EXCLUSIVE_IDS` 里的国服独占曲目会被标记为「猜歌不参与」。

---

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | **演奏随机抽签**，单文件网页 |
| `quiz.html` | **听歌识曲**，单文件网页 |
| `README.md` | 本说明 |
| `pjsk-draw.zip` | 打包文件：两个成品 + 说明 + 可选构建源码 |

两个页面都只需要各自的 HTML 就能运行；`src/`、`tools/`、`data/` 是维护用的源文件，不影响部署。

---

## 数据与版权

- 本项目是非官方同人工具，与 SEGA、Colorful Palette、Crypton Future Media 及国服运营方无隶属关系。
- 游戏曲名、角色、谱面、试听音频等版权归原权利方所有；试听音频只引用公共资产 CDN，未重新分发音频文件。
- 页面不收集任何个人信息；筛选设置、抽签 / 答题记录只保存在你自己的浏览器 `localStorage` 中。

## 常见问题

**猜歌页一直显示「载入片段…」？**  
说明试听音频还没下载下来，通常是网络问题。稍等或刷新；也可以在网络更好的设备上玩。

**为什么有的歌猜歌抽不到？**  
国服独占曲目（本地联动曲、部分参赛曲）没有公开试听，所以只出现在抽签里。页面右上的「首可猜」就是口径。

**抽到重复的歌？**  
抽签页检查「不重复抽签」是否开启；猜歌页出一轮后会重新洗牌，属正常现象。

**为什么一首歌会出现在多个组合里？**  
组合标签按 Master DB 的多标签规则展示，方便按不同维度筛选。

**导出图片失败？**  
换新版 Chrome / Edge / Safari 再试；也可以先导出文本或 JSON。

---

祝你抽到想打的歌，也祝你把每一段前奏都认出来。♪
