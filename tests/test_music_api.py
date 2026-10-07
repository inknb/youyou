"""music_api 纯逻辑单测：cookie 解析 / 摘要 / 图片加密 / 二维码登录契约。"""

from music_api import CryptoUtils, NeteaseAPI, QRLoginManager, parse_cookie_string


# ---------- cookie 解析 ----------

def test_parse_cookie_string_semicolon():
    assert parse_cookie_string("MUSIC_U=abc; __csrf=def; os=pc") == {
        "MUSIC_U": "abc",
        "__csrf": "def",
        "os": "pc",
    }


def test_parse_cookie_string_newline():
    assert parse_cookie_string("MUSIC_U=abc\n__csrf=def\n") == {
        "MUSIC_U": "abc",
        "__csrf": "def",
    }


def test_parse_cookie_string_value_with_equals():
    assert parse_cookie_string("token=a=b=c") == {"token": "a=b=c"}


def test_parse_cookie_string_empty_and_junk():
    assert parse_cookie_string("") == {}
    assert parse_cookie_string("   ") == {}
    assert parse_cookie_string("junk; k=v") == {"k": "v"}


# ---------- 摘要与图片加密 ----------

def test_hash_digest_matches_reference():
    assert CryptoUtils.hash_hex_digest("abc") == "900150983cd24fb0d6963f7d28e17f72"
    assert CryptoUtils.hex_digest(b"\x00\x0f\xff") == "000fff"


def test_netease_encrypt_id_baseline():
    api = NeteaseAPI()
    # 锁行为基线：算法输出不得漂移（与网易云图片加密算法一致）
    assert api.netease_encrypt_id("1099511627776") == "hT6FywEYWzVEO4H0TPcl8Q=="


def test_get_pic_url_format():
    api = NeteaseAPI()
    enc = api.netease_encrypt_id("1099511627776")
    assert api.get_pic_url(1099511627776, size=300) == (
        f"https://p3.music.126.net/{enc}/1099511627776.jpg?param=300y300"
    )
    assert api.get_pic_url(None) == ""


# ---------- 二维码登录契约 ----------

class _FakeResponse:
    def __init__(self, text: str, headers: dict):
        self.text = text
        self.headers = headers


class _FakeHTTPClient:
    """最小 HTTP 桩：返回固定响应，用于离线验证 QRLoginManager 的解析契约。"""

    def __init__(self, payload: str, headers: dict | None = None):
        self.payload = payload
        self.headers = headers or {}

    def post_request_full(self, url, params, cookies):
        return _FakeResponse(self.payload, self.headers)


def test_qr_login_success_extracts_music_u():
    """check_qr_login 返回 (code, cookies) 二元组；803 时提取 MUSIC_U。"""
    manager = QRLoginManager()
    manager.http_client = _FakeHTTPClient('{"code": 803}', {"Set-Cookie": "MUSIC_U=tok123; Path=/"})
    code, cookies = manager.check_qr_login("unikey-test")
    assert code == 803
    assert cookies["MUSIC_U"] == "tok123"


def test_qr_login_waiting_state():
    manager = QRLoginManager()
    manager.http_client = _FakeHTTPClient('{"code": 801}')
    code, cookies = manager.check_qr_login("unikey-test")
    assert code == 801
    assert cookies == {}
