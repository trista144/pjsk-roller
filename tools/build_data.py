#!/usr/bin/env python3
"""Build the compact, currently-available CN song library for the draw tool.

Source: Sekai-World/sekai-master-db-cn-diff (community mirror of the CN master DB).
Only songs whose CN release window has started and has not ended are kept.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "songs.json"

DIFF_ORDER = ["easy", "normal", "hard", "expert", "master", "append"]
# CN-exclusive songs / collab tracks: their preview clips are not in the public
# asset bucket, so the listening quiz excludes them (the draw tool keeps them).
CN_EXCLUSIVE_IDS = set(range(798, 802)) | set(range(11001, 11019))

GROUP_ORDER = [
    "light_music_club",
    "idol",
    "street",
    "theme_park",
    "school_refusal",
    "vocaloid",
    "other",
]


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main() -> None:
    now = dt.datetime.now(dt.timezone.utc)
    musics = load("musics.json")
    difficulties = load("musicDifficulties.json")
    tags = load("musicTags.json")
    limited = load("limitedTimeMusics.json")
    vocals = load("musicVocals.json")

    limited_by_music: dict[int, list[dict]] = {}
    for row in limited:
        limited_by_music.setdefault(row["musicId"], []).append(row)

    difficulty_by_music: dict[int, dict[str, int]] = {}
    for row in difficulties:
        difficulty_by_music.setdefault(row["musicId"], {})[
            row["musicDifficulty"]
        ] = row["playLevel"]

    tags_by_music: dict[int, list[str]] = {}
    for row in tags:
        if row["musicTag"] == "all":
            continue
        tags_by_music.setdefault(row["musicId"], []).append(row["musicTag"])

    # Preview audio clip per vocal version. The CN client ships the same
    # "music/short/<vocal>/<vocal>_short.mp3" clips that the JP database hosts.
    vocals_by_music: dict[int, list[tuple[str, str]]] = {}
    for row in vocals:
        vocals_by_music.setdefault(row["musicId"], []).append(
            (row["musicVocalType"], row["assetbundleName"])
        )

    songs = []
    skipped_future = 0
    skipped_limited = 0
    for music in musics:
        music_id = music["id"]
        published = dt.datetime.fromtimestamp(
            music["publishedAt"] / 1000, dt.timezone.utc
        )

        # Permanent songs are live once published. Limited songs also need to be
        # inside their event window (some collab / medley charts expire).
        windows = limited_by_music.get(music_id)
        if windows:
            live = any(
                dt.datetime.fromtimestamp(row["startAt"] / 1000, dt.timezone.utc)
                <= now
                <= dt.datetime.fromtimestamp(row["endAt"] / 1000, dt.timezone.utc)
                for row in windows
            )
            if not live:
                skipped_limited += 1
                continue
        elif published > now:
            skipped_future += 1
            continue

        diffs = difficulty_by_music.get(music_id, {})
        diffs = {d: diffs[d] for d in DIFF_ORDER if d in diffs}
        if not diffs:
            continue

        cn_title = (music.get("infos") or [{}])[0].get("title") or music["title"]
        cn_title = " ".join(str(cn_title).split())
        original = " ".join(str(music["title"]).split())
        groups = [g for g in GROUP_ORDER if g in tags_by_music.get(music_id, [])]
        if not groups:
            groups = ["other"]

        # Prefer the "sekai" (unit) version for the quiz so it sounds different
        # from the original vocaloid recording, then fall back to any clip.
        entries = vocals_by_music.get(music_id, [])
        ordered = sorted(
            entries,
            key=lambda v: (
                0 if v[0] == "sekai" else 1 if v[0] == "original_song" else 2,
                v[1],
            ),
        )
        av = [v[1] for v in ordered][:3]

        songs.append(
            {
                "i": music_id,
                "t": original,
                "c": cn_title,
                "g": groups,
                "d": diffs,
                "p": published.date().isoformat(),
                "av": av,
                # 国服独占曲目只在 CN 客户端内带试听，公开资产库里没有预览音频。
                "qc": 0 if music_id in CN_EXCLUSIVE_IDS else 1,
            }
        )

    songs.sort(key=lambda s: (s["p"], s["c"]), reverse=True)
    payload = {
        "asOf": now.date().isoformat(),
        "source": "https://github.com/Sekai-World/sekai-master-db-cn-diff",
        "count": len(songs),
        "songs": songs,
    }
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    chart_count = sum(len(s["d"]) for s in songs)
    append_count = sum(1 for s in songs if "append" in s["d"])
    with_audio = sum(1 for s in songs if s["av"])
    print(
        f"wrote {OUT} | songs={len(songs)} charts={chart_count} "
        f"append_songs={append_count} with_audio={with_audio} | "
        f"skipped future={skipped_future} limited/expired={skipped_limited}"
    )


if __name__ == "__main__":
    main()
