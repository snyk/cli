FROM openjdk:8-jdk-slim

MAINTAINER Snyk Ltd

RUN mkdir /home/node
RUN chmod -R a+wrx /home/node
WORKDIR /home/node

#Install gradle
RUN apt-get update
RUN apt-get install -y curl
RUN curl -L https://services.gradle.org/distributions/gradle-2.8-bin.zip -o gradle-2.8-bin.zip && \
  apt-get install -y unzip && \
  unzip gradle-2.8-bin.zip -d /home/node/

#Install node
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

# Install snyk cli
RUN npm install --global snyk snyk-to-html && \
    apt-get update && \
    apt-get install -y jq

ENV HOME /home/node
ENV M2 /home/node/.m2
ENV GRADLE_HOME=/home/node/gradle-2.8
ENV PATH=$PATH:$GRADLE_HOME/bin

# The path at which the project is mounted (-v runtime arg)
ENV PROJECT_PATH /project

ADD docker-entrypoint.sh .
ADD snyk_report.css .

ENTRYPOINT ["./docker-entrypoint.sh"]

# Default command is `snyk test`
# Override with `docker run ... snyk/snyk-cli <command> <args>`
CMD ["test"]
