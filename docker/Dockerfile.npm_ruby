FROM node:8-slim

MAINTAINER Snyk Ltd

# Install snyk cli
RUN npm install --global snyk snyk-to-html && \
    apt-get update && \
    apt-get install -y jq

RUN chmod -R a+wrx /home/node
WORKDIR /home/node
ENV HOME /home/node

# The path at which the project is mounted (-v runtime arg)
ENV PROJECT_PATH /project

ADD docker-entrypoint.sh .
ADD snyk_report.css .

ENTRYPOINT ["./docker-entrypoint.sh"]

# Default command is `snyk test`
# Override with `docker run ... snyk/snyk-cli <command> <args>`
CMD ["test"]

