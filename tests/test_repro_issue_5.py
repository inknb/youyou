"""复现：残留半截文件必须被识别为未完成并重新下载补全。"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

NETEASE_DIR = Path(__file__).resolve().parents[1] / "netease_url"
if str(NETEASE_DIR) not in sys.path:
    sys.path.insert(0, str(NETEASE_DIR))

from music_downloader import MusicDownloader, MusicInfo  # noqa: E402


class _FakeResponse:
    """最小 requests.Response 打桩。"""

    def __init__(self, payload: bytes):
        self.payload = payload
        self.raise_for_status_called = False

    def raise_for_status(self):
        self.raise_for_status_called = True

    def iter_content(self, chunk_size: int = 8192):
        for i in range(0, len(self.payload), chunk_size):
            yield self.payload[i:i + chunk_size]

    def close(self):  # pragma: no cover - 兼容 with 用法
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _info(size: int = 100) -> MusicInfo:
    return MusicInfo(
        id=1,
        name="歌名",
        artists="艺人",
        album="专辑",
        pic_url="",
        duration=10,
        track_number=1,
        download_url="http://example.com/song.mp3",
        file_type="mp3",
        file_size=size,
        quality="standard",
    )


@pytest.fixture()
def downloader(tmp_path):
    return MusicDownloader(download_dir=str(tmp_path / "dl"))


def test_residual_partial_file_is_redownloaded(downloader, monkeypatch):
    """残留 10 字节文件 vs 真实 100 字节 -> 必须重新下载补全。"""
    info = _info(100)
    monkeypatch.setattr(downloader, "get_music_info", lambda *a, **k: info)
    monkeypatch.setattr(downloader, "_write_metadata_with_ffmpeg", lambda *a, **k: True)

    target = downloader._build_file_path(info)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"0" * 10)

    monkeypatch.setattr(
        "music_downloader.requests.get",
        lambda *a, **k: _FakeResponse(b"x" * 100),
    )

    result = downloader.download_music_file(1)

    assert result.success is True
    assert target.stat().st_size == 100


def test_complete_file_short_circuits(downloader, monkeypatch):
    """大小与 file_size 相符 -> 短路返回，不重新下载。"""
    info = _info(100)
    monkeypatch.setattr(downloader, "get_music_info", lambda *a, **k: info)

    target = downloader._build_file_path(info)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"y" * 100)

    def _fail(*a, **k):
        raise AssertionError("已完整文件不应触发重新下载")

    monkeypatch.setattr("music_downloader.requests.get", _fail)

    result = downloader.download_music_file(1)

    assert result.success is True
    assert target.stat().st_size == 100


def test_unknown_file_size_keeps_existing_behavior(downloader, monkeypatch):
    """file_size 未知（0）时，只要文件存在即短路，避免误判。"""
    info = _info(0)
    monkeypatch.setattr(downloader, "get_music_info", lambda *a, **k: info)

    target = downloader._build_file_path(info)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"z" * 10)

    def _fail(*a, **k):
        raise AssertionError("file_size 未知时不应重新下载")

    monkeypatch.setattr("music_downloader.requests.get", _fail)

    result = downloader.download_music_file(1)

    assert result.success is True
    assert target.stat().st_size == 10
