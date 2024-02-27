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
    musl-tools \
    git \
    vim \
    make \
    maven \
    gradle \
    apt-transport-https \
    curl \
    gnupg \
    -yqq \
    elixir \
    composer \
    jq \
    faketime \
    zip \
    nodejs=$(apt-cache policy nodejs | grep nodesource | xargs | cut -d " " -f2) \
    # convco deps
    cmake \
    # python deps
    python3 \
    python3-pip \
    python-is-python3 \
    python3-requests \
    python3-yaml \
    pipenv \
    # proxy deps
    squid \
    traceroute \
    net-tools \
    iptables

RUN node -v
RUN apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/

# install aws cli
ADD .circleci/awscli-publickey.pub awscli-publickey.pub
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$ARCH.zip" -o "awscliv2.zip"
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$ARCH.zip.sig" -o "awscliv2.sig"
RUN gpg --import awscli-publickey.pub
RUN gpg --verify awscliv2.sig awscliv2.zip
RUN unzip awscliv2.zip
RUN sudo ./aws/install
RUN rm -rf "awscli*"

RUN useradd circleci --create-home
RUN echo "circleci ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# install snyk
RUN mkdir -p /app
RUN mkdir -p /target/global-logging
COPY . /app
RUN rm -rf /app/build /app/.bin
RUN cp /app/scripts/environments/proxy/entrypoint.sh /bin
RUN chmod +x /bin/entrypoint.sh
RUN chmod 777 /app && chown -R circleci /app

RUN /app/scripts/install-swift.sh $ARCH
ENV PATH=/usr/local/swift/usr/bin:$PATH

# install openssl3
RUN /app/scripts/install_openssl3_fips.sh /app/
ENV PATH=/usr/local/bin/:$PATH
ENV LD_LIBRARY_PATH=/usr/local/lib/

RUN update-alternatives --set iptables /usr/sbin/iptables-legacy
USER circleci

# install deps
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

# setup proxy
ENV http_proxy="http://localhost:3128"
ENV https_proxy="http://localhost:3128"
ENV no_proxy "localhost,127.0.0.1"
RUN env

WORKDIR /app
ENTRYPOINT ["/bin/entrypoint.sh"]
