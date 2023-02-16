# Copyright 2022 Snyk Ltd.
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

# Use arm64v8/node:gallium for M1 Macs
FROM node:gallium
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y sudo git squid curl git traceroute net-tools iptables vim make golang

RUN apt-get auto-remove -y && apt-get clean -y && rm -rf /var/lib/apt/
RUN update-alternatives --set iptables /usr/sbin/iptables-legacy

RUN useradd snyk --create-home
RUN echo "snyk ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN mkdir -p /app
COPY . /app

RUN rm -rf /app/build /app/.bin
RUN cp /app/.github/docker-proxy/entrypoint.sh /bin

RUN chmod +x /bin/entrypoint.sh
RUN chmod 777 /app && chown -R snyk /app

ENV http_proxy="http://localhost:3128"
ENV https_proxy="http://localhost:3128"
ENV no_proxy "localhost,127.0.0.1"
ENV PROXY_TESTS=true

RUN env
USER snyk
WORKDIR /app
ENTRYPOINT ["/bin/entrypoint.sh"]

# USAGE
# docker build -t "proxy-tests" -f ./docker-proxy/Dockerfile .
# docker run --rm -it --cap-add=NET_ADMIN proxy-tests bash # 
# Or to mount the binary-releases folder
# docker run --rm -it -v $PWD/binary-releases:/mnt/tmp --cap-add=NET_ADMIN proxy-tests bash # 
