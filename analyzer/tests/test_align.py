from malang_analyzer.align import compare, sound_verdicts

def test_sagwa_vs_dagwa():
    c = compare("사과", "다과")
    types = [o["type"] for o in c["ops"]]
    assert types == ["sub", "same", "same", "same"]
    assert c["matched"] == 3 and c["total"] == 4
    assert sound_verdicts(c["ops"], ["ㅅ", "ㅘ"]) == {"ㅅ": False, "ㅘ": True}

def test_allowed_ae_e():
    c = compare("그네", "그내")
    assert all(o["type"] in ("same", "allowed") for o in c["ops"])

def test_deleted_coda():
    c = compare("수박", "수바")
    assert c["ops"][-1]["type"] == "del"

def test_no_heard_is_unsure():
    c = compare("사과", None)
    assert c["diffRatio"] is None and all(o["type"] == "unsure" for o in c["ops"])

def test_weak_h_allowed():
    c = compare("오후", "오우")
    assert not any(o["type"] in ("sub", "del", "ins") for o in c["ops"])
