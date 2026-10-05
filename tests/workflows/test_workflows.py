"""GitHub Actions workflows must be valid YAML with at least one job."""

import pytest
import yaml

from asumisvalinta.config import REPO_ROOT

WORKFLOWS = sorted((REPO_ROOT / ".github" / "workflows").glob("*.yml"))


@pytest.mark.parametrize("path", WORKFLOWS, ids=lambda path: path.name)
def test_workflow_is_valid(path):
    workflow = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert workflow["name"]
    assert workflow["jobs"]
    for job in workflow["jobs"].values():
        assert job.get("steps") or job.get("uses"), f"{path.name}: a job has no steps"


def _actions() -> list[str]:
    references = set()
    for path in WORKFLOWS:
        for job in yaml.safe_load(path.read_text(encoding="utf-8"))["jobs"].values():
            references |= {step["uses"] for step in job.get("steps", []) if "uses" in step}
    return sorted(references)


@pytest.mark.live
@pytest.mark.parametrize("reference", _actions())
def test_action_version_exists(reference):
    import urllib.error
    import urllib.request

    repository, version = reference.split("@")
    kind = "commits" if len(version) == 40 else "git/ref/tags"
    url = f"https://api.github.com/repos/{repository}/{kind}/{version}"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            assert response.status == 200
    except urllib.error.HTTPError as error:
        pytest.fail(f"{reference} does not exist (HTTP {error.code})")
