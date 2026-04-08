# Federal Backend Security — GitHub Copilot Instructions

You are building a U.S. federal government backend system. Security is not optional. These rules are mandatory and non-negotiable.

---

## 1. OWASP Top 10 (2021) — Mandatory Compliance

Every backend system must address all OWASP Top 10 vulnerabilities. Treat this as a checklist for every feature.

### A01:2021 – Broken Access Control

- **Never trust client-side access control.** Always validate permissions server-side.
- Implement **deny by default**. Explicitly grant access; never assume it.
- Use **role-based access control (RBAC)** or **attribute-based access control (ABAC)**.
- Validate user permissions on **every request** to protected resources.
- Never expose object references directly (e.g., `/api/users/123`). Use indirect references or validate ownership.
- Log all access control failures for security monitoring.

```python
# BAD: Direct object reference without ownership check
@app.route('/api/documents/<doc_id>')
def get_document(doc_id):
    return Document.query.get(doc_id)

# GOOD: Validate ownership before access
@app.route('/api/documents/<doc_id>')
@login_required
def get_document(doc_id):
    doc = Document.query.get_or_404(doc_id)
    if doc.owner_id != current_user.id and not current_user.has_role('admin'):
        abort(403)
    return doc
```

### A02:2021 – Cryptographic Failures

- **Never store passwords in plaintext.** Use bcrypt, scrypt, or Argon2 with appropriate work factors.
- Use **TLS 1.2 or higher** for all data in transit. TLS 1.3 preferred.
- Encrypt sensitive data at rest using **AES-256** or equivalent FIPS 140-2 validated algorithms.
- Never implement custom cryptography. Use vetted libraries (e.g., `cryptography` in Python, `crypto` in Node.js).
- Use **HSTS headers** to enforce HTTPS.
- Rotate encryption keys according to NIST SP 800-57 guidance.

```python
# BAD: Weak password hashing
password_hash = hashlib.md5(password.encode()).hexdigest()

# GOOD: Strong password hashing with bcrypt
import bcrypt
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
```

### A03:2021 – Injection

- **Use parameterized queries or ORMs** for all database operations. Never concatenate user input into SQL.
- Validate and sanitize all user input. Use allowlists, not denylists.
- Use **prepared statements** for SQL, **parameterized commands** for NoSQL.
- Escape output when rendering user-controlled data in HTML, JSON, XML, or other formats.
- Never use `eval()`, `exec()`, or equivalent functions on user input.

```python
# BAD: SQL injection vulnerability
query = f"SELECT * FROM users WHERE username = '{username}'"

# GOOD: Parameterized query
query = "SELECT * FROM users WHERE username = ?"
cursor.execute(query, (username,))
```

### A04:2021 – Insecure Design

- Perform **threat modeling** before building new features. Identify security requirements early.
- Use **security design patterns**: least privilege, defense in depth, fail securely.
- Implement **rate limiting** on all public endpoints (e.g., 100 requests/minute per IP).
- Use **secure defaults**. Require opt-in for risky features, not opt-out.
- Separate sensitive operations into distinct layers (e.g., separate admin API from public API).

### A05:2021 – Security Misconfiguration

- Disable **directory listings**, **debug modes**, and **verbose error messages** in production.
- Remove or disable **unused features, frameworks, and dependencies**.
- Use **security headers**: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.
- Keep all software **up to date**. Automate dependency updates with tools like Dependabot.
- Use **environment variables** for secrets. Never commit secrets to version control.
- Run security scanners (e.g., `bandit`, `npm audit`, `Snyk`) in CI/CD pipelines.

```python
# GOOD: Security headers in Flask
@app.after_request
def set_security_headers(response):
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response
```

### A06:2021 – Vulnerable and Outdated Components

- Maintain an **inventory of all dependencies** (SBOM — Software Bill of Materials).
- Scan dependencies for known vulnerabilities using `npm audit`, `pip-audit`, `OWASP Dependency-Check`, or `Snyk`.
- Update dependencies **within 30 days** of security patches.
- Remove unused dependencies to reduce attack surface.
- Pin dependency versions in production. Use lock files (`package-lock.json`, `Pipfile.lock`, `go.sum`).

### A07:2021 – Identification and Authentication Failures

- Implement **multi-factor authentication (MFA)** for privileged accounts.
- Use **strong password policies**: minimum 12 characters, complexity requirements, no common passwords.
- Implement **account lockout** after 5 failed login attempts.
- Use **secure session management**: HTTPOnly and Secure flags on cookies, random session IDs, session expiration.
- Never log credentials or tokens. Mask sensitive data in logs.
- Implement **credential stuffing protection** (e.g., CAPTCHA, rate limiting).

```python
# GOOD: Secure session cookie configuration
app.config['SESSION_COOKIE_SECURE'] = True  # HTTPS only
app.config['SESSION_COOKIE_HTTPONLY'] = True  # No JavaScript access
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # CSRF protection
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
```

### A08:2021 – Software and Data Integrity Failures

- Use **code signing** for releases. Verify signatures before deployment.
- Implement **CI/CD pipeline security**: signed commits, protected branches, required reviews.
- Validate **all external data sources**. Do not trust third-party APIs without verification.
- Use **Subresource Integrity (SRI)** for CDN resources.
- Implement **integrity checks** for critical files (e.g., checksums, digital signatures).

### A09:2021 – Security Logging and Monitoring Failures

- Log **all authentication events**: login, logout, failed attempts, password changes.
- Log **all authorization failures**: access denied, privilege escalation attempts.
- Log **all input validation failures** and suspicious patterns.
- Use **structured logging** (JSON format) for easy parsing and analysis.
- Send logs to a **centralized logging system** (e.g., ELK stack, Splunk, CloudWatch).
- Implement **alerting** for critical security events (e.g., multiple failed logins, privilege escalation).
- Retain logs for **at least 90 days** (NIST recommendation).

```python
# GOOD: Structured security logging
import logging
import json

def log_security_event(event_type, user_id, details):
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': event_type,
        'user_id': user_id,
        'ip_address': request.remote_addr,
        'user_agent': request.headers.get('User-Agent'),
        'details': details
    }
    logging.warning(json.dumps(log_entry))
```

### A10:2021 – Server-Side Request Forgery (SSRF)

- **Validate and sanitize all URLs** before making outbound requests.
- Use **allowlists** for permitted domains. Deny by default.
- Disable **URL redirects** in HTTP clients.
- Block requests to **internal IP ranges** (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).
- Use **network segmentation** to isolate backend services.

```python
# GOOD: SSRF protection
import ipaddress
from urllib.parse import urlparse

def is_safe_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ['http', 'https']:
        return False
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return False
    except ValueError:
        pass  # Hostname is not an IP
    return parsed.hostname in ALLOWED_DOMAINS
```

---

## 2. NIST Guidelines — Federal Compliance

Follow NIST Special Publications for federal systems.

### NIST SP 800-53 — Security and Privacy Controls

- Implement **access control (AC)** family controls: least privilege, separation of duties, remote access controls.
- Implement **audit and accountability (AU)** controls: audit logging, audit review, audit reduction.
- Implement **identification and authentication (IA)** controls: MFA, password policies, session management.
- Implement **system and communications protection (SC)** controls: TLS, network segmentation, denial of service protection.

### NIST SP 800-63B — Digital Identity Guidelines

- Use **authenticator assurance level (AAL) 2 or higher** for privileged accounts (MFA required).
- Implement **password complexity** per NIST 800-63B: minimum 8 characters (12+ recommended), no composition rules, check against breach databases.
- Implement **rate limiting** on authentication endpoints (10 attempts per minute per IP).
- Use **secure password storage**: bcrypt, scrypt, or Argon2 with appropriate parameters.

### NIST SP 800-190 — Container Security

- Use **minimal base images** (e.g., Alpine, distroless).
- Scan container images for vulnerabilities before deployment.
- Run containers as **non-root users**.
- Use **read-only file systems** where possible.
- Implement **resource limits** (CPU, memory) to prevent DoS.

---

## 3. DevSecOps — Security in CI/CD

Security is integrated into every stage of development, not bolted on at the end.

### Shift Left Security

- Run **static application security testing (SAST)** in CI pipeline (e.g., Bandit, SonarQube, Semgrep).
- Run **dependency scanning** in CI pipeline (e.g., npm audit, pip-audit, Snyk).
- Run **container scanning** before pushing images (e.g., Trivy, Clair, Anchore).
- Run **dynamic application security testing (DAST)** in staging environment (e.g., OWASP ZAP, Burp Suite).
- Fail builds on **critical or high severity vulnerabilities**.

### Secrets Management

- Never commit secrets to version control. Use `.gitignore` for sensitive files.
- Use **secrets management tools**: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, Kubernetes Secrets.
- Rotate secrets **at least every 90 days**.
- Use **environment variables** for configuration, not hardcoded values.
- Scan commits for secrets using tools like `git-secrets`, `truffleHog`, or `detect-secrets`.

### Infrastructure as Code (IaC) Security

- Scan IaC templates for misconfigurations (e.g., `checkov`, `tfsec`, `terrascan`).
- Use **least privilege** for IAM roles and service accounts.
- Enable **audit logging** for all infrastructure changes.
- Use **immutable infrastructure**. Never SSH into production servers to make changes.

---

## 4. API Security

APIs are the primary attack surface for modern applications.

### Authentication and Authorization

- Use **OAuth 2.0** or **OpenID Connect** for API authentication.
- Use **JWT tokens** with short expiration times (15 minutes for access tokens, 7 days for refresh tokens).
- Validate JWT signatures on every request. Never trust client-provided tokens without verification.
- Implement **API key rotation** for service-to-service authentication.

### Rate Limiting and Throttling

- Implement **rate limiting** on all public endpoints (e.g., 100 requests/minute per API key).
- Use **exponential backoff** for retry logic.
- Return **429 Too Many Requests** with `Retry-After` header.

### Input Validation

- Validate **all input** against a schema (e.g., JSON Schema, OpenAPI spec).
- Reject requests with **unexpected fields** (fail closed).
- Limit **request body size** (e.g., 1MB max).
- Validate **content types**. Reject requests with mismatched `Content-Type` headers.

### API Versioning

- Use **URL versioning** (`/api/v1/users`) or **header versioning** (`Accept: application/vnd.api+json; version=1`).
- Maintain **backward compatibility** for at least 2 major versions.
- Deprecate old versions with **at least 6 months notice**.

---

## 5. Database Security

### Query Security

- Use **parameterized queries or ORMs** exclusively. Never concatenate user input into SQL.
- Use **least privilege database accounts**. Application should not use `root` or `admin` accounts.
- Implement **row-level security** where supported (e.g., PostgreSQL RLS).

### Encryption

- Encrypt sensitive columns at rest (e.g., SSN, credit card numbers).
- Use **TLS for database connections**.
- Rotate database credentials **at least every 90 days**.

### Backup and Recovery

- Encrypt backups at rest and in transit.
- Test backup restoration **at least quarterly**.
- Store backups in a **separate geographic region**.

---

## 6. Error Handling and Logging

### Error Messages

- Never expose **stack traces, database errors, or internal paths** to users.
- Return **generic error messages** to clients (e.g., "An error occurred. Please try again.").
- Log **detailed errors** server-side for debugging.

### Logging Best Practices

- Log at appropriate levels: DEBUG, INFO, WARNING, ERROR, CRITICAL.
- Never log **passwords, tokens, API keys, or PII** unless absolutely necessary (and then redact).
- Use **correlation IDs** to trace requests across services.
- Log **security events**: authentication, authorization failures, input validation failures.

---

## 7. Federal-Specific Requirements

### FedRAMP Compliance

- If deploying to cloud, use **FedRAMP authorized cloud service providers** (AWS GovCloud, Azure Government, Google Cloud for Government).
- Implement **continuous monitoring** of security controls.
- Maintain **system security plan (SSP)** documentation.

### FISMA Compliance

- Categorize system according to **FIPS 199** (Low, Moderate, High impact).
- Implement security controls based on **NIST SP 800-53** baseline.
- Conduct **annual security assessments**.

### Section 508 Compliance (APIs)

- Provide **accessible error messages** (clear, actionable).
- Support **assistive technologies** in API documentation.
- Ensure API responses are **machine-readable** (JSON, XML with proper schemas).

---

## 8. What to Do When Uncertain

- If a security decision is ambiguous, **choose the more restrictive option**.
- If unsure about a cryptographic algorithm, **use FIPS 140-2 validated implementations**.
- If unsure about access control, **deny by default**.
- If unsure about logging, **log more rather than less** (but never log secrets).
- When in doubt, consult **OWASP, NIST, or CISA guidance**.

---

## 9. Security Checklist — Before Every Deployment

- [ ] All OWASP Top 10 vulnerabilities addressed
- [ ] SAST scan passed (no critical/high vulnerabilities)
- [ ] Dependency scan passed (all critical vulnerabilities patched)
- [ ] Container scan passed (if using containers)
- [ ] Secrets not committed to version control
- [ ] TLS 1.2+ enforced for all connections
- [ ] Security headers configured
- [ ] Rate limiting implemented on public endpoints
- [ ] Authentication and authorization tested
- [ ] Input validation implemented on all endpoints
- [ ] Error messages sanitized (no sensitive data exposed)
- [ ] Security logging enabled
- [ ] Backup and recovery tested
- [ ] Documentation updated with security considerations
