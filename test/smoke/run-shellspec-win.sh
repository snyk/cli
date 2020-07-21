echo "run-shellscript-win.sh"

export EXPECTED_SNYK_VERSION=$(snyk --version)

/c/Users/runneradmin/.local/bin/shellspec -f d
