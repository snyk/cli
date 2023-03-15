FROM --platform=$BUILDPLATFORM golang:1.20

# install "normal" stuff

ARG NODEVERSION
RUN echo "Node version: $NODEVERSION"
RUN apt-get update
RUN curl -sL https://deb.nodesource.com/setup_$NODEVERSION.x | bash -
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    sudo \
    musl-tools \
    git \
    vim \
    make \
    maven \
    gradle \
    openjdk-11-jdk-headless \
    openjdk-11-jre-headless \
    python3 \
    python3-pip \
    python-is-python3 \
    apt-transport-https \
    curl \
    gnupg \
    -yqq \
    nodejs \
    elixir \
    composer \
    jq \
    cmake \
    libssl-dev \
    libcurl4-openssl-dev \
    faketime

# install aws cli
RUN pip install awscli --upgrade --user

# install scala
RUN echo "deb https://repo.scala-sbt.org/scalasbt/debian all main" | tee /etc/apt/sources.list.d/sbt.list
RUN echo "deb https://repo.scala-sbt.org/scalasbt/debian /" | tee /etc/apt/sources.list.d/sbt_old.list
RUN curl -sL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x2EE0EA64E40A89B84B2DF73499E82A75642AC823" | gpg --no-default-keyring --keyring gnupg-ring:/etc/apt/trusted.gpg.d/scalasbt-release.gpg --import
RUN chmod 644 /etc/apt/trusted.gpg.d/scalasbt-release.gpg
RUN apt-get update
RUN apt-get install sbt
RUN apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/

RUN curl -sSL https://github.com/mtrojnar/osslsigncode/releases/download/2.5/osslsigncode-2.5.tar.gz > osslsigncode-2.5.tar.gz && tar -xzf osslsigncode-2.5.tar.gz
RUN cd osslsigncode-2.5 && mkdir -p build && cd build && cmake -S .. && make install && cd .. && cd ..
RUN rm -rf osslsigncode-2.5*

ENV PATH=/usr/local/bin/:$PATH

# pre-install npm packages
ADD package.json /tmp/package.json
RUN cd /tmp && npm install -g
RUN rm /tmp/package.json

RUN useradd circleci --create-home
RUN echo "circleci ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
USER circleci

WORKDIR /
ENTRYPOINT [""]