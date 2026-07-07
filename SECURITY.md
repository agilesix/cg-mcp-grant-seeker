# Security and Responsible Disclosure Policy

If you discover a security vulnerability in this project, please report it privately so we can fix it before any public disclosure.

**How to report a vulnerability:**

- Open a [private security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository, OR
- Email the maintainers directly at the contact listed on the project's GitHub profile.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, including any required configuration.
- Any relevant logs, screenshots, or proof-of-concept code.

We ask that you give us a reasonable amount of time to investigate and address the issue before disclosing it publicly. We will acknowledge receipt within a few business days and keep you informed of our progress toward a fix.

**A note on credentials:** This server can hold a federal (Simpler.Grants.gov) API key. In the hosted deployment it is a Cloudflare secret; in self-hosted use it is supplied via the environment. Never commit an API key — `.dev.vars` and `.env*` are gitignored. If you believe a key has been exposed, rotate it immediately.

**Out of scope:**

- Vulnerabilities in the upstream source APIs (Simpler.Grants.gov, the PA and CA CommonGrants APIs, or any source you register). Please report those to the respective operators.
- Vulnerabilities in the CommonGrants protocol itself. Please report those upstream at <https://github.com/HHS/simpler-grants-protocol/security>.
