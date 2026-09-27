from pathlib import Path

from tools.prepare_static_site import prepare_site


ROOT = Path(__file__).parents[1]


def test_static_site_copies_only_the_shared_member_domain_runtime(tmp_path):
    destination = tmp_path / "site"
    prepare_site(ROOT, destination, "abcdef123456")

    deployed_domain = destination / "js" / "member" / "member-domain.mjs"
    assert deployed_domain.is_file()
    assert deployed_domain.read_bytes() == (ROOT / "supabase" / "functions" / "_shared" / "member-domain.mjs").read_bytes()
    assert not (destination / "supabase").exists()
    assert not (destination / "js" / "member" / "staff-auth.mjs").exists()
