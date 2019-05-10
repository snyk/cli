FROM openjdk:8-jdk-slim

MAINTAINER Snyk Ltd

#Install maven
RUN apt-get update
RUN apt-get install -y curl
RUN curl -L -o apache-maven-3.5.4-bin.tar.gz https://www-eu.apache.org/dist/maven/maven-3/3.5.4/binaries/apache-maven-3.5.4-bin.tar.gz
RUN tar -xvzf apache-maven-3.5.4-bin.tar.gz
RUN rm -f apache-maven-3.5.4-bin.tar.gz

#Install node
RUN mkdir /home/node
RUN chmod -R a+wrx /home/node
WORKDIR /home/node
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

# Install snyk cli
RUN npm install --global snyk snyk-to-html && \
    apt-get update && \
    apt-get install -y jq

ENV HOME /home/node
ENV M2 /home/node/.m2
ENV PATH /apache-maven-3.5.4/bin:$PATH

# The path at which the project is mounted (-v runtime arg)
ENV PROJECT_PATH /project

ADD docker-entrypoint.sh .
ADD snyk_report.css .

ENTRYPOINT ["./docker-entrypoint.sh"]

# Default command is `snyk test`
# Override with `docker run ... snyk/snyk-cli <command> <args>`
CMD ["test"]
