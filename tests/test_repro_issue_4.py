"""复现：qr_login CLI 必须按 QRLoginManager 的现有契约工作。

契约（tests/test_music_api.py 已锁定）：
- create_qr_login() -> Optional[str]（unikey；None 表示生成失败）
- check_qr_login(unikey) -> (code, cookies)

缺陷：CLI 按旧的字典协议取值（qr_result.get('success') / ['qr_key'] /
status_result.get('status')），第一步就 AttributeError: 'str' object has no
attribute 'get'，被外层 except 吞掉后返回"登录过程中发生未知错误"，
用户永远无法完成扫码登录。

另外锁定：非交互环境（stdin 已关闭/被重定向）与 Ctrl-C 不该再被外层
except 吞成"未知错误"，而应复用现有登录 / 友好退出。
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


def _write_existing_cookie(tmp_path):
    (tmp_path / "cookie.txt").write_text(
        "MUSIC_U=existing-token; __csrf=csrf-token\n", encoding="utf-8"
    )


def _client_with_existing_login(tmp_path):
    _write_existing_cookie(tmp_path)
    client = QRLoginClient(cookie_file=str(tmp_path / "cookie.txt"))
    client.qr_manager = _FakeQRManager([])
    return client


def test_interactive_login_success_writes_music_u(tmp_path):
    """803 成功：返回 (True, None)，且 MUSIC_U 被写入 cookie.txt。"""
    client = _client(tmp_path, [(803, {"MUSIC_U": "token-abc"})])

    ok, error = client.interactive_login()

    assert ok is True, f"期望登录成功，实际 ok={ok} error={error}"
    assert error is None
    assert "MUSIC_U=token-abc" in (tmp_path / "cookie.txt").read_text(encoding="utf-8")
    assert client.qr_manager.unikeys == ["unikey-repro"]


def test_interactive_login_801_802_then_803(tmp_path):
    """801 等待扫码 → 802 已扫描 → 803 成功，全程不得抛 AttributeError。"""
    client = _client(tmp_path, [(801, {}), (802, {}), (803, {"MUSIC_U": "token-xyz"})])

    ok, error = client.interactive_login()

    assert ok is True, f"期望登录成功，实际 ok={ok} error={error}"
    assert "MUSIC_U=token-xyz" in (tmp_path / "cookie.txt").read_text(encoding="utf-8")
    assert client.qr_manager.calls == 3


def test_interactive_login_expired_code_800(tmp_path):
    """800（二维码过期）应给出明确失败原因并退出。"""
    client = _client(tmp_path, [(800, {})])

    ok, error = client.interactive_login()

    assert ok is False
    assert error and "800" in error


def test_interactive_login_unknown_code(tmp_path):
    """其它错误码也要给出明确原因，而不是笼统的未知错误。"""
    client = _client(tmp_path, [(870, {})])

    ok, error = client.interactive_login()

    assert ok is False
    assert error and "870" in error


def test_interactive_login_create_failure(tmp_path):
    """create_qr_login 返回 None 视为生成失败。"""
    client = QRLoginClient(cookie_file=str(tmp_path / "cookie.txt"))
    client.qr_manager = _NoneQRManager([])

    ok, error = client.interactive_login()

    assert ok is False
    assert error


def test_existing_login_non_interactive_reuses_cookie(tmp_path, monkeypatch):
    """stdin 已关闭（非交互）时不得吞成未知错误，应沿用现有登录。"""
    client = _client_with_existing_login(tmp_path)

    def _no_stdin(*args, **kwargs):
        raise EOFError("stdin closed")

    monkeypatch.setattr("builtins.input", _no_stdin)

    ok, error = client.interactive_login()

    assert ok is True, f"非交互环境应复用已有登录，实际 ok={ok} error={error}"
    assert error is None
    assert client.qr_manager.calls == 0


def test_existing_login_keyboard_interrupt_is_friendly(tmp_path, monkeypatch):
    """在确认提示处按 Ctrl-C 应友好退出，而不是把 KeyboardInterrupt 抛给调用方。"""
    client = _client_with_existing_login(tmp_path)

    def _interrupt(*args, **kwargs):
        raise KeyboardInterrupt

    monkeypatch.setattr("builtins.input", _interrupt)

    try:
        ok, error = client.interactive_login()
    except KeyboardInterrupt:
        pytest.fail("Ctrl-C 未被友好处理，KeyboardInterrupt 直接抛给了调用方")

    assert ok is False
    assert error and "取消" in error
