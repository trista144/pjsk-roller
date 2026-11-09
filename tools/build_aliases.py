#!/usr/bin/env python3
"""把 pjsk.moe / Team-Haruki 的别名快照转成页面可用的别名表。

输入：data/music_aliases.json
输出：src/quiz-aliases.generated.txt（格式同 quiz-aliases.txt：歌曲ID|别名1|别名2|...）

数据来源
  - 别名：pjsk.moe（https://pjsk.moe/zh-cn/）页面展示的歌曲别称，
    其后端为 Team-Haruki 的 alias API，社区用户上传维护。
  - 快照：https://moe.exmeaning.com/data/music_alias/music_aliases.json

过滤规则（为了体积和准确率）：
  1. 只保留本曲库里存在的歌曲
  2. 去掉清洗后长度 < 2 的（如单字、单字母）
  3. 去掉纯 1~2 位数字（"01"、"06" 这类只会造成噪声）
  4. 去掉超长的整句梗（清洗后 > 24 字），对匹配没帮助且很占体积
  5. 去掉与"另一首歌的正式曲名"完全相同的别名，避免张冠李戴
  6. 同一首歌内去重
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DATA = ROOT / "data"

ALIAS_SNAPSHOT = DATA / "music_aliases.json"
OUT_FILE = SRC / "quiz-aliases.generated.txt"

MAX_ALIAS_CHARS = 24


def normalize(text: str) -> str:
    """与页面一致的粗归一化，用于比较和去重。"""
    text = unicodedata.normalize("NFKC", str(text or "")).lower()
    text = re.sub(r"[\s\-–—_·・.,，。、!?！？'\"“”‘’()（）\[\]【】「」『』<>《》♪♯♭#☆★×÷:：;；/／\\|~～`@$%^&*+=]+", "", text)
    return text


def load_library() -> dict[int, dict]:
    lib = json.loads((DATA / "songs.json").read_text(encoding="utf-8"))
    return {song["i"]: song for song in lib["songs"]}


def main() -> None:
    if not ALIAS_SNAPSHOT.exists():
        print(f"缺少 {ALIAS_SNAPSHOT}，跳过别名生成")
        return

    snapshot = json.loads(ALIAS_SNAPSHOT.read_text(encoding="utf-8"))
    library = load_library()

    # 所有正式曲名（清洗后），用于排除"别名撞别人曲名"的情况
    official: dict[str, int] = {}
    for song_id, song in library.items():
        for name in (song["c"], song["t"]):
            key = normalize(name)
            if key:
                official.setdefault(key, song_id)

    lines: list[str] = []
    kept_aliases = 0
    dropped = {"short": 0, "numeric": 0, "toolong": 0, "collision": 0, "dup": 0}

    for entry in snapshot.get("musics", []):
        song_id = entry.get("music_id")
        if song_id not in library:
            continue
        song = library[song_id]
        seen: set[str] = set()
        accepted: list[str] = []
        for raw in entry.get("aliases") or []:
            alias = str(raw).strip()
            if not alias:
                continue
            key = normalize(alias)
            if not key:
                continue
            if len(key) < 2:
                dropped["short"] += 1
                continue
            if key.isdigit() and len(key) <= 2:
                dropped["numeric"] += 1
                continue
            if len(key) > MAX_ALIAS_CHARS:
                dropped["toolong"] += 1
                continue
            # 这个别名其实是别的歌的正式曲名 → 容易误判，丢掉
            owner = official.get(key)
            if owner is not None and owner != song_id:
                dropped["collision"] += 1
                continue
            if key in seen:
                dropped["dup"] += 1
                continue
            seen.add(key)
            accepted.append(alias)
        if accepted:
            kept_aliases += len(accepted)
            lines.append(f"{song_id}|" + "|".join(accepted))

    header = [
        "# 由 tools/build_aliases.py 自动生成，请勿手改。",
        "# 别名来源：pjsk.moe（https://pjsk.moe/zh-cn/），其后端为 Team-Haruki 的 alias API，",
        "# 由社区用户上传维护。快照取自 moe.exmeaning.com。",
        "# 想手动补充/修正别名，请改 src/quiz-aliases.txt（优先级更高）。",
        "",
    ]
    OUT_FILE.write_text("\n".join(header + lines) + "\n", encoding="utf-8")

    print(f"写出 {OUT_FILE.relative_to(ROOT)}")
    print(f"  覆盖歌曲 {len(lines)} 首，别名 {kept_aliases} 条")
    print(f"  文件大小 {OUT_FILE.stat().st_size:,} 字节")
    print(f"  过滤：{dropped}")


if __name__ == "__main__":
    main()
