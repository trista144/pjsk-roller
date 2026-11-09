#!/usr/bin/env python3
"""Inline CSS, JS and song data into self-contained HTML pages.

Outputs:
  index.html  — 演奏随机抽签
  quiz.html   — 听歌识曲小游戏
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

PAGES = [
    {
        "out": "index.html",
        "template": "template.html",
        "css": ["style.css"],
        "js": ["app.js"],
    },
    {
        "out": "quiz.html",
        "template": "quiz.template.html",
        # The quiz reuses the shared visual language and adds its own rules.
        "css": ["style.css", "quiz.css"],
        # fuzzy.js defines window.PJSK_FUZZY and must load before quiz.js.
        "js": ["fuzzy.js", "quiz.js"],
        "title_pairs": True,
    },
]


def build_title_pairs() -> str:
    pairs = json.loads((SRC / "quiz-titles.txt").read_text(encoding="utf-8"))
    return json.dumps(pairs, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def build_title_aliases() -> str:
    """合并手写别名与自动抓取的别名，输出 {歌曲ID: [别名...]} 的 JSON。

    来源优先级：src/quiz-aliases.txt（手写，便于修正）在前，
    src/quiz-aliases.generated.txt（由 tools/build_aliases.py 从 pjsk.moe 快照生成）在后。
    """
    mapping: dict[str, list[str]] = {}
    for name in ("quiz-aliases.txt", "quiz-aliases.generated.txt"):
        path = SRC / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            song_id = parts[0]
            if not song_id.isdigit():
                continue
            bucket = mapping.setdefault(song_id, [])
            for alias in parts[1:]:
                if alias and alias not in bucket:
                    bucket.append(alias)
    return json.dumps(mapping, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def build_library() -> str:
    library = json.loads((ROOT / "data" / "songs.json").read_text(encoding="utf-8"))
    data = json.dumps(library, ensure_ascii=False, separators=(",", ":"))
    # Keep an accidental </script> inside the data from ending the JSON block.
    return data.replace("</", "<\\/")


def main() -> None:
    library_json = build_library()
    title_pairs = build_title_pairs()
    title_aliases = build_title_aliases()
    for page in PAGES:
        template = (SRC / page["template"]).read_text(encoding="utf-8")
        css = "\n".join((SRC / name).read_text(encoding="utf-8") for name in page["css"])
        js = "\n".join((SRC / name).read_text(encoding="utf-8") for name in page["js"])
        html = (
            template.replace("/*__CSS__*/", css)
            .replace("/*__JS__*/", js)
            .replace("__LIBRARY_JSON__", library_json)
            .replace("__TITLE_PAIRS__", title_pairs if page.get("title_pairs") else "[]")
            .replace("__TITLE_ALIASES__", title_aliases if page.get("title_pairs") else "{}")
        )
        out = ROOT / page["out"]
        out.write_text(html, encoding="utf-8")
        print(f"wrote {out.name:12s} {len(html):>9,} chars")


if __name__ == "__main__":
    main()
