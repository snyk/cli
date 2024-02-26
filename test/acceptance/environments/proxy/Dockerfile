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

FROM --platform=$TARGETPLATFORM golang:1.20-bullseye

# install "normal" stuff

ARG NODEVERSION
ARG ARCH

RUN echo "Required Node version: $NODEVERSION"
RUN curl -sL https://deb.nodesource.com/setup_$(echo $NODEVERSION | cut -f1 -d '.').x | bash -
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    sudo \
    vim \
    make \
    maven \
    gradle \
    python3 \
    python3-pip \
    python-is-python3 \
    python3-requests \
    python3-yaml \
    pipenv \
    apt-transport-https \
    curl \
    elixir \
    composer \
    squid \
    zip \
    traceroute \
    net-tools \
    iptables \
    nodejs=$(apt-cache policy nodejs | grep nodesource | xargs | cut -d " " -f2)
RUN node -v
RUN apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/

RUN update-alternatives --set iptables /usr/sbin/iptables-legacy

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

# install java & scala
RUN curl -s "https://get.sdkman.io" | bash
RUN /app/scripts/jvm-install.sh
ENV PATH=/home/circleci/.sdkman/candidates/scala/current/bin:/home/circleci/.sdkman/candidates/sbt/current/bin:/home/circleci/.sdkman/candidates/java/current/bin:$PATH

# install dotnet
RUN curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 8.0
ENV PATH=/home/circleci/.dotnet:$PATH
ENV TEMP=/tmp
ENV TMP=$TEMP
ENV TMPDIR=$TEMP

# install rust and convco
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
RUN ~/.cargo/bin/cargo install convco
ENV PATH=/home/circleci/.cargo/bin:$PATH

ENV http_proxy="http://localhost:3128"
ENV https_proxy="http://localhost:3128"
ENV no_proxy "localhost,127.0.0.1"
RUN env
WORKDIR /app
ENTRYPOINT ["/bin/entrypoint.sh"]
