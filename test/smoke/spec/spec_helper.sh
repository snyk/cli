#shellcheck shell=sh
# set -eu

print_snyk_config() {
  snyk config
}

snyk_login() {
  snyk auth "${SMOKE_TESTS_SNYK_TOKEN}"
}
