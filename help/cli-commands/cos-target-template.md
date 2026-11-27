# COS target template

## Description

Use this sample template file with the [`snyk cos target create`](cos-target-create.md) command.

The configuration file has three sections:

- `target`: the name of the application, its primary URL, and the hosts to include in or exclude from the scope.
- `authentication`: the login URL and one entry for each user role the scan should test.
- `settings`: the headers and cookies to inject into every request, and free-form guidance for the agent.

## Example

```yaml
# Target configuration
# ── Target ─────────────────────────────────────────────────────────
target:
  name: "Customer Portal"                    # Display name — required
  url: "https://app.acme.com"                # Primary URL — required
  gateway_id: "<gateway-uuid>"               # Optional — route through a gateway for private hosts.

  scope:                                     # Optional — d#s, subdomains. *.acme.io or **acme.io
    allow:                                   # Widens scope beyond the target URL
      - "api.acme.com"                       # String form: host only
      - host: "bo.acme.com"                  # Object form: host + paths (prefix match, case-sensitive)
        paths: [/admin]

  reject:                                    # Optional — domains, subdomains. *.acme.io or **acme.io
    - "admin.acme.io/health"                        # String form: host + one path
    - host: "app.acme.com"
      paths: [/internal, /metrics]

 repositories:                               # Optional — adds grey-box scanning. Omit for black-box
    - org_slug: "acme"                       # or org_id (UUID) — use one, not both
      scm_target_name: "acme/customer-portal"# or scm_target_id (UUID); must match exactly

# ── Authentication ──────────────────────────────────────────────────
authentication:                              # Optional — omit for an unauthenticated scan
  users:                                     # One entry per role/principal
    - label: "Standard user"
      type: credentials_login                # credentials_login | custom
      credentials:                           # Required for credentials_login
        - key: username
          value: "testuser@acme.com"
        - key: password
          value: "s3cr3t"
    - label: "Admin user"
      type: credentials_login
      credentials:
        - key: username
          value: "admin@acme.com"
        - key: password
          value: "s3cr3t"
        - key: api_key
          value: "sk-acme-abc123"
    - label: "User with MFA"
      type: credentials_login
      credentials:
        - key: username
          value: "mfa@acme.com"
        - key: password
          value: "s3cr3t"
      totp_secret: "JBSWY3DPEHPK3PXP"
    - label: "SSO user"
      type: custom
      instructions: |                        # Required for custom
        Navigate to /login, click "Sign in with SSO", enter the email in #sso-email,
        click Continue, complete the IdP login, then approve the MFA push.

# ── Other settings ──────────────────────────────────────────────────
settings:
  headers:                                   # Optional — injected into every request
    - key: X-Bug-Bounty
      value: "snyk-evo-prod"
      host: "api.acme.com"
    - key: X-Internal-Token
      value: "abc123"
      host: "app.acme.com"
  cookies:                                   # Optional — injected as Cookie header
    - key: consent
      value: "accepted"
      host: "app.acme.com"
    - key: session_hint
      value: "eu-west"
      host: "app.acme.com"
  context: |                                 # Optional — free-form agent guidance
    All data is EU-resident. Session tokens expire after 30 minutes.
    Do not create real payment transactions — use amounts under €0.01 for test flows.
```
