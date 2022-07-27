FROM debian:bullseye-slim

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    build-essential \
    krb5-user krb5-kdc krb5-admin-server krb5-multidev libkrb5-dev \
    curl openssl ca-certificates \
    squid \
    && mkdir -p /etc/cliv2/bin && touch /etc/cliv2/bin/snyk

ENTRYPOINT [ "/etc/cliv2/scripts/setup_kerberos.sh" ]
