"""main.py 辅助逻辑单测（纯函数级，不启动 Flask 服务）。

conftest 已为缺失的 flask / requests / cryptography 等依赖打桩，
因此本文件可以在不安装运行环境的情况下离线运行。
"""

import main  # noqa: E402  （conftest 负责打桩与导路）


def test_extract_music_id_plain_number():
    svc = main.api_service
    assert svc._extract_music_id("123456") == "123456"
    assert svc._extract_music_id(" 123456 ") == "123456"


def test_extract_music_id_query_link():
    svc = main.api_service
    assert svc._extract_music_id("https://music.163.com/song?id=123456&userid=1") == "123456"
    assert svc._extract_music_id("https://music.163.com/#/song?id=999") == "999"


def test_format_file_size():
    svc = main.api_service
    assert svc._format_file_size(0) == "0B"
    assert svc._format_file_size(1023) == "1023.00B"
    assert svc._format_file_size(1024) == "1.00KB"
    assert svc._format_file_size(1024 * 1024 * 3 // 2) == "1.50MB"


def test_quality_display_name():
    svc = main.api_service
    assert svc._get_quality_display_name("lossless") == "无损音质"
    assert svc._get_quality_display_name("unknown-x") == "未知音质(unknown-x)"
