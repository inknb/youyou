"""测试基础设施：缺失的可选依赖打桩 + netease_url 加入导入路径。

本仓库的 Python 单测聚焦纯逻辑（cookie 解析 / 文件名与扩展名 / ID 提取 / 加密算法），
不应要求安装 requests、cryptography、aiohttp、flask 等运行时依赖：

- 已安装的环境：照常使用真实依赖；
- 未安装的环境（CI / 离线）：用最小打桩替代，只保证 import 与常量/类名可用。

另外把 netease_url/ 加入 sys.path，使 `import music_api` 这类扁平导入在
仓库根目录跑 pytest 时也能工作。
"""

from __future__ import annotations

import importlib
import sys
import types
from pathlib import Path

NETEASE_DIR = Path(__file__).resolve().parents[1] / "netease_url"
if str(NETEASE_DIR) not in sys.path:
    sys.path.insert(0, str(NETEASE_DIR))


def _module(name: str, **attrs) -> types.ModuleType:
    mod = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(mod, key, value)
    return mod


def _ensure(name: str, factory) -> types.ModuleType:
    """依赖缺失时才打桩；已安装则原样使用。"""
    try:
        return importlib.import_module(name)
    except Exception:
        stub = factory()
        sys.modules[name] = stub
        return stub


class _AnyCallable:
    """占位对象：可实例化、可调用，仅满足 import 期的类名引用。"""

    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, *args, **kwargs):
        return self

    def __getattr__(self, item):
        return self


def _stub_requests():
    exc = type("RequestException", (Exception,), {})
    return _module(
        "requests",
        get=lambda *a, **k: None,
        post=lambda *a, **k: None,
        RequestException=exc,
    )


def _stub_cryptography():
    crypto = _module("cryptography")
    hazmat = _module("cryptography.hazmat")
    primitives = _module("cryptography.hazmat.primitives")
    padding = _module("cryptography.hazmat.primitives.padding", PKCS7=_AnyCallable)
    ciphers = _module(
        "cryptography.hazmat.primitives.ciphers",
        Cipher=_AnyCallable,
        algorithms=_module("cryptography.hazmat.primitives.ciphers.algorithms", AES=_AnyCallable),
        modes=_module("cryptography.hazmat.primitives.ciphers.modes", ECB=_AnyCallable),
    )
    primitives.padding = padding
    primitives.ciphers = ciphers
    hazmat.primitives = primitives
    crypto.hazmat = hazmat
    sys.modules.update({
        "cryptography": crypto,
        "cryptography.hazmat": hazmat,
        "cryptography.hazmat.primitives": primitives,
        "cryptography.hazmat.primitives.padding": padding,
        "cryptography.hazmat.primitives.ciphers": ciphers,
        "cryptography.hazmat.primitives.ciphers.algorithms": ciphers.algorithms,
        "cryptography.hazmat.primitives.ciphers.modes": ciphers.modes,
    })
    return crypto


def _stub_aiohttp():
    return _module(
        "aiohttp",
        ClientSession=_AnyCallable,
        ClientError=type("ClientError", (Exception,), {}),
    )


def _stub_aiofiles():
    return _module("aiofiles", open=lambda *a, **k: None)


def _stub_flask():
    class _StubApp:
        def __init__(self, *args, **kwargs):
            pass

        def route(self, *args, **kwargs):
            def decorator(fn):
                return fn
            return decorator

        @staticmethod
        def before_request(fn):
            return fn

        @staticmethod
        def after_request(fn):
            return fn

        @staticmethod
        def errorhandler(*args, **kwargs):
            return lambda fn: fn

        def run(self, *args, **kwargs):
            pass

    return _module(
        "flask",
        Flask=_StubApp,
        request=None,
        send_file=lambda *a, **k: None,
        render_template=lambda *a, **k: "",
        Response=object,
    )


for _name, _factory in (
    ("requests", _stub_requests),
    ("cryptography", _stub_cryptography),
    ("aiohttp", _stub_aiohttp),
    ("aiofiles", _stub_aiofiles),
    ("flask", _stub_flask),
):
    _ensure(_name, _factory)
