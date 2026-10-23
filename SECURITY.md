# Security Policy

## Supported versions

PiFlex Browser is pre-1.0 in terms of public support policy; security fixes are applied to the latest `2.x` line.

| Version | Supported |
| --- | --- |
| 2.x (latest) | Yes |
| < 2.0 | No |

## Reporting a vulnerability

**Do not open a public issue, discussion, or pull request for a security problem.**

Report privately using one of these channels:

1. GitHub Security Advisories: go to the repository's **Security** tab and choose **Report a vulnerability**.
2. If advisories are unavailable, contact the maintainer through their GitHub profile and ask for a private channel. Do not include exploit details in a public message.

Please include:

- Affected version and platform
- Steps to reproduce or a proof of concept
- Impact and attack surface (e.g. renderer escape, arbitrary file read, request cancellation)
- Whether the issue is already public
- Any suggested mitigation

## What to expect

- Acknowledgement within a reasonable time.
- Triage and a severity assessment.
- A coordinated fix and release. We will credit reporters in the advisory unless you prefer to remain anonymous.

Please give us time to ship a fix before public disclosure.

## Scope

In scope:

- Renderer/preload sandbox escapes and IPC authorization gaps
- Arbitrary file read/write, path traversal, or command injection in main-process services
- URL/scheme handling that can launch unintended external protocols or origins
- Ad-block/permission bypasses with a concrete privacy or security impact
- Credential, vault, or autofill data exposure
- Supply-chain issues in build/release configuration
- AI prompt/data handling that leaks sensitive page content or secrets

Out of scope:

- Missing security headers on third-party sites
- Social engineering or physical access
- Denial of service from extremely large local files without a security boundary crossed
- Cosmetic or network ad blocking gaps that do not expose data or code execution
- Vulnerabilities in Chromium/Electron that are already fixed in the latest supported release (report those upstream)

## Security design notes

- Web content runs with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
- The preload bridge exposes an allow-listed API; invoke channels are validated in main.
- External schemes are filtered and handed to the OS only when explicitly allowed.
- Ad blocking is network-level and must never cancel main-frame navigation.
- Page text is untrusted and redacted before inference; AI runs on-device by default.
- User data, models, runtime binaries, and logs are excluded from version control.

## Dependency updates

Dependabot monitors npm and GitHub Actions. Security-relevant dependency updates are prioritized and validated with the full check suite before release.
