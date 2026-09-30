"""Source files must never be hidden by .gitignore, or CI and deployments would miss them."""

import shutil
import subprocess

import pytest

from asumisvalinta.config import REPO_ROOT

SOURCE_FOLDERS = ["src", "tests", "scripts", "content", "fixtures", "dbt", "web/src", "web/scripts"]
GENERATED = ("__pycache__", "dbt/target/", "dbt/logs/", "dbt/.user.yml")


@pytest.mark.skipif(shutil.which("git") is None, reason="git is not installed")
def test_no_source_file_is_ignored():
    output = subprocess.run(
        ["git", "ls-files", "--others", "--ignored", "--exclude-standard", "--", *SOURCE_FOLDERS],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    hidden = [path for path in output.splitlines() if not any(part in path for part in GENERATED)]
    assert hidden == []
