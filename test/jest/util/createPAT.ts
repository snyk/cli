type Claims = {
  host: string;
};

export function createPAT(claims: Claims): string {
  const payload = `{"h":"${claims.host}"}`;
  const encodedPayload = Buffer.from(payload)
    .toString('base64')
    .replace(/=/g, '');
  const signature = 'signature';
  return `snyk_uat.12345678.${encodedPayload}.${signature}`;
}
