import json
from copy import deepcopy
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
DATA_FILE = ROOT / "data" / "system-data.js"
HYROX_SOURCE = ROOT / "data" / "src" / "hyrox.json"
HYROX_SCHEMA = ROOT / "schemas" / "v14.8" / "hyrox.schema.json"

STATIONS = ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"]
HYROX_KEYS = (
    "hyroxSessionTypeIds",
    "hyroxSessionTypes",
    "hyroxStationIds",
    "hyroxStations",
    "hyroxVenuePolicy",
    "hyroxCapacityGroupIds",
    "hyroxCapacityGroups",
    "hyroxLevelPolicies",
    "hyroxLoadPolicies",
    "hyroxSledCalibrationPolicy",
    "hyroxBenchmarkProtocolIds",
    "hyroxBenchmarkProtocols",
    "hyroxBenchmarkResultContract",
    "hyroxScalingPolicy",
)


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def test_hyrox_source_and_schema_exist_and_runtime_validates():
    assert HYROX_SOURCE.is_file()
    assert HYROX_SCHEMA.is_file()
    source = json.loads(HYROX_SOURCE.read_text(encoding="utf-8"))
    assert set(source) == set(HYROX_KEYS)
    data = payload()
    assert validate_payload(data) == []


def test_hyrox_stays_future_and_does_not_activate_capabilities():
    data = payload()
    assert data["templateIds"] == ["f111", "body", "conditioning", "hyrox", "posture"]
    record = data["templateRegistry"]["hyrox"]
    assert record["engine"] == "hyrox"
    assert record["status"] == "FUTURE"
    assert record["routeBase"] == "#/coach/hyrox"
    assert not any(record["capabilities"].values())


def test_hyrox_fixed_station_identity_and_no_run_station():
    data = payload()
    assert data["hyroxStationIds"] == STATIONS
    stations = data["hyroxStations"]
    assert list(stations) == STATIONS
    assert [stations[s]["canonicalOrder"] for s in STATIONS] == list(range(1, 9))
    assert all(stations[s]["benchmarkEligible"] is True for s in STATIONS)
    assert data["hyroxVenuePolicy"]["runStationEnabled"] is False
    station_text = json.dumps(stations, ensure_ascii=False).lower()
    assert '"run"' not in station_text
    assert "跑步" not in station_text


def test_turf_length_is_single_source_of_truth():
    data = payload()
    assert data["hyroxVenuePolicy"]["turfLengthMeters"] == 8
    for level in ["L1", "L2", "L3", "L4"]:
        work = data["hyroxLevelPolicies"][level]["stationWork"]
        for station_id in ["H2", "H3", "H4", "H6", "H7"]:
            assert work[station_id]["metric"] == "TURF_LENGTH"
            assert "meters" not in work[station_id]
    for protocol in data["hyroxBenchmarkProtocols"].values():
        for station_id in ["H2", "H3", "H4", "H6", "H7"]:
            assert protocol["work"][station_id]["metric"] == "TURF_LENGTH"
            assert "meters" not in protocol["work"][station_id]


def test_volume_and_load_are_separate_contracts():
    data = payload()
    assert set(data["hyroxLevelPolicies"]) == {"L1", "L2", "L3", "L4"}
    assert set(data["hyroxLoadPolicies"]) == set(STATIONS)
    assert data["hyroxLoadPolicies"]["H2"] == {
        "type": "SLED_CALIBRATION",
        "profileId": "SLED_PUSH",
    }
    assert data["hyroxLoadPolicies"]["H3"] == {
        "type": "SLED_CALIBRATION",
        "profileId": "SLED_PULL",
    }
    assert data["hyroxSledCalibrationPolicy"]["requiredBeforeComparableBenchmark"] is True


def test_benchmark_protocols_are_fixed_and_b3_matches_approved_standard():
    data = payload()
    assert data["hyroxBenchmarkProtocolIds"] == ["B1", "B2", "B3", "B4"]
    for protocol_id in data["hyroxBenchmarkProtocolIds"]:
        protocol = data["hyroxBenchmarkProtocols"][protocol_id]
        assert protocol["orderedStations"] == STATIONS
        assert set(protocol["work"]) == set(STATIONS)
        assert protocol["comparisonStrategy"] == "EXACT_PROTOCOL_WORK_LOAD_CALIBRATION_AND_SCALING"

    b3 = data["hyroxBenchmarkProtocols"]["B3"]
    assert b3["level"] == "L3"
    assert b3["work"] == {
        "H1": {"metric": "METER", "value": 500},
        "H2": {"metric": "TURF_LENGTH", "value": 6},
        "H3": {"metric": "TURF_LENGTH", "value": 6},
        "H4": {"metric": "TURF_LENGTH", "value": 4},
        "H5": {"metric": "METER", "value": 500},
        "H6": {"metric": "TURF_LENGTH", "value": 8},
        "H7": {"metric": "TURF_LENGTH", "value": 4},
        "H8": {"metric": "REP", "value": 50},
    }


def test_benchmark_result_contract_reserves_comparison_fields():
    data = payload()
    contract = data["hyroxBenchmarkResultContract"]
    assert contract["schemaVersion"] == 1
    assert {"protocolId", "protocolVersion", "totalTimeMs", "stationResults", "comparisonKey"} <= set(contract["requiredFields"])
    assert contract["validityStatuses"] == [
        "VALID_COMPARABLE",
        "VALID_NEW_BASELINE",
        "SCALED",
        "INCOMPLETE",
        "INVALID_PROTOCOL",
    ]


def test_validator_rejects_turf_length_drift():
    data = payload()
    data["hyroxVenuePolicy"]["turfLengthMeters"] = 10
    errors = validate_payload(data)
    assert any("hyrox.hyroxVenuePolicy.turfLengthMeters" in error for error in errors)


def test_validator_rejects_missing_station():
    data = payload()
    del data["hyroxStations"]["H8"]
    errors = validate_payload(data)
    assert any("hyrox.hyroxStations" in error and "H8" in error for error in errors)
