from modules.webui.console import TerminalParser


def plain(line):
    return "".join(span.text for span in line.spans)


def test_parser_handles_split_utf8_and_crlf():
    parser = TerminalParser()
    encoded = "caf\u00e9\r\n".encode("utf-8")
    assert parser.feed(encoded[:4]) == []
    lines = parser.feed(encoded[4:])
    assert [plain(line) for line in lines] == ["caf\u00e9"]
    assert lines[0].overwrite is False


def test_parser_turns_tqdm_carriage_returns_into_overwrites():
    parser = TerminalParser()
    parser.feed(b"\r10%")
    first = parser.snapshot_transient()
    parser.feed(b"\r20%")
    second = parser.snapshot_transient()
    assert first is not None and plain(first) == "10%" and first.overwrite is True
    assert second is not None and plain(second) == "20%" and second.overwrite is True


def test_parser_keeps_sgr_as_classes_and_strips_osc():
    parser = TerminalParser()
    lines = parser.feed(b"\x1b[31;1merror\x1b[0m \x1b]8;;https://bad\x07link\n")
    assert lines[0].spans[0].text == "error"
    assert lines[0].spans[0].classes == ("fg-red", "bold")
    assert "https://bad" not in plain(lines[0])
    assert plain(lines[0]).endswith(" link")


def test_parser_sgr_styles_and_resets():
    parser = TerminalParser()
    lines = parser.feed(b"\x1b[32mgreen \x1b[41mgreen-bg-red \x1b[39mdefault-fg \x1b[0mplain\n")
    spans = lines[0].spans
    assert spans[0].text == "green "
    assert spans[0].classes == ("fg-green",)
    assert spans[1].text == "green-bg-red "
    assert spans[1].classes == ("fg-green", "bg-red")
    assert spans[2].text == "default-fg "
    assert spans[2].classes == ("bg-red",)
    assert spans[3].text == "plain"
    assert spans[3].classes == ()


def test_parser_line_ids_increment():
    parser = TerminalParser()
    lines1 = parser.feed(b"first line\n")
    lines2 = parser.feed(b"second line\n")
    assert lines1[0].id == 1
    assert lines2[0].id == 2
