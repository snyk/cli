FROM node:12.22.8-stretch

COPY ./smoke/ /snyk/smoke/
COPY ./fixtures/ /snyk/fixtures/

RUN apt-get update && apt-get install -y curl jq
RUN curl -fsSL https://git.io/shellspec | sh -s -- --yes
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /snyk/smoke/

ENTRYPOINT [ "./docker-root/entrypoint.sh" ]
