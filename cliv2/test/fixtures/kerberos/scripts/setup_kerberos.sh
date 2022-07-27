#!/bin/bash
set -exuo pipefail
# Inspired by: https://github.com/requests/requests-kerberos/blob/cf45bbac9df696c5dd2d1a2360b6fbee7096207c/ci/setup-kerb.sh
# ${VAR^^} uppercases all characters.

export KERBEROS_HOSTNAME="$(cat /etc/hostname)"
export KERBEROS_REALM="$(echo ${KERBEROS_HOSTNAME} | cut -d'.' -f2,3)"
export KRB5_KTNAME='/etc/krb5.keytab'

echo "Setting up Kerberos config file at /etc/krb5.conf"
cat > /etc/krb5.conf << EOL
[libdefaults]
    default_realm = ${KERBEROS_REALM^^}
    dns_lookup_realm = false
    dns_lookup_kdc = false
[realms]
    ${KERBEROS_REALM^^} = {
        kdc = localhost
        admin_server = localhost
    }
[domain_realm]
    .${KERBEROS_REALM} = ${KERBEROS_REALM^^}
[logging]
    kdc = FILE:/var/log/krb5kdc.log
    admin_server = FILE:/var/log/kadmin.log
    default = FILE:/var/log/krb5lib.log
EOL
cat /etc/krb5.conf

echo "Setting up kerberos ACL configuration at /etc/krb5kdc/kadm5.acl"
echo -e "*/*@${KERBEROS_REALM^^}\t*" > /etc/krb5kdc/kadm5.acl

echo "Creating KDC database"
printf "${KERBEROS_PASSWORD}\n${KERBEROS_PASSWORD}" | krb5_newrealm

echo "Creating principals for tests"
kadmin.local -q "addprinc -pw ${KERBEROS_PASSWORD} ${KERBEROS_USERNAME}"

echo "Adding HTTP principal for Kerberos and create keytab"
kadmin.local -q "addprinc -randkey HTTP/localhost"
kadmin.local -q "addprinc -randkey HTTP/${KERBEROS_HOSTNAME}"
kadmin.local -q "ktadd -k ${KRB5_KTNAME} HTTP/localhost"
kadmin.local -q "ktadd -k ${KRB5_KTNAME} HTTP/${KERBEROS_HOSTNAME}"
chmod 777 "${KRB5_KTNAME}"

echo "Restarting Kerberos KDS service"
service krb5-kdc restart

echo "Configuring Squid HTTP proxy"
cat > /etc/squid/squid.conf << EOL
auth_param negotiate program /usr/lib/squid/negotiate_wrapper_auth --kerberos /usr/lib/squid/negotiate_kerberos_auth -d -s HTTP/localhost --ntlm /usr/lib/squid/ntlm_fake_auth
auth_param negotiate children 10
auth_param negotiate keep_alive on
acl auth proxy_auth REQUIRED
http_port 0.0.0.0:${HTTP_PROXY_PORT}
http_access deny !auth
http_access allow auth
http_access deny all
EOL
cat /etc/squid/squid.conf
service squid restart

sleep 1

echo "Getting ticket for Kerberos user"
echo -n "${KERBEROS_PASSWORD}" | kinit "${KERBEROS_USERNAME}@${KERBEROS_REALM^^}"

echo "Checking HTTP proxy"
curl --verbose --head --retry 5 \
    --proxy "http://localhost:${HTTP_PROXY_PORT}" --proxy-negotiate -u ":" \
    "https://snyk.io"

cp /tmp/krb5cc_0 /etc/cliv2/scripts/krb5_cache
cp /etc/krb5.conf /etc/cliv2/scripts/krb5.conf
chmod a+r /etc/cliv2/scripts/krb5_cache
chmod a+r /etc/cliv2/scripts/krb5.conf

echo "Kerberos setup complete."
echo "Keeping container running... Press CTRL+C to stop."
tail -F /var/log/squid/access.log
