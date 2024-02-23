# Copyright 2022-2023 Snyk Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# FROM node:gallium
FROM ubuntu:24.04
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y \
    sudo \
    git \
    squid \
    curl \
    traceroute \
    net-tools \
    iptables \
    vim \
    make \
    golang \
    zip \
    nodejs \
    npm \
    openjdk-11-jdk \
    python3-pip \
    maven

# Install Gradle
RUN curl -L https://services.gradle.org/distributions/gradle-8.6-bin.zip -o gradle.zip
RUN unzip gradle.zip
RUN mv gradle-8.6 /usr/local/gradle
ENV GRADLE_HOME=/usr/local/gradle
ENV PATH=$PATH:$GRADLE_HOME/bin

RUN update-alternatives --set iptables /usr/sbin/iptables-legacy
RUN apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/

RUN useradd snyk --create-home
RUN echo "snyk ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN mkdir -p /app
COPY . /app

RUN rm -rf /app/build /app/.bin
RUN cp /app/test/acceptance/environments/proxy/entrypoint.sh /bin

RUN chmod +x /bin/entrypoint.sh
RUN chmod 777 /app && chown -R snyk /app

USER snyk
RUN cd /app && npm install
ENV http_proxy="http://localhost:3128"
ENV https_proxy="http://localhost:3128"
ENV no_proxy "localhost,127.0.0.1"
RUN env
WORKDIR /app
ENTRYPOINT ["/bin/entrypoint.sh"]
