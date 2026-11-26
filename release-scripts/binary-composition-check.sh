#!/usr/bin/env bash
set -euo pipefail

BINARY_DIR="${BINARY_DIR:-binary-releases}"
SBOM_DIR="${SBOM_DIR:-${BINARY_DIR}/sbom}"
SNYK_BIN="${SNYK_BIN:-${BINARY_DIR}/snyk-linux}"

expected_node="$(tr -d '[:space:]' < .nvmrc)"
expected_node="${expected_node#v}"

mkdir -p "${SBOM_DIR}"
shopt -s nullglob
binaries=("${BINARY_DIR}"/snyk-*)
files=()
for b in "${binaries[@]}"; do
  case "$b" in
    *.sha256|*.tgz|*.asc|*.json|*.txt) ;;
    *) [ -f "$b" ] && files+=("$b") ;;
  esac
done

if [ "${#files[@]}" -eq 0 ]; then
  echo "No binaries found in ${BINARY_DIR}" >&2
  exit 1
fi

failed=0
rows=()
for f in "${files[@]}"; do
  name="$(basename "$f")"
  strs="$(strings -a "$f")"

  node_versions="$(grep -oE 'nodejs\.org/download/release/v[0-9]+\.[0-9]+\.[0-9]+/node-v[0-9]+\.[0-9]+\.[0-9]+\.tar\.gz' <<<"$strs" | grep -oE 'node-v[0-9]+\.[0-9]+\.[0-9]+' | sed 's/^node-v//' | sort -u || true)"
  openssl_versions="$(grep -oE '^OpenSSL [0-9]+\.[0-9]+\.[0-9]+' <<<"$strs" | awk '{print $2}' | sort -u || true)"

  if [ -z "$node_versions" ] || [ -z "$openssl_versions" ]; then
    echo "ERROR: ${name}: could not read Node.js/OpenSSL version (node='${node_versions}' openssl='${openssl_versions}')" >&2
    failed=1
    continue
  fi
  if [ "$(wc -l <<<"$node_versions")" -ne 1 ] || [ "$(wc -l <<<"$openssl_versions")" -ne 1 ]; then
    echo "ERROR: ${name}: more than one version found (node='${node_versions//$'\n'/,}' openssl='${openssl_versions//$'\n'/,}')" >&2
    failed=1
    continue
  fi

  echo "${name}: node ${node_versions}, openssl ${openssl_versions}"
  if [ "$node_versions" != "$expected_node" ]; then
    echo "ERROR: ${name}: embedded Node.js ${node_versions} does not match .nvmrc ${expected_node}" >&2
    failed=1
  fi
  rows+=("${name}|${node_versions}|${openssl_versions}")
done

jq -n --arg rows "$(printf '%s\n' "${rows[@]}")" '
  [$rows | split("\n")[] | select(length > 0) | split("|") | {binary: .[0], node: .[1], openssl: .[2]}]
' > "${SBOM_DIR}/embedded-runtime.json"

if [ "$failed" -ne 0 ]; then
  exit 1
fi

jq -n --argjson rt "$(cat "${SBOM_DIR}/embedded-runtime.json")" '
  ($rt | map(.node) | unique) as $nodes
  | ($rt | map(.openssl) | unique) as $ssl
  | {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      version: 1,
      metadata: {component: {type: "application", name: "snyk-cli-embedded-runtime", "bom-ref": "snyk-cli-embedded-runtime"}},
      components: (
        ($nodes | map({type: "library", name: "node", version: ., purl: ("pkg:generic/node@" + .), "bom-ref": ("pkg:generic/node@" + .)}))
        + ($ssl | map({type: "library", name: "openssl", version: ., purl: ("pkg:generic/openssl@" + .), "bom-ref": ("pkg:generic/openssl@" + .)}))
      )
    }
' > "${SBOM_DIR}/embedded-runtime.cdx.json"

echo "Wrote ${SBOM_DIR}/embedded-runtime.cdx.json"

if [ -z "${SNYK_TOKEN:-}" ]; then
  echo "SNYK_TOKEN not set, skipping snyk sbom test"
  exit 0
fi

"$SNYK_BIN" sbom test --experimental --file="${SBOM_DIR}/embedded-runtime.cdx.json" --severity-threshold=high
