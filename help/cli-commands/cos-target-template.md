---
description: A sample target configuration file for the snyk cos target add command.
---

# COS target template

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Description

Use this sample template file with the [`snyk cos target add`](cos-target-add.md) command.

The configuration file has three sections:

- `target`: the name of the application, its primary URL, and the hosts to include in or exclude from the scope.
- `authentication`: the login URL and one entry for each user role the scan should test.
- `settings`: the headers and cookies to inject into every request, and free-form guidance for the agent.

{% hint style="warning" %}
The configuration file can contain credentials and other secrets. Mark every secret value with `sensitive: true` and store the file securely.
{% endhint %}

## Example

```yaml
# Target configuration
# ── Target ─────────────────────────────────────────────────────────
target:
  name: 'Customer Portal' # Display name — required
  url: 'https://app.acme.com' # Primary URL — required
  additional_scope: # Optional — domains, subdomains. *.acme.io or **acme.io
    - host: 'api.acme.com'

  reject: # Optional — domains, subdomains. *.acme.io or **acme.io
    - 'admin.acme.io'

# ── Authentication ──────────────────────────────────────────────────
authentication:
  login_url: 'https://app.acme.com/login' # Optional — auto-detected if omitted
  users: # Optional — one entry per role
    - label: 'Standard user'
      type: credentials_login # credentials_login | custom
      credentials:
        - key: username
          value: 'testuser@acme.com'
        - key: password
          value: 'password'
          sensitive: true
      instructions: | # Optional — login hints for the agent
        Accept the cookie banner on first visit. Select the EU region if prompted.
    - label: 'Admin user'
      type: credentials_login
      credentials:
        - key: username
          value: 'admin@acme.com'
        - key: password
          value: 'password'
          sensitive: true
        - key: api_key
          value: 'sk-acme-prod-abc123'
          sensitive: true
    - label: 'User with MFA'
      type: credentials_login
      credentials:
        - key: username
          value: 'user@acme.com'
        - key: password
          value: 'password'
          sensitive: true
      totp_secret: 'JBSWY3DPEHPK3PXP'
    - label: 'SSO user'
      type: custom
      instructions: |
        Navigate to /login, click "Sign in with SSO", enter the email in #sso-email,
        click Continue, complete the IdP login, then accept the MFA push notification.

# ── Other settings ──────────────────────────────────────────────────
settings:
  headers: # Optional — injected into every request
    - key: X-Bug-Bounty
      value: 'snyk-evo-prod'
    - key: X-Internal-Token
      value: 'abc123'
      sensitive: true
  cookies: # Optional — injected as Cookie header
    - key: consent
      value: 'accepted'
    - key: session_hint
      value: 'eu-west'
  context: | # Optional — free-form agent guidance
    All data is EU-resident. Session tokens expire after 30 minutes.
    Do not create real payment transactions — use amounts under €0.01 for test flows.
```
