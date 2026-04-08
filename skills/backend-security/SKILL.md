# Backend Security Audit and Implementation

**Trigger**: Use when the user asks to audit security, implement security controls, fix vulnerabilities, or mentions OWASP, NIST, DevSecOps, or federal security compliance.

**Description**: This skill guides you through implementing comprehensive security controls for federal backend systems, covering OWASP Top 10, NIST guidelines, and DevSecOps practices.

---

## When to Use This Skill

- User asks to "audit security" or "check for vulnerabilities"
- User mentions OWASP, NIST, FedRAMP, FISMA, or federal compliance
- User asks to "secure the API" or "implement authentication"
- User asks to set up DevSecOps pipeline or security scanning
- User reports a security vulnerability or penetration test finding
- Before deploying any federal backend system to production

---

## Prerequisites

Before starting, gather:
- [ ] Application codebase access
- [ ] List of all dependencies (`package.json`, `requirements.txt`, `go.mod`, etc.)
- [ ] List of all external APIs and third-party services
- [ ] Deployment environment details (cloud provider, container platform)
- [ ] Compliance requirements (FedRAMP, FISMA, NIST level)

---

## Step 1: OWASP Top 10 Audit

Work through each OWASP Top 10 vulnerability systematically.

### A01: Broken Access Control

**Check for:**
- [ ] Direct object references without ownership validation
- [ ] Missing authorization checks on API endpoints
- [ ] Client-side access control (never trust the client)
- [ ] Privilege escalation vulnerabilities

**Search the codebase:**
```bash
# Find routes without authentication decorators
rg "@app.route" --type py -A 5 | rg -v "@login_required|@require_auth"

# Find database queries with user-provided IDs
rg "\.get\(.*request\." --type py
rg "findById\(req\.params" --type js
```

**Fix pattern:**
```python
# Before: Broken access control
@app.route('/api/documents/<doc_id>')
def get_document(doc_id):
    return Document.query.get(doc_id)

# After: Proper access control
@app.route('/api/documents/<doc_id>')
@login_required
def get_document(doc_id):
    doc = Document.query.get_or_404(doc_id)
    if doc.owner_id != current_user.id and not current_user.has_role('admin'):
        abort(403, 'Access denied')
    return jsonify(doc.to_dict())
```

### A02: Cryptographic Failures

**Check for:**
- [ ] Passwords stored in plaintext or with weak hashing (MD5, SHA1)
- [ ] Sensitive data transmitted without TLS
- [ ] Hardcoded encryption keys or secrets
- [ ] Weak TLS configuration (TLS 1.0, TLS 1.1)

**Search the codebase:**
```bash
# Find weak password hashing
rg "hashlib\.(md5|sha1)" --type py
rg "crypto\.createHash\('md5'|'sha1'\)" --type js

# Find hardcoded secrets
rg "password\s*=\s*['\"]" --type py
rg "api_key\s*=\s*['\"]" --type js
```

**Fix pattern:**
```python
# Before: Weak password hashing
import hashlib
password_hash = hashlib.md5(password.encode()).hexdigest()

# After: Strong password hashing
import bcrypt
password_hash = bcrypt.hashpw(
    password.encode('utf-8'),
    bcrypt.gensalt(rounds=12)
)
```

### A03: Injection

**Check for:**
- [ ] SQL injection (string concatenation in queries)
- [ ] Command injection (`os.system()`, `subprocess.call()` with user input)
- [ ] LDAP injection, XML injection, NoSQL injection

**Search the codebase:**
```bash
# Find SQL injection vulnerabilities
rg "execute\(f['\"]|execute\(.*\+.*\)" --type py
rg "query\(\`.*\$\{" --type js

# Find command injection
rg "os\.system|subprocess\.call|exec\(" --type py
rg "child_process\.exec\(" --type js
```

**Fix pattern:**
```python
# Before: SQL injection
query = f"SELECT * FROM users WHERE username = '{username}'"
cursor.execute(query)

# After: Parameterized query
query = "SELECT * FROM users WHERE username = ?"
cursor.execute(query, (username,))
```

### A04-A10: Continue Through Remaining Vulnerabilities

For each remaining OWASP category:
1. Review the vulnerability description in `.cursor/rules/backend-security.mdc`
2. Search codebase for vulnerability patterns
3. Document findings
4. Implement fixes
5. Add tests to prevent regression

---

## Step 2: NIST Compliance Check

### NIST SP 800-53 Controls

**Access Control (AC) Family:**
- [ ] AC-2: Account Management (user provisioning, deprovisioning)
- [ ] AC-3: Access Enforcement (authorization checks)
- [ ] AC-6: Least Privilege (minimal permissions)
- [ ] AC-17: Remote Access (VPN, MFA for remote access)

**Audit and Accountability (AU) Family:**
- [ ] AU-2: Audit Events (what to log)
- [ ] AU-3: Content of Audit Records (structured logging)
- [ ] AU-6: Audit Review (log monitoring)
- [ ] AU-9: Protection of Audit Information (log integrity)

**Identification and Authentication (IA) Family:**
- [ ] IA-2: Identification and Authentication (MFA)
- [ ] IA-5: Authenticator Management (password policies)
- [ ] IA-8: Identification and Authentication (session management)

**System and Communications Protection (SC) Family:**
- [ ] SC-8: Transmission Confidentiality (TLS)
- [ ] SC-13: Cryptographic Protection (FIPS 140-2)
- [ ] SC-28: Protection of Information at Rest (encryption)

### Implementation Checklist

```python
# Example: Implement structured audit logging (AU-3)
import logging
import json
from datetime import datetime

def log_security_event(event_type, user_id, resource, action, result, details=None):
    """
    Log security event in structured format per NIST AU-3
    """
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': event_type,  # authentication, authorization, data_access
        'user_id': user_id,
        'ip_address': request.remote_addr,
        'user_agent': request.headers.get('User-Agent'),
        'resource': resource,
        'action': action,
        'result': result,  # success, failure, denied
        'details': details or {}
    }
    
    if result in ['failure', 'denied']:
        logging.warning(json.dumps(log_entry))
    else:
        logging.info(json.dumps(log_entry))

# Usage
@app.route('/api/documents/<doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    doc = Document.query.get_or_404(doc_id)
    
    if doc.owner_id != current_user.id:
        log_security_event(
            'authorization',
            current_user.id,
            f'document:{doc_id}',
            'delete',
            'denied',
            {'reason': 'not_owner'}
        )
        abort(403)
    
    db.session.delete(doc)
    db.session.commit()
    
    log_security_event(
        'data_access',
        current_user.id,
        f'document:{doc_id}',
        'delete',
        'success'
    )
    
    return '', 204
```

---

## Step 3: DevSecOps Pipeline Setup

### Static Application Security Testing (SAST)

**Python:**
```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Bandit (Python SAST)
        run: |
          pip install bandit
          bandit -r . -f json -o bandit-report.json
          
      - name: Upload Bandit results
        uses: actions/upload-artifact@v3
        with:
          name: bandit-report
          path: bandit-report.json
```

**Node.js:**
```yaml
      - name: Run ESLint Security Plugin
        run: |
          npm install
          npm run lint:security
          
      - name: Run npm audit
        run: npm audit --audit-level=high
```

### Dependency Scanning

**Python:**
```yaml
      - name: Run pip-audit
        run: |
          pip install pip-audit
          pip-audit --requirement requirements.txt --format json
```

**Node.js:**
```yaml
      - name: Run npm audit
        run: npm audit --audit-level=moderate --json
```

### Container Scanning

```yaml
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .
        
      - name: Run Trivy container scan
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy image --severity HIGH,CRITICAL myapp:${{ github.sha }}
```

### Secrets Scanning

```yaml
      - name: Run TruffleHog
        run: |
          docker run --rm -v "$PWD:/pwd" trufflesecurity/trufflehog:latest \
            filesystem /pwd --json --no-update
```

---

## Step 4: Security Headers Implementation

### Flask Example

```python
from flask import Flask, make_response

app = Flask(__name__)

@app.after_request
def set_security_headers(response):
    """
    Set security headers per OWASP recommendations
    """
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Enable XSS protection (legacy browsers)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Enforce HTTPS
    response.headers['Strict-Transport-Security'] = \
        'max-age=31536000; includeSubDomains; preload'
    
    # Content Security Policy
    response.headers['Content-Security-Policy'] = \
        "default-src 'self'; " \
        "script-src 'self'; " \
        "style-src 'self' 'unsafe-inline'; " \
        "img-src 'self' data: https:; " \
        "font-src 'self'; " \
        "connect-src 'self'; " \
        "frame-ancestors 'none'"
    
    # Referrer policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Permissions policy
    response.headers['Permissions-Policy'] = \
        'geolocation=(), microphone=(), camera=()'
    
    return response
```

### Express Example

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## Step 5: Rate Limiting Implementation

### Flask Example

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="redis://localhost:6379"
)

# Apply to specific routes
@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    # Login logic
    pass

@app.route('/api/users', methods=['POST'])
@limiter.limit("10 per hour")
def create_user():
    # User creation logic
    pass
```

### Express Example

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

---

## Step 6: Input Validation

### Schema-Based Validation (Python)

```python
from marshmallow import Schema, fields, validate, ValidationError

class UserCreateSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(
        required=True,
        validate=validate.Length(min=12, max=128)
    )
    first_name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=50)
    )
    last_name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=50)
    )
    role = fields.Str(
        validate=validate.OneOf(['user', 'admin', 'auditor'])
    )

@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    schema = UserCreateSchema()
    
    try:
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400
    
    # Create user with validated data
    user = User(**data)
    db.session.add(user)
    db.session.commit()
    
    return jsonify(user.to_dict()), 201
```

### Schema-Based Validation (Node.js)

```javascript
const Joi = require('joi');

const userCreateSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(12).max(128).required(),
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  role: Joi.string().valid('user', 'admin', 'auditor')
});

app.post('/api/users', async (req, res) => {
  try {
    const value = await userCreateSchema.validateAsync(req.body);
    
    // Create user with validated data
    const user = await User.create(value);
    res.status(201).json(user);
    
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

---

## Step 7: Secrets Management

### Environment Variables

```bash
# .env (never commit this file)
DATABASE_URL=postgresql://user:pass@localhost/dbname
SECRET_KEY=your-secret-key-here
API_KEY=your-api-key-here
```

```python
# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DATABASE_URL = os.getenv('DATABASE_URL')
    SECRET_KEY = os.getenv('SECRET_KEY')
    API_KEY = os.getenv('API_KEY')
    
    @classmethod
    def validate(cls):
        """Ensure all required secrets are present"""
        required = ['DATABASE_URL', 'SECRET_KEY', 'API_KEY']
        missing = [key for key in required if not getattr(cls, key)]
        if missing:
            raise ValueError(f"Missing required config: {', '.join(missing)}")
```

### AWS Secrets Manager Integration

```python
import boto3
import json

def get_secret(secret_name):
    """Retrieve secret from AWS Secrets Manager"""
    client = boto3.client('secretsmanager', region_name='us-east-1')
    
    try:
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except Exception as e:
        logging.error(f"Error retrieving secret {secret_name}: {e}")
        raise

# Usage
db_credentials = get_secret('prod/database/credentials')
DATABASE_URL = f"postgresql://{db_credentials['username']}:{db_credentials['password']}@{db_credentials['host']}/{db_credentials['database']}"
```

---

## Step 8: Security Testing

### Unit Tests for Security

```python
# tests/test_security.py
import pytest
from app import app, db
from app.models import User

def test_broken_access_control():
    """Test that users cannot access other users' documents"""
    with app.test_client() as client:
        # Create two users
        user1 = User(email='user1@example.com')
        user2 = User(email='user2@example.com')
        db.session.add_all([user1, user2])
        db.session.commit()
        
        # User1 creates a document
        client.post('/api/login', json={'email': 'user1@example.com'})
        response = client.post('/api/documents', json={'title': 'Secret'})
        doc_id = response.json['id']
        
        # User2 tries to access user1's document
        client.post('/api/login', json={'email': 'user2@example.com'})
        response = client.get(f'/api/documents/{doc_id}')
        
        assert response.status_code == 403

def test_sql_injection_protection():
    """Test that SQL injection is prevented"""
    with app.test_client() as client:
        # Attempt SQL injection
        response = client.get('/api/users?name=admin\' OR \'1\'=\'1')
        
        # Should return empty or error, not all users
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            assert len(response.json) == 0

def test_rate_limiting():
    """Test that rate limiting is enforced"""
    with app.test_client() as client:
        # Make 10 requests rapidly
        for i in range(10):
            response = client.post('/api/login', json={'email': 'test@example.com'})
        
        # 11th request should be rate limited
        response = client.post('/api/login', json={'email': 'test@example.com'})
        assert response.status_code == 429
```

---

## Step 9: Security Documentation

Create a `SECURITY.md` file in the repository:

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Please report security vulnerabilities to: security@agency.gov

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within 48 hours.

## Security Controls

This application implements the following security controls:

- OWASP Top 10 (2021) compliance
- NIST SP 800-53 controls (Moderate baseline)
- TLS 1.2+ for all connections
- Bcrypt password hashing (12 rounds)
- JWT authentication with 15-minute expiration
- Rate limiting (100 req/min per IP)
- Input validation on all endpoints
- SQL injection protection (parameterized queries)
- CSRF protection
- Security headers (CSP, HSTS, X-Frame-Options)
- Structured audit logging

## Security Scanning

- SAST: Bandit (Python), ESLint Security (Node.js)
- Dependency scanning: pip-audit, npm audit
- Container scanning: Trivy
- Secrets scanning: TruffleHog

## Compliance

- FedRAMP Moderate (in progress)
- FISMA Moderate
- Section 508 compliant
```

---

## Step 10: Final Security Checklist

Before marking security implementation complete, verify:

- [ ] All OWASP Top 10 vulnerabilities addressed
- [ ] NIST SP 800-53 controls implemented (per system categorization)
- [ ] SAST, dependency, and container scanning in CI/CD
- [ ] Security headers configured
- [ ] Rate limiting on all public endpoints
- [ ] Input validation on all endpoints
- [ ] Authentication and authorization tested
- [ ] Secrets not in version control
- [ ] TLS 1.2+ enforced
- [ ] Security logging implemented
- [ ] Incident response plan documented
- [ ] Security.md file created
- [ ] Penetration testing completed (if required)
- [ ] Security training completed for team

---

## Common Mistakes to Avoid

1. **Trusting client-side validation**: Always validate server-side.
2. **Logging sensitive data**: Never log passwords, tokens, or PII.
3. **Using weak cryptography**: Use FIPS 140-2 validated algorithms.
4. **Ignoring dependency vulnerabilities**: Automate dependency scanning.
5. **Skipping security testing**: Write security-focused unit tests.
6. **Hardcoding secrets**: Use environment variables or secrets managers.
7. **Disabling security features in production**: Never disable HTTPS, CSRF protection, etc.
8. **Not implementing rate limiting**: All public endpoints need rate limiting.
9. **Exposing stack traces**: Return generic error messages to clients.
10. **Not monitoring security logs**: Set up alerts for suspicious activity.

---

## Resources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST SP 800-53: https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
- NIST SP 800-63B: https://pages.nist.gov/800-63-3/sp800-63b.html
- CWE Top 25: https://cwe.mitre.org/top25/
- CISA Known Exploited Vulnerabilities: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
