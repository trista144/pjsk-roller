# PJSK 国服随机抽签｜今天，演奏什么？

给《初音未来：缤纷舞台》国服玩家用的随机曲目抽签小工具。抽一首歌，再抽一个难度，给重复的演奏加一点未知。

**只需要上传 `index.html` 就能用。** 它是一个单文件网页，曲库、样式、脚本全部内嵌，不依赖服务器、字体 CDN 或外链图片，双击打开也能离线使用。

---

## 曲库说明

| 项目 | 数量 |
| --- | --- |
| 国服当前可游玩曲目 | **638 首** |
| 全部可选谱面 | **3318 个** |
| 带 APPEND 的曲目 | **128 首** |
| 曲库截止日期 | **2026-11-07** |

- 数据来自社区维护的国服 Master DB：[Sekai-World/sekai-master-db-cn-diff](https://github.com/Sekai-World/sekai-master-db-cn-diff)。
- 曲名同时保留**原文**与**国服中文名**，可在页面右上角切换「双语 / 中文 / 原文」。
- 难度包含 EASY、NORMAL、HARD、EXPERT、MASTER、APPEND；APPEND 只在已收录该谱面的歌曲中出现。
- 已排除尚未上线的未来曲目，以及国服限时活动结束后不可再游玩的 4 个限时谱面（初音未来激唱 FULL Ver. 与 3 个高难度串烧）。
- 组合标签是多标签：一首 VOCALOID 翻唱可能同时属于「原曲分类」和「翻唱组合」，所以各分类数量相加会大于 638。

## 功能

- 六档难度筛选，支持只抽 APPEND。
- 组合 / 分类筛选：Leo/need、MORE MORE JUMP！、Vivid BAD SQUAD、Wonderlands×Showtime、25时，在Nightcord。、VOCALOID、其他 / 联动。
- 等级范围筛选，可只抽 30 级以上或某个等级段。
- 中文名 / 原文 / 双语显示。
- 不重复抽签：本轮抽过的歌会从池中排除，可随时重置。
- 最近抽签记录、复制抽签结果、空格键快捷抽签。
- 响应式布局，手机浏览器可用；设置会保存在本机浏览器。

## 抽签规则

1. 先按当前筛选条件构建曲池，**每首歌等概率**抽 1 首。
2. 再在这首歌的可用谱面中，按已选难度、等级范围**等概率**抽 1 个难度。
3. 开启「不重复抽签」时，已抽过的歌曲不会再次出现，直到点「重置本轮」。

---

## 在本地打开

1. 下载 `index.html`。
2. 双击用浏览器打开即可。

不需要联网。若浏览器限制了本地文件的剪贴板权限，「复制结果」可能会提示失败，可以手动选中文字复制；部署到 GitHub Pages 后复制功能会正常工作。

---

## 上传到 GitHub Pages（推荐）

### 方法 A：网页上传（不需要装 Git）

1. 登录 GitHub，点右上角 **+ → New repository**。
2. 仓库名填 `pjsk-draw`（或任意名字），选择 **Public**，点 **Create repository**。
3. 进入仓库，点 **Add file → Upload files**。
4. 把 `index.html` 拖进去；`README.md` 可选，一并上传。
5. 点 **Commit changes**。
6. 打开仓库的 **Settings → Pages**。
7. 在 **Build and deployment** 中：
   - **Source** 选 `Deploy from a branch`
   - **Branch** 选 `main`，目录选 `/ (root)`
   - 点 **Save**
8. 等待 1–3 分钟，刷新 Settings → Pages，顶部会出现访问地址。

访问地址通常是：

```text
https://<你的 GitHub 用户名>.github.io/pjsk-draw/
```

例如用户名为 `miku39`，仓库名为 `pjsk-draw`：

```text
https://miku39.github.io/pjsk-draw/
```

> 如果仓库名取成 `<你的用户名>.github.io`，访问地址会变成 `https://<你的用户名>.github.io/`。
> 仓库必须是 Public；Private 仓库的 Pages 需要 GitHub 付费方案。

### 方法 B：命令行上传

在本目录执行（把 `<用户名>` 和 `<仓库名>` 换成你的）：

```bash
git init
git add index.html README.md
git commit -m "feat: PJSK random draw"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

然后按方法 A 的第 6–8 步开启 GitHub Pages。

### 访问与分享

- 直接打开上面的 `https://<用户名>.github.io/<仓库名>/`。
- 手机上也可以用同一个网址；在浏览器菜单里选「添加到主屏幕」，用起来更像一个小应用。
- 不要用 `raw.githubusercontent.com` 的链接直接访问 `index.html`：GitHub 会把它当纯文本返回，不会渲染成网页。要用 GitHub Pages 的地址。

### 更新页面

修改 `index.html` 后重新上传 / commit 即可，GitHub Pages 会自动重新发布：

```bash
git add index.html
git commit -m "update draw page"
git push
```

如果打开还是旧版，等 1–2 分钟并强制刷新（Windows：`Ctrl + F5`；手机：清缓存或换隐私窗口）。

### 国内访问慢怎么办？

GitHub Pages 在国内偶尔会慢或连接不稳定。这个工具是纯静态单文件：

- 最稳妥：把 `index.html` 下载到本地，双击打开，完全离线可用。
- 也可以把 `index.html` 上传到 Cloudflare Pages、Netlify、Vercel 等静态托管，访问会更快；无需改代码。

---

## 更新曲库（可选，需要 Python）

压缩包里附带了数据构建脚本和构建后的 `data/songs.json`，方便国服版本更新后重新生成：

```text
data/songs.json       构建后的精简曲库（随压缩包提供）
src/                  页面模板、样式、脚本（随压缩包提供）
tools/build_data.py   过滤当前可用曲目，生成 data/songs.json
tools/build_site.py   把 CSS/JS/曲库内嵌成单文件 index.html
```

1. 从 [Sekai-World/sekai-master-db-cn-diff](https://github.com/Sekai-World/sekai-master-db-cn-diff) 下载最新的 `musics.json`、`musicDifficulties.json`、`musicTags.json`、`limitedTimeMusics.json`，放进 `data/`。
2. 运行：

```bash
python -X utf8 tools/build_data.py
python tools/build_site.py
```

3. 重新上传生成的 `index.html`。

`build_data.py` 会按运行当天的时间：
- 跳过尚未上线的曲目；
- 跳过已经结束的限时谱面；
- 只保留当前可选曲目。

如果只是普通使用，不需要执行这一步，下载 `index.html` 即可。

---

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | **唯一需要上传的成品**，单文件网页 |
| `README.md` | 本说明 |
| `pjsk-draw.zip` | 便于下载/转发的打包文件：含成品、说明与可选构建源码 |

`pjsk-draw.zip` 中除 `index.html` 和 `README.md` 外，还包含 `src/`、`tools/`、`data/songs.json`，供以后更新曲库使用。这些源码不影响部署；如果你只想上线，上传 `index.html` 就够了。

---

## 数据与版权

- 本项目是非官方同人工具，与 SEGA、Colorful Palette、Crypton Future Media 及国服运营方无隶属关系。
- 游戏曲名、角色、谱面数据等版权归原权利方所有。
- 曲库数据来自 Sekai-World 社区维护的国服 Master DB；如果发现曲目缺失或中文名有误，通常是上游数据尚未更新，可以按上面的步骤重新构建。
- 页面不收集任何个人信息；筛选设置、抽签记录只保存在你自己的浏览器 `localStorage` 中。

## 常见问题

**打开是空白页 / 按钮没反应？**  
确认浏览器启用了 JavaScript，并且 `index.html` 没有被下载工具截断。换一个现代浏览器（Chrome、Edge、Safari、Firefox）再试。

**GitHub Pages 显示 404？**  
先确认仓库是 Public、Pages 的 Branch 选的是 `main`、目录是 `/ (root)`，并等待首次部署完成。地址末尾不要漏掉 `/`。

**为什么曲目数量和别处不一样？**  
这是“国服当前可游玩”的曲池，包含常驻曲目，排除未来曲目和已结束的限时谱面。曲库截止日期写在页面页脚。版本更新后可以用上面的脚本重建。

**为什么一首歌会出现在多个组合里？**  
组合标签按 Master DB 的多标签规则展示；VOCALOID 原曲与其翻唱组合可能同时出现，方便按不同维度筛选。

**抽到重复的歌？**  
检查「不重复抽签」是否开启；开启后如果本轮抽完，点「重置本轮」即可开始新一轮。

**APPEND 一直抽不到？**  
APPEND 只存在于 128 首曲目中；确认难度筛选里 APPEND 处于选中状态，且等级范围覆盖它的等级。

---

祝你今天也能抽到想打的歌。♪
