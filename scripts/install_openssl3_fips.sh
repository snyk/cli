#!/usr/bin/env bash
set -ex

git clone https://github.com/openssl/openssl.git

pushd .
cd openssl
git checkout openssl-3.0.8
./Configure enable-fips --libdir=lib
make install_sw install_ssldirs install_fips
export PATH=/usr/local/bin/:$PATH
export LD_LIBRARY_PATH=/usr/local/lib/
popd

cp scripts/openssl.cnf /usr/local/ssl/openssl_fips_enabled.cnf
chmod +r /usr/local/ssl/openssl_fips_enabled.cnf

openssl fipsinstall -out /usr/local/ssl/fipsmodule.cnf -module /usr/local/lib/ossl-modules/fips.so
openssl fipsinstall -config /usr/local/ssl/openssl_fips_enabled.cnf
rm -rf openssl
