from copy import deepcopy
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_content_review, validate_repository

ROOT = Path(__file__).parents[1]
DATA_FILE = ROOT / 'data' / 'system-data.js'


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def test_current_content_review_contract_passes_with_repository_anatomy():
    assert validate_repository() == []


def test_content_review_contract_covers_formal_domains_and_minimum_fields():
    data = payload()
    contract = data['contentReview']
    assert set(contract['requiredFields']) == {
        'source', 'evidenceLevel', 'reviewStatus', 'reviewedAt', 'reviewerNote'
    }
    assert set(contract['requiredDomains']) >= {
        'actions', 'sessions', 'bodyFamilies', 'conditioningFamilies',
        'conditioningProtocols', 'hyroxStations', 'anatomy'
    }
    assert validate_content_review(data) == []


def test_content_review_rejects_invalid_metadata_and_unknown_override():
    data = payload()
    data['contentReview']['domainDefaults']['actions']['reviewStatus'] = 'unknown'
    data['contentReview']['overrides']['actions'] = {
        'UNKNOWN_ACTION': {
            'source': 'test',
            'evidenceLevel': 'not_assessed',
            'reviewStatus': 'pending',
            'reviewedAt': None,
            'reviewerNote': 'test',
        }
    }
    errors = validate_content_review(data)
    text = '\n'.join(errors)
    assert 'contentReview.domainDefaults.actions.reviewStatus' in text
    assert 'contentReview.overrides.actions.UNKNOWN_ACTION' in text
