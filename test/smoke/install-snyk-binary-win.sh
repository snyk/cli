echo "install-snyk-binary-win.sh"
snyk_cli_dl=$(curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/snyk/snyk/releases/latest | jq --raw-output '(.assets[])? | select(.name == "snyk-win.exe") | .browser_download_url')
echo "snyk_cli_dl: ${snyk_cli_dl}"
curl -Lo ./snyk-cli.exe $snyk_cli_dl
./snyk-cli.exe --version
chmod -R +x ./snyk-cli
mv ./snyk-cli.exe "/bin/snyk.exe"
snyk --version
