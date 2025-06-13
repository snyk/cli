# When upgrading golang, make sure to update the docker executors that use snyklabs/cli-build in .circleci/config.yml
FROM golang:1.24-bullseye

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
    python3 \
    python3-pip \
    python-is-python3 \
    python3-requests \
    python3-yaml \
    pipenv \
    apt-transport-https \
    curl \
    gnupg \
    -yqq \
    elixir \
    composer \
    jq \
    faketime \
    zip \
    cmake \
    nodejs=$(apt-cache policy nodejs | grep nodesource | xargs | cut -d " " -f2)
RUN node -v
RUN apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/

# install aws cli
COPY .circleci/awscli-publickey.pub awscli-publickey.pub
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
COPY scripts/ scripts/
RUN mkdir -p /target/global-logging
RUN chown -R circleci scripts /target && chmod 770 scripts/*

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

WORKDIR /
ENTRYPOINT [""]
