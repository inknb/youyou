"""复现：_extract_music_id 对路径式网易云链接必须提取出数字 ID。

验收：
- /song/<id> 与 /m/song/<id> 能提取
- 查询式 ?id=xxx、纯净数字输入既有行为不变
- 163cn.tv 短链跳转处理不受影响
"""

import sys
from pathlib import Path

import pytest

NETEASE_DIR = Path(__file__).resolve().parents[1] / "netease_url"
if str(NETEASE_DIR) not in sys.path:
    sys.path.insert(0, str(NETEASE_DIR))

import main  # noqa: E402  （conftest 负责打桩）


def test_extract_music_id_path_song():
    svc = main.api_service
    assert svc._extract_music_id("https://music.163.com/song/123456") == "123456"


def test_extract_music_id_mobile_path_song():
    svc = main.api_service
    assert svc._extract_music_id("https://music.163.com/m/song/654321") == "654321"


def test_extract_music_id_path_song_with_suffix():
    svc = main.api_service
    assert svc._extract_music_id("https://music.163.com/song/42/?userid=1") == "42"
    assert svc._extract_music_id("https://music.163.com/#/song/777") == "777"


def test_extract_music_id_existing_behaviour_unchanged():
    svc = main.api_service
    assert svc._extract_music_id("123456") == "123456"
    assert svc._extract_music_id(" 123456 ") == "123456"
    assert svc._extract_music_id("https://music.163.com/song?id=123456&userid=1") == "123456"
    assert svc._extract_music_id("https://music.163.com/#/song?id=999") == "999"


def test_extract_music_id_short_link_redirect(monkeypatch):
    svc = main.api_service
    fake_requests = sys.modules.get("requests")
    if fake_requests is None:
        pytest.skip("requests 桩缺失")

    class _Resp:
        headers = {"Location": "https://music.163.com/song/888888"}

    monkeypatch.setattr(fake_requests, "get", lambda *a, **k: _Resp(), raising=False)
    assert svc._extract_music_id("https://163cn.tv/abcdefg") == "888888"
