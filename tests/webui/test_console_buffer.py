from modules.webui.console import ConsoleBuffer, ConsoleLine, ConsoleSpan, RotatingLogSink


def line(identifier: int, text: str, overwrite: bool = False) -> ConsoleLine:
    return ConsoleLine(identifier, (ConsoleSpan(text, ()),), overwrite)


def test_buffer_enforces_line_and_byte_limits():
    buffer = ConsoleBuffer(max_lines=2, max_bytes=7)
    buffer.apply([line(1, "one"), line(2, "two"), line(3, "three")])
    assert [item.id for item in buffer.snapshot()["lines"]] == [3]


def test_transient_line_is_replaced_not_committed():
    buffer = ConsoleBuffer()
    buffer.apply([line(1, "10%", True), line(2, "20%", True)])
    snapshot = buffer.snapshot()
    assert snapshot["lines"] == []
    assert snapshot["transient"] is not None
    assert snapshot["transient"].id == 2


def test_rotating_log_keeps_active_and_one_backup(tmp_path):
    sink = RotatingLogSink(tmp_path / "webui.log", max_bytes=8)
    sink.write(b"12345678")
    sink.write(b"9")
    sink.close()
    assert (tmp_path / "webui.log").read_bytes() == b"9"
    assert (tmp_path / "webui.log.1").read_bytes() == b"12345678"


def test_rotating_log_reopen(tmp_path):
    log_file_1 = tmp_path / "first.log"
    log_file_2 = tmp_path / "second.log"
    sink = RotatingLogSink(log_file_1, max_bytes=100)
    sink.write(b"hello")
    sink.reopen(log_file_2)
    sink.write(b"world")
    sink.close()

    assert log_file_1.read_bytes() == b"hello"
    assert log_file_2.read_bytes() == b"world"
    assert sink.last_error is None
