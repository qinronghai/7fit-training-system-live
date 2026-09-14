import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_runtime():
    text=(ROOT/"data/system-data.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$",text,re.S).group(1))


def test_benchmark_history_contract_is_versioned_and_explainable():
    data=load_runtime()
    c=data["hyroxBenchmarkResultContract"]
    assert c["benchmarkHistorySchemaVersion"] == 1
    assert c["legacyPolicy"] == "DISPLAY_ONLY_NOT_COMPARABLE"
    assert c["abilityGroups"]["ENGINE"]["stationIds"] == ["H1","H5"]
    assert c["abilityGroups"]["SLED"]["stationIds"] == ["H2","H3"]
    assert c["abilityGroups"]["LOCOMOTION"]["stationIds"] == ["H4","H6","H7"]
    assert c["abilityGroups"]["BALL"]["stationIds"] == ["H8"]
    assert all(c["abilityGroups"][x]["coachHint"] for x in ["ENGINE","SLED","LOCOMOTION","BALL"])


def test_history_is_independent_from_generic_v15_state():
    state=(ROOT/"js/state.js").read_text(encoding="utf-8")
    history=(ROOT/"js/hyrox-benchmark-history.js").read_text(encoding="utf-8")
    assert "7fit-hyrox-benchmark-history" in history
    assert "7fit-hyrox-benchmark-history" not in state
    assert "localStorage" in history
    assert "V15State" not in history
