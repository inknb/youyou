"""复现：qr_login CLI 必须按 QRLoginManager 的现有契约工作。

契约（见 tests/test_music_api.py 锁定）：
- create_qr_login() -> Optional[str]（unikey）
- check_qr_login(unikey) -> (code, cookies) 二元组
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

NETEASE_DIR = Path(__file__).resolve().parents[1] / "netease_url"
if str(NETEASE_DIR) not in sys.path:
    sys.path.insert(0, str(NETEASE_DIR))

import qr_login  # noqa: E402
from qr_login import QRLoginClient  # noqa: E402


class _FakeQRManager:
    """按真实契约打桩：create 返回 unikey 字符串，check 返回 (code, cookies)。"""

    def __init__(self, sequence):
        self.sequence = list(sequence)
        self.unikeys = []
        self.calls = 0

    def create_qr_login(self):
        return "unikey-repro"

    def check_qr_login(self, unikey):
        self.unikeys.append(unikey)
        self.calls += 1
        index = min(self.calls - 1, len(self.sequence) - 1)
        return self.sequence[index]


class _NoneQRManager(_FakeQRManager):
    def create_qr_login(self):
        return None


@pytest.fixture(autouse=True)
def _fast_sleep(monkeypatch):
    monkeypatch.setattr(qr_login.time, "sleep", lambda *a, **k: None)


def _client(tmp_path, sequence):
    client = QRLoginClient(cookie_file=str(tmp_path / "cookie.txt"))
    client.qr_manager = _FakeQRManager(sequence)
    return client


def test_interactive_login_success_writes_music_u(tmp_path):
    """803 成功时返回 (True, None) 并把 MUSIC_U 写入 cookie.txt。"""
    client = _client(tmp_path, [(803, {"MUSIC_U": "token-abc"})])

    ok, error = client.interactive_login()

    assert ok is True, f"期望登录成功，实际: ok={ok}, error={error}"
    assert error is None
    content = (tmp_path / "cookie.txt").read_text(encoding="utf-8")
    assert "MUSIC_U=token-abc" in content
    assert client.qr_manager.unikeys == ["unikey-repro"]


def test_interactive_login_waiting_scanned_then_success(tmp_path):
    """801 等待扫码 → 802 已扫描 → 803 成功，全程不得抛 AttributeError。"""
    client = _client(
        tmp_path,
        [(801, {}), (802, {}), (803, {"MUSIC_U": "token-xyz"})],
    )

    ok, error = client.interactive_login()

    assert ok is True, f"期望登录成功，实际: ok={ok}, error={error}"
    assert "MUSIC_U=token-xyz" in (tmp_path / "cookie.txt").read_text(encoding="utf-8")
    assert client.qr_manager.calls == 3


def test_interactive_login_expired_code_800(tmp_path):
    """800（二维码过期）应给出明确失败原因并退出。"""
    client = _client(tmp_path, [(800, {})])

    ok, error = client.interactive_login()

    assert ok is False
    assert error and "800" in error


def test_interactive_login_create_failure(tmp_path):
    """create_qr_login 返回 None 视为生成失败。"""
    client = QRLoginClient(cookie_file=str(tmp_path / "cookie.txt"))
    client.qr_manager = _NoneQRManager([])

    ok, error = client.interactive_login()

    assert ok is False
    assert error
