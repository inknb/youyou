"""复现 issue：进入网站后，点击/触摸页面任意位置就会开始播放音乐，
而期望只有点击播放器控件（播放按钮 / 歌单曲目）才开始播放。"""

import re
from pathlib import Path

MUSIC_JS = Path(__file__).resolve().parents[1] / "frontend" / "music.js"

# 绑定在 document 上、代表“页面任意位置交互”的监听器
GLOBAL_INTERACTION_RE = re.compile(
    r"document\.addEventListener\(\s*['\"](click|keydown|keyup|keypress|touchstart|pointerdown|mousedown)['\"]"
)


def _source() -> str:
    return MUSIC_JS.read_text(encoding="utf-8")


def _matched_call(src: str, pattern_start: int) -> str:
    """从匹配起点取出完整的 addEventListener(...) 调用（括号配平）。"""
    open_idx = src.index("(", pattern_start)
    depth = 0
    for i in range(open_idx, len(src)):
        ch = src[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return src[pattern_start:i + 1]
    return src[pattern_start:]


def test_page_interaction_does_not_start_playback():
    """页面任意处的点击/按键都不应触发音频播放。"""
    src = _source()
    assert "unlockPlayback" not in src, "仍保留“点击页面任意处即解锁播放”的逻辑"

    offenders = []
    for m in GLOBAL_INTERACTION_RE.finditer(src):
        call = _matched_call(src, m.start())
        if re.search(r"\.play\s*\(", call):
            offenders.append(re.sub(r"\s+", " ", call)[:160])
    assert not offenders, "全局交互监听器内调用了 audio.play()：%s" % offenders


def test_player_is_not_autoplayed_on_init():
    """初始化只恢复曲目与进度，不应在用户点击播放器之前发起播放。"""
    src = _source()
    assert not re.search(r"loadMusicTrack\(\s*startIndex\s*,\s*true\s*\)", src), \
        "初始化时不应自动播放曲目"
    assert re.search(r"loadMusicTrack\(\s*startIndex\s*,\s*false\s*\)", src), \
        "初始化应只加载曲目（autoplay=false），等待用户点击播放器"
