FROM node:18

COPY ./smoke/ /snyk/smoke/
COPY ./fixtures/ /snyk/fixtures/

RUN apt-get update && apt-get install -y curl jq

# Install Gradle
RUN apt-get install -y wget unzip \
    && wget https://services.gradle.org/distributions/gradle-7.2-bin.zip -P /tmp \
    && unzip -d /opt/gradle /tmp/gradle-7.2-bin.zip \
    && ln -s /opt/gradle/gradle-7.2/bin/gradle /usr/bin/gradle

RUN /snyk/smoke/install-shellspec.sh --yes
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /snyk/smoke/

ENTRYPOINT [ "./docker-root/entrypoint.sh" ]
