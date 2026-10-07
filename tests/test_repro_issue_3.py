"""复现：parse_cookie_string 在混合分隔符（换行 + 分号）下解析错乱。"""

from music_api import parse_cookie_string


def test_mixed_newline_and_semicolon_separators():
    assert parse_cookie_string("MUSIC_U=abc\n__csrf=def; os=pc") == {
        "MUSIC_U": "abc",
        "__csrf": "def",
        "os": "pc",
    }


def test_mixed_with_extra_whitespace_and_trailing_sep():
    assert parse_cookie_string(" MUSIC_U=abc ;\n __csrf=def ;\n os=pc ") == {
        "MUSIC_U": "abc",
        "__csrf": "def",
        "os": "pc",
    }


def test_pure_separators_unchanged():
    assert parse_cookie_string("MUSIC_U=abc; __csrf=def; os=pc") == {
        "MUSIC_U": "abc",
        "__csrf": "def",
        "os": "pc",
    }
    assert parse_cookie_string("MUSIC_U=abc\n__csrf=def\n") == {
        "MUSIC_U": "abc",
        "__csrf": "def",
    }
    assert parse_cookie_string("") == {}
    assert parse_cookie_string("junk; k=v") == {"k": "v"}
