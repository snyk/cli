# When upgrading golang, make sure to update the docker executors that use snyklabs/cli-build-private in .circleci/config.yml
# Using debian:bullseye instead of golang:X-bookworm to avoid glibc compatibility issues
FROM debian:bullseye

ARG NODEVERSION
ARG ARCH
ARG GOVERSION

# Install minimal dependencies for Go download
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Go from official tarball
# ARCH is x86_64 or aarch64 (for AWS CLI), but Go uses amd64/arm64
RUN GOARCH=$(echo "$ARCH" | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/') \
    && curl -fsSL "https://go.dev/dl/go${GOVERSION}.linux-${GOARCH}.tar.gz" -o /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

ENV GOPATH=/go
ENV PATH=/usr/local/go/bin:$GOPATH/bin:$PATH
RUN mkdir -p "$GOPATH/src" "$GOPATH/bin" && chmod -R 1777 "$GOPATH"

# Setup Node.js repository
RUN echo "Required Node version: $NODEVERSION"
RUN curl -sL https://deb.nodesource.com/setup_$(echo $NODEVERSION | cut -f1 -d '.').x | bash -

# Install all dependencies in a single apt-get to reduce layers and avoid duplication
# Includes: build tools, CGO deps, Swift deps, and general utilities
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    apt-transport-https \
    binutils-gold \
    cmake \
    composer \
    elixir \
    faketime \
    g++ \
    gcc \
    git \
    gnupg \
    jq \
    libc6-dev \
    libcurl4-openssl-dev \
    libedit-dev \
    libicu-dev \
    libncurses-dev \
    libpython3-dev \
    libsqlite3-dev \
    libxml2-dev \
    make \
    maven \
    musl-tools \
    nodejs=$(apt-cache policy nodejs | grep nodesource | xargs | cut -d " " -f2) \
    pipenv \
    pkg-config \
    python-is-python3 \
    python3 \
    python3-pip \
    python3-requests \
    python3-yaml \
    sudo \
    tzdata \
    uuid-dev \
    vim \
    zip \
    && apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/lists/*
RUN node -v

# install aws cli
COPY .circleci/awscli-publickey.pub awscli-publickey.pub
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$ARCH.zip" -o "awscliv2.zip"
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$ARCH.zip.sig" -o "awscliv2.sig"
RUN gpg --import awscli-publickey.pub
RUN gpg --verify awscliv2.sig awscliv2.zip
RUN unzip -q awscliv2.zip
RUN sudo ./aws/install
RUN rm -rf "awscli*"

RUN useradd circleci --create-home
RUN echo "circleci ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# install snyk
COPY scripts/ scripts/
RUN mkdir -p /target/global-logging
RUN chown -R circleci scripts /target && chmod 770 scripts/*

# Install Swift (deps already installed above)
RUN scripts/install-swift.sh $ARCH
ENV PATH=/usr/local/swift/usr/bin:$PATH

# install openssl3
RUN scripts/install_openssl3_fips.sh
ENV PATH=/usr/local/bin/:$PATH
ENV LD_LIBRARY_PATH=/usr/local/lib/

USER circleci
# install java & scala
RUN curl -s "https://get.sdkman.io" | bash
RUN scripts/jvm-install.sh
ENV PATH=/home/circleci/.sdkman/candidates/gradle/current/bin:/home/circleci/.sdkman/candidates/scala/current/bin:/home/circleci/.sdkman/candidates/sbt/current/bin:/home/circleci/.sdkman/candidates/java/current/bin:$PATH

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

WORKDIR /
ENTRYPOINT [""]
