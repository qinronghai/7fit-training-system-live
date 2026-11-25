from pathlib import Path

from tools.prepare_static_site import prepare_site


ROOT = Path(__file__).parents[1]


def test_static_site_ships_demo_runtime_without_backend_credentials(tmp_path):
    destination = tmp_path / "site"
    prepare_site(ROOT, destination, "abcdef123456")

    deployed_domain = destination / "js" / "member" / "member-domain.mjs"
    assert deployed_domain.is_file()
    assert deployed_domain.read_bytes() == (ROOT / "supabase" / "functions" / "_shared" / "member-domain.mjs").read_bytes()
    assert not (destination / "supabase").exists()
    assert not (destination / "js" / "member" / "staff-auth.mjs").exists()

    demo_runtime = destination / "js" / "member" / "demo-runtime"
    assert (demo_runtime / "service.mjs").read_bytes() == (ROOT / "supabase" / "functions" / "member-api" / "service.mjs").read_bytes()
    assert (demo_runtime / "../_shared/member-domain.mjs").read_bytes() == deployed_domain.read_bytes()
    assert not (demo_runtime / "index.ts").exists()
