# https://github.com/microsoft/vscode-dev-containers/tree/master/containers/javascript-node
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:0-14

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends jq vim

RUN su node -c "curl -fsSL https://git.io/shellspec | sh -s -- --yes"
RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm alias default system"
RUN su node -c "npm install -g npm@7"
