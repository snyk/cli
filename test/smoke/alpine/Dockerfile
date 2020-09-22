FROM shellspec/shellspec:latest

COPY ./smoke/ /snyk/smoke/
COPY ./fixtures/basic-npm/ /snyk/fixtures/basic-npm/
COPY ./fixtures/empty/ /snyk/fixtures/empty/
COPY ./fixtures/iac/ /snyk/fixtures/iac/ 

RUN shellspec --version
RUN apk add curl jq libgcc libstdc++

WORKDIR /snyk/smoke/

ENTRYPOINT [ "./alpine/entrypoint.sh" ]
