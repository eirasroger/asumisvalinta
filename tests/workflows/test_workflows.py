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
        assert job.get("steps"), f"{path.name}: a job has no steps"
