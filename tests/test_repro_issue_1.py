"""复现 issue：进入网站后随便触碰一下网站就会播放音乐，
期望只有点击播放器控件（播放按钮 / 歌单曲目 / 上一首下一首）才开始播放。

断言分四层：
1. 页面任意位置的交互（document/window/body 上的 click/touch/key 监听）都不得调用 audio.play()；
2. 初始化只加载曲目与进度（autoplay=false），不发起播放；
3. 真正的播放闸门必须校验"用户主动请求播放"标志，非用户触发的调用（如错误自动切歌）不得出声；
4. 文档不得再宣传"首次交互后自动续播"这一缺陷行为。
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUSIC_JS = ROOT / "frontend" / "music.js"
README = ROOT / "README.md"

# 代表“页面任意位置交互”的监听器（document / document.body / window）
GLOBAL_INTERACTION_RE = re.compile(
    r"(?:document|document\.body|window)\.addEventListener\(\s*"
    r"['\"](?:click|keydown|keyup|keypress|touchstart|touchend|pointerdown|mousedown)['\"]"
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
    """页面任意处的点击/按键/触摸都不应触发音频播放。"""
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


def test_playback_requires_explicit_user_request():
    """loadMusicTrack 内的 audio.play() 必须同时受“用户主动请求播放”标志保护。

    否则任何非用户触发的调用（如加载失败后自动切下一首）都会让音乐在
    用户没有点击播放器的情况下响起。
    """
    src = _source()
    assert re.search(r"if\s*\(\s*autoplay\s*&&\s*userPlaybackRequested\s*\)", src), \
        "audio.play() 未校验 userPlaybackRequested，非用户触发的调用也会播放"
    assert "userPlaybackRequested = false" in src, \
        "暂停时应清除“用户请求播放”标志，避免后续自动流程擅自恢复播放"


def test_readme_does_not_advertise_play_on_first_interaction():
    """文档不应再宣传“首次交互后自动续播”这一缺陷行为。"""
    readme = README.read_text(encoding="utf-8")
    assert "首次点击解锁" not in readme, "文档仍宣传“首次点击解锁”"
    assert "首次交互后自动续播" not in readme, "文档仍宣传“首次交互后自动续播”"
