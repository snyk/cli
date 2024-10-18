curl -Lo ./snyk-cli.exe 'https://downloads.snyk.io/cli/latest/snyk-win.exe'
./snyk-cli.exe --version
chmod -R +x ./snyk-cli
mv ./snyk-cli.exe "/bin/snyk.exe"
snyk --version
