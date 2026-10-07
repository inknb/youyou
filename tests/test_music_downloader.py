"""music_downloader 纯逻辑单测：文件名清理 / 扩展名判定。"""

import pytest

from music_downloader import MusicDownloader


@pytest.fixture()
def downloader(tmp_path):
    return MusicDownloader(download_dir=str(tmp_path / "dl"))


def test_sanitize_filename_replaces_illegal_chars(downloader):
    assert downloader._sanitize_filename('a<b>c:d"e/f\\g|h?i*j') == "a_b_c_d_e_f_g_h_i_j"


def test_sanitize_filename_strips_dots_and_spaces(downloader):
    assert downloader._sanitize_filename("  .隐藏文件.  ") == "隐藏文件"


def test_sanitize_filename_fallback_and_truncation(downloader):
    assert downloader._sanitize_filename("") == "unknown"
    assert downloader._sanitize_filename("...") == "unknown"
    assert len(downloader._sanitize_filename("长" * 500)) == 200


def test_determine_extension_api_type_first(downloader):
    assert downloader._determine_file_extension("http://x/y.mp3", api_type="flac") == ".flac"
    assert downloader._determine_file_extension("http://x/y", api_type="m4a") == ".m4a"


def test_determine_extension_url_suffix(downloader):
    assert downloader._determine_file_extension("http://x/y.flac?auth=1") == ".flac"
    assert downloader._determine_file_extension("http://x/y.mp3") == ".mp3"


def test_determine_extension_content_type_fallback(downloader):
    assert downloader._determine_file_extension("http://x/download", content_type="audio/flac") == ".flac"
    assert downloader._determine_file_extension("http://x/download", content_type="audio/mpeg") == ".mp3"
    assert downloader._determine_file_extension("http://x/download") == ".mp3"
