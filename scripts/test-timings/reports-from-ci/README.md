# CI JUnit reports (per parallel shard)

Each CI platform (linux, macOS, Windows) has its own weight file so shard
balance accounts for tests that are skipped or run at different speeds on each
platform.

## Quick workflow (per platform)

```bash
# 1. Download reports (auto-creates urls-<platform>.txt from the example template
#    if it doesn't exist yet — edit it with fresh CircleCI artifact URLs first)
npm run download:test-reports:linux
npm run download:test-reports:macos
npm run download:test-reports:windows

# 2. Generate platform-specific timing files
npm run gen:test-timings:linux
npm run gen:test-timings:macos
npm run gen:test-timings:windows
```

This produces `test/jest/test-timings-linux.json`, `test-timings-macos.json`,
and `test-timings-windows.json`. CI selects the right file via the
`TEST_SNYK_TIMINGS_PLATFORM` environment variable set on each acceptance job.

Alpine jobs use the `linux` timings (alpine has no meaningful platform-specific
test skips).

## Layout

```
scripts/test-timings/
  gen-test-timings.js              # builds test-timings JSON from JUnit XML
  download-ci-junit-shards.sh      # fetches JUnit artifacts from CircleCI
  reports-from-ci/
    README.md                      # (this file)
    linux/shard-0/junit.xml        # --platform linux
    linux/shard-1/junit.xml
    ...
    macos/shard-0/junit.xml        # --platform macos
    windows/shard-0/junit.xml      # --platform windows
```

The generator scans **all** `*.xml` files under the given tree and merges them (each shard covers different tests).

## Download from CircleCI

Signed S3 links expire quickly (~60s). Use fresh links each time.

1. In the job's **Artifacts** tab, open each parallel run's `test/reports/junit.xml`.
2. Copy the download URL for each shard.
3. Paste the URLs into `urls-<platform>.txt` (one URL per line, shard order). The download script auto-creates this file from the `.example` template on first run.
4. Run:

```bash
./scripts/test-timings/download-ci-junit-shards.sh --platform linux
./scripts/test-timings/download-ci-junit-shards.sh --platform macos
./scripts/test-timings/download-ci-junit-shards.sh --platform windows
```

Or download manually into `<platform>/shard-N/junit.xml`.

## Notes

- `jest-junit` must emit `file="..."` on each `<testsuite>` (`addFileAttribute: true` in `package.json`). Older CI runs without that attribute use a describe-name fallback which is less reliable.
- Downloaded reports are gitignored (via the local `.gitignore`); only this README and `*.example` files are committed.
- For highly variable tests (e.g. `snyk-code-user-journey.spec.ts`), manually adjust the value in the timing JSON files to a representative estimate rather than relying on a single observation.
