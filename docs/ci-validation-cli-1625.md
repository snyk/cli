# CLI-1625 — lightweight pipeline validation

Temporary doc-only change to verify that md-only PRs run `secrets-scan` only
(`continue_config_light.yml`) once [#6974](https://github.com/snyk/cli/pull/6974) is on `main`.

**After #6974 merges:** rebase this branch onto `main` and push to re-run CI.

**Expected:** CircleCI `setup` → `test_and_release` with `secrets-scan` only (no builds/tests).

Delete this file when validation is done.
