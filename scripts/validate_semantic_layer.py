"""Validate the semantic manifest built by `dbt parse` and fail on any error or warning.

Usage: uv run python scripts/validate_semantic_layer.py
"""

import json
import sys

from metricflow_semantic_interfaces.implementations.semantic_manifest import (
    PydanticSemanticManifest,
)
from metricflow_semantic_interfaces.validations.semantic_manifest_validator import (
    SemanticManifestValidator,
)

from asumisvalinta.semantic.client import DBT_PROJECT_DIR


def main() -> int:
    manifest_path = DBT_PROJECT_DIR / "target" / "semantic_manifest.json"
    if not manifest_path.exists():
        print(f"Missing {manifest_path}; run dbt parse first.")
        return 1
    manifest = PydanticSemanticManifest.parse_obj(json.loads(manifest_path.read_text("utf-8")))
    result = SemanticManifestValidator().validate_semantic_manifest(manifest)
    issues = [*result.errors, *result.future_errors, *result.warnings]
    for issue in issues:
        print(f"- {issue.message}")
    print(
        f"{len(manifest.semantic_models)} semantic models, {len(manifest.metrics)} metrics, "
        f"{len(issues)} issues"
    )
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
