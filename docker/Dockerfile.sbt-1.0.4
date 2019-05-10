FROM openjdk:8-jdk-slim

MAINTAINER Snyk Ltd

RUN mkdir /home/node
RUN chmod -R a+wrx /home/node
WORKDIR /home/node

#Install sbt
RUN apt-get update
RUN apt-get install -y curl
RUN echo "deb https://dl.bintray.com/sbt/debian /" | tee -a /etc/apt/sources.list.d/sbt.list && \
    apt-get install -y apt-transport-https && \
    curl -L -o sbt.deb https://dl.bintray.com/sbt/debian/sbt-1.0.4.deb && \
    dpkg -i sbt.deb

RUN echo "docker-user ALL=(ALL:ALL) NOPASSWD: ALL" >> /etc/sudoers  && \
    mkdir -p /root/.sbt/1.0/plugins  && \
    mkdir -p /home/node/.sbt/1.0/plugins  && \
    echo "addSbtPlugin(\"net.virtual-void\" % \"sbt-dependency-graph\" % \"0.9.0\")" >> /root/.sbt/1.0/plugins/plugins.sbt && \
    echo "addSbtPlugin(\"net.virtual-void\" % \"sbt-dependency-graph\" % \"0.9.0\")" >> /home/node/.sbt/1.0/plugins/plugins.sbt && \
    echo "addCommandAlias(\"dependency-tree\", \"dependencyTree\")" >> /root/.sbt/1.0/user.sbt && \
    echo "addCommandAlias(\"dependency-tree\", \"dependencyTree\")" >> /home/node/.sbt/1.0/user.sbt

#Install node
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

# Install snyk cli
RUN npm install --global snyk snyk-to-html && \
    apt-get update && \
    apt-get install -y jq

ENV HOME /home/node
ENV M2 /home/node/.m2

# The path at which the project is mounted (-v runtime arg)
ENV PROJECT_PATH /project

ADD docker-entrypoint.sh .
ADD snyk_report.css .

ENTRYPOINT ["./docker-entrypoint.sh"]

# Default command is `snyk test`
# Override with `docker run ... snyk/snyk-cli <command> <args>`
CMD ["test"]
