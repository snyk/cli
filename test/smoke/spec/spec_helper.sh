#shellcheck shell=sh
set -e

print_snyk_config() {
  snyk config
}

snyk_login() {
  snyk auth "${SMOKE_TESTS_SNYK_TOKEN}" > /dev/null 2>&1
}

snyk_logout() {
  snyk config clear > /dev/null 2>&1
}

verify_login_url() {
  # https://snyk.io/login?token=uuid-token&utm_medium=cli&utm_source=cli&utm_campaign=cli&os=darwin&docker=false
  echo "$1" | grep https | grep -E "^https://(dev\.)?(test\.)?snyk\.io/login\?token=[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}\&.*$"
}

# Consume stdout and checks validates whether it's a valid JSON
check_valid_json() {
  printf %s "$1" | jq . > /dev/null
  echo $?
}

# These 2 commands should run in succession, some CLI functionality uses isCI detection
disable_is_ci_flags() {
  # save original value and unset
  if [ -n "${CI}" ]; then CI_BACKUP_VALUE=$CI; unset CI; fi
  if [ -n "${CIRCLECI}" ]; then CIRCLECI_BACKUP_VALUE=$CIRCLECI; unset CIRCLECI; fi
}
restore_is_ci_flags() {
  # recover the original value
  if [ -n "${CI}" ]; then CI=$CI_BACKUP_VALUE; unset CI_BACKUP_VALUE; fi
  if [ -n "${CIRCLECI}" ]; then CIRCLECI=$CIRCLECI_BACKUP_VALUE; unset CIRCLECI_BACKUP_VALUE; fi
}
