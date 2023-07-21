FROM --platform=$BUILDPLATFORM golang:1.20

# install "normal" stuff

ARG NODEVERSION
ARG ARCH

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
    openjdk-17-jdk-headless \
    openjdk-17-jre-headless \
    python3 \
    python3-pip \
    python-is-python3 \
    apt-transport-https \
    curl \
    gnupg \
    -yqq \
    nodejs \
    npm \
    elixir \
    composer \
    jq \
    faketime


# install aws cli
ADD .circleci/awscli-publickey.pub awscli-publickey.pub
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$ARCH.zip" -o "awscliv2.zip"
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$ARCH.zip.sig" -o "awscliv2.sig"
RUN gpg --import awscli-publickey.pub
RUN gpg --verify awscliv2.sig awscliv2.zip
RUN unzip awscliv2.zip
RUN sudo ./aws/install
RUN rm -rf "awscli*"

# install swift cli
RUN wget https://download.swift.org/swift-5.8.1-release/amazonlinux2/swift-5.8.1-RELEASE/swift-5.8.1-RELEASE-amazonlinux2.tar.gz
RUN tar zxf swift-5.8.1-RELEASE-amazonlinux2.tar.gz

# install scala
RUN echo "deb https://repo.scala-sbt.org/scalasbt/debian all main" | tee /etc/apt/sources.list.d/sbt.list
RUN echo "deb https://repo.scala-sbt.org/scalasbt/debian /" | tee /etc/apt/sources.list.d/sbt_old.list
RUN curl -sL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x2EE0EA64E40A89B84B2DF73499E82A75642AC823" | gpg --no-default-keyring --keyring gnupg-ring:/etc/apt/trusted.gpg.d/scalasbt-release.gpg --import
RUN chmod 644 /etc/apt/trusted.gpg.d/scalasbt-release.gpg
RUN apt-get update
RUN apt-get install sbt
RUN apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/

ENV PATH=/go/swift-5.8.1-RELEASE-amazonlinux2/usr/bin:/usr/local/bin/:$PATH

RUN useradd circleci --create-home
RUN echo "circleci ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
USER circleci

WORKDIR /
ENTRYPOINT [""]