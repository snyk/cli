
if [ -z "$1" ]
then
  echo "Usage: $0 <certname>"
  exit 1
fi

certname="$1"
echo $certname
echo "${certname}.pem"

# Create key
openssl genrsa -out "${certname}.key" 2048

# Generate CSR - without prompts
openssl req -new -key "${certname}.key" \
  -out "${certname}.csr" \
  -subj /C=""/ST=""/L=""/O=""/OU=""/CN="${certname}"

# fail if vs.ext does not exist
if [ ! -f "./v3.ext" ]; then
  echo "error: v3.ext file not found"
  exit 1
fi

# Generate certificate
openssl x509 -req -days 365 -sha256 \
  -in "${certname}.csr" \
  -signkey "${certname}.key" \
  -extfile v3.ext \
  -out "${certname}.crt"

# generate .pem file
cat "${certname}.key" "${certname}.crt" > "${certname}.pem"
