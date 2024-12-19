FROM shellspec/shellspec:latest

COPY ./smoke/ /snyk/smoke/
COPY ./fixtures/ /snyk/fixtures/

RUN shellspec --version
RUN apk add curl jq libgcc libstdc++

# Install Gradle
RUN apk update && \
    apk add openjdk11 && \
    wget https://services.gradle.org/distributions/gradle-7.2-bin.zip && \
    unzip gradle-7.2-bin.zip && \
    mv gradle-7.2 /opt/gradle && \
    ln -s /opt/gradle/bin/gradle /usr/bin/gradle && \
    gradle -v

WORKDIR /snyk/smoke/

ENTRYPOINT [ "./alpine/entrypoint.sh" ]
