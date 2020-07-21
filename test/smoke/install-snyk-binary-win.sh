echo "install-snyk-binary-win.sh"

export latest_version=$(curl -Is "https://github.com/snyk/snyk/releases/latest" | grep location | sed s#.*tag/##g | tr -d "\r")
echo "latest_version: ${latest_version}"
snyk_cli_dl="https://github.com/snyk/snyk/releases/download/${latest_version}/snyk-win.exe"
echo "snyk_cli_dl: ${snyk_cli_dl}"
curl -Lo ./snyk-cli.exe $snyk_cli_dl
./snyk-cli.exe --version
chmod -R +x ./snyk-cli
mv ./snyk-cli.exe "/bin/snyk.exe"
snyk --version
