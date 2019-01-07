FROM node:8-slim

MAINTAINER Snyk Ltd

# Install python
RUN apt-get update && \
    apt-get install -y python3 python3-dev python3-pip libssl-dev
RUN pip3 install pip pipenv virtualenv -U
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN ln -s /usr/bin/pip3 /usr/bin/pip

# Install snyk cli
RUN npm install --global snyk snyk-to-html && \
    apt-get update && \
    apt-get install -y jq

RUN chmod -R a+wrx /home/node
WORKDIR /home/node
ENV HOME /home/node

# The path at which the project is mounted (-v runtime arg)
ENV PROJECT_PATH /project

ADD docker-python-entrypoint.sh .
ADD docker-entrypoint.sh .
ADD snyk_report.css .

ENTRYPOINT ["./docker-python-entrypoint.sh"]

# Default command is `snyk test`
# Override with `docker run ... snyk/snyk-cli <command> <args>`
CMD ["test"]

