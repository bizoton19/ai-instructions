# Public-Facing Authentication Implementation

**Trigger**: Use when the user asks to implement authentication for a public-facing federal application, mentions Login.gov, or needs to set up OIDC/SAML for citizen access.

**Description**: This skill provides a comprehensive, step-by-step workflow for implementing Login.gov authentication for U.S. federal government public-facing applications, covering OIDC integration, service levels, user data management, and production deployment.

---

## When to Use This Skill

- User asks to "implement Login.gov authentication"
- User mentions "public-facing authentication" or "citizen login"
- User asks to "integrate OIDC for federal app"
- User needs to implement identity verification (IAL2)
- User asks about NIST 800-63-3 compliance
- User mentions Azure AD B2C for federal public apps (redirect to Login.gov)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Access to Login.gov Partner Portal (sandbox and production)
- [ ] Understanding of the application's identity assurance requirements (auth-only vs verified)
- [ ] Signed Interagency Agreement (IAA) for production deployment
- [ ] Authority to Operate (ATO) for your environment
- [ ] Production .gov, .mil, or dedicated .com domain

---

## Step 1: Determine Service Level

Choose the appropriate Login.gov service level based on your application's requirements.

### Decision Tree

**Does your application require identity verification?**

- **No** → Use `urn:acr.login.gov:auth-only` (AAL2)
  - Email, password, and MFA only
  - Fastest user experience
  - Use for: General access, account creation, low-risk transactions

- **Yes, but facial match not required** → Use `urn:acr.login.gov:verified`
  - Email, password, MFA, plus identity proofing (driver's license, passport)
  - Does NOT meet NIST 800-63-3 IAL2
  - Use for: Moderate-risk applications

- **Yes, with facial match required** → Use `urn:acr.login.gov:verified-facial-match-required` (IAL2)
  - All of verified plus facial match biometric verification
  - Meets NIST 800-63-3 IAL2 standard
  - Use for: High-assurance applications (benefits, financial, controlled access)

### Document Your Decision

```markdown
## Authentication Requirements

**Service Level**: urn:acr.login.gov:auth-only

**Rationale**: This application provides general information and does not require identity verification. Users only need to authenticate to save preferences and track submissions.

**User Attributes Required**:
- Email address (for notifications)
- UUID (for account linking)

**NIST 800-63-3 Compliance**: AAL2
```

---

## Step 2: Set Up Sandbox Environment

### Create Sandbox Account

1. Navigate to https://dashboard.int.identitysandbox.gov/
2. Create a Login.gov sandbox account
3. Create a Team in the Partner Portal
4. Create an App within your Team

### Generate Public/Private Key Pair (for OIDC private_key_jwt)

```bash
# Generate 2048-bit RSA private key
openssl genrsa -out private_key.pem 2048

# Extract public certificate
openssl req -new -x509 -key private_key.pem -out public_cert.pem -days 365

# Convert to PKCS8 format (for some libraries)
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private_key.pem -out private_key_pkcs8.pem
```

### Upload Public Certificate

1. In Partner Portal, navigate to your App
2. Upload `public_cert.pem` to the "Public Certificate" field
3. Save configuration

### Configure Redirect URIs

Add your sandbox redirect URIs:
```
https://localhost:3000/auth/callback
https://dev.your-app.gov/auth/callback
```

---

## Step 3: Implement OIDC Integration

### Pattern A: Python / Flask

**Install Dependencies:**

```bash
pip install authlib cryptography flask-session
```

**Implementation:**

```python
import os
import secrets
import time
from datetime import datetime, timedelta
from flask import Flask, session, redirect, url_for, request, abort, jsonify
from authlib.integrations.flask_client import OAuth
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import jwt

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)

# Load private key
with open('private_key.pem', 'rb') as f:
    PRIVATE_KEY = serialization.load_pem_private_key(
        f.read(),
        password=None,
        backend=default_backend()
    )

# Configure OAuth
oauth = OAuth(app)

# Determine environment
LOGINGOV_ENV = os.getenv('LOGINGOV_ENV', 'sandbox')
if LOGINGOV_ENV == 'production':
    LOGINGOV_BASE = 'https://secure.login.gov'
else:
    LOGINGOV_BASE = 'https://idp.int.identitysandbox.gov'

# Register Login.gov OIDC provider
logingov = oauth.register(
    name='logingov',
    client_id=os.getenv('LOGINGOV_CLIENT_ID'),
    server_metadata_url=f'{LOGINGOV_BASE}/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
        'token_endpoint_auth_method': 'private_key_jwt',
        'token_endpoint_auth_signing_alg': 'RS256'
    }
)

def create_client_assertion():
    """Create JWT assertion for token endpoint"""
    now = int(time.time())
    
    claims = {
        'iss': os.getenv('LOGINGOV_CLIENT_ID'),
        'sub': os.getenv('LOGINGOV_CLIENT_ID'),
        'aud': f'{LOGINGOV_BASE}/api/openid_connect/token',
        'jti': secrets.token_urlsafe(32),
        'exp': now + 300,  # 5 minutes
        'iat': now
    }
    
    return jwt.encode(claims, PRIVATE_KEY, algorithm='RS256')

@app.route('/login')
def login():
    """Initiate Login.gov authentication"""
    redirect_uri = url_for('authorize', _external=True, _scheme='https')
    
    # Generate nonce and state for security
    nonce = secrets.token_urlsafe(32)
    state = secrets.token_urlsafe(32)
    
    # Store in session for validation
    session['nonce'] = nonce
    session['state'] = state
    
    # Choose service level based on application requirements
    service_level = os.getenv('LOGINGOV_SERVICE_LEVEL', 'urn:acr.login.gov:auth-only')
    
    return logingov.authorize_redirect(
        redirect_uri,
        nonce=nonce,
        state=state,
        acr_values=service_level,
        prompt='select_account'  # Optional: force account selection
    )

@app.route('/auth/callback')
def authorize():
    """Handle Login.gov callback"""
    
    # Check for errors
    if request.args.get('error'):
        error = request.args.get('error')
        error_description = request.args.get('error_description', '')
        
        if error == 'access_denied':
            return render_template('login_cancelled.html'), 401
        else:
            app.logger.error(f'Login.gov error: {error} - {error_description}')
            return render_template('login_error.html'), 500
    
    # Validate state parameter (CSRF protection)
    if request.args.get('state') != session.get('state'):
        abort(400, 'Invalid state parameter')
    
    try:
        # Exchange authorization code for token
        token = logingov.authorize_access_token(
            client_assertion_type='urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion=create_client_assertion()
        )
    except Exception as e:
        app.logger.error(f'Token exchange failed: {e}')
        return render_template('login_error.html'), 500
    
    # Validate nonce in ID token
    id_token = token.get('id_token')
    if not id_token or id_token.get('nonce') != session.get('nonce'):
        abort(400, 'Invalid nonce')
    
    # Get user info
    user_info = token.get('userinfo', {})
    
    # Create or update user in database
    from models import User, db
    
    user = User.query.filter_by(login_gov_sub=user_info['sub']).first()
    
    if not user:
        user = User(
            login_gov_sub=user_info['sub'],
            email=user_info['email'],
            email_verified=user_info.get('email_verified', False),
            given_name=user_info.get('given_name'),
            family_name=user_info.get('family_name'),
            created_at=datetime.utcnow()
        )
        db.session.add(user)
        app.logger.info(f'New user created: {user.login_gov_sub}')
    else:
        user.email = user_info['email']
        user.last_login = datetime.utcnow()
        app.logger.info(f'User logged in: {user.login_gov_sub}')
    
    db.session.commit()
    
    # Create session
    session.permanent = True
    session['user_id'] = user.id
    session['login_gov_sub'] = user.login_gov_sub
    session['email'] = user.email
    session['id_token'] = token.get('id_token_jwt')  # Store for logout
    
    # Clear security tokens
    session.pop('nonce', None)
    session.pop('state', None)
    
    return redirect(url_for('dashboard'))

@app.route('/logout')
def logout():
    """Logout from application and Login.gov"""
    id_token = session.get('id_token')
    
    # Clear local session
    session.clear()
    
    # Redirect to Login.gov logout
    if id_token:
        logout_url = (
            f'{LOGINGOV_BASE}/openid_connect/logout'
            f'?id_token_hint={id_token}'
            f'&post_logout_redirect_uri={url_for("index", _external=True, _scheme="https")}'
            f'&state={secrets.token_urlsafe(32)}'
        )
        return redirect(logout_url)
    
    return redirect(url_for('index'))

# Middleware: Require authentication
def login_required(f):
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/dashboard')
@login_required
def dashboard():
    """Protected route requiring authentication"""
    from models import User
    
    user = User.query.get(session['user_id'])
    return render_template('dashboard.html', user=user)
```

### Pattern B: Node.js / Express

**Install Dependencies:**

```bash
npm install express express-session passport passport-openidconnect jsonwebtoken
```

**Implementation:**

```javascript
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OpenIDConnectStrategy = require('passport-openidconnect').Strategy;
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// Load private key
const privateKey = fs.readFileSync('private_key.pem', 'utf8');

// Environment configuration
const LOGINGOV_ENV = process.env.LOGINGOV_ENV || 'sandbox';
const LOGINGOV_BASE = LOGINGOV_ENV === 'production'
  ? 'https://secure.login.gov'
  : 'https://idp.int.identitysandbox.gov';

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000  // 12 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Create client assertion
function createClientAssertion() {
  const now = Math.floor(Date.now() / 1000);
  
  const claims = {
    iss: process.env.LOGINGOV_CLIENT_ID,
    sub: process.env.LOGINGOV_CLIENT_ID,
    aud: `${LOGINGOV_BASE}/api/openid_connect/token`,
    jti: crypto.randomBytes(32).toString('hex'),
    exp: now + 300,
    iat: now
  };
  
  return jwt.sign(claims, privateKey, { algorithm: 'RS256' });
}

// Configure OIDC strategy
passport.use('logingov', new OpenIDConnectStrategy({
    issuer: LOGINGOV_BASE,
    authorizationURL: `${LOGINGOV_BASE}/openid_connect/authorize`,
    tokenURL: `${LOGINGOV_BASE}/api/openid_connect/token`,
    userInfoURL: `${LOGINGOV_BASE}/api/openid_connect/userinfo`,
    clientID: process.env.LOGINGOV_CLIENT_ID,
    callbackURL: 'https://your-app.gov/auth/callback',
    scope: ['openid', 'email', 'profile'],
    passReqToCallback: true
  },
  async (req, issuer, profile, context, idToken, accessToken, refreshToken, params, done) => {
    try {
      // Find or create user
      const { User } = require('./models');
      
      let user = await User.findOne({ where: { loginGovSub: profile.id } });
      
      if (!user) {
        user = await User.create({
          loginGovSub: profile.id,
          email: profile.emails[0].value,
          emailVerified: profile.emails[0].verified,
          givenName: profile.name?.givenName,
          familyName: profile.name?.familyName
        });
      } else {
        user.lastLogin = new Date();
        await user.save();
      }
      
      // Store ID token for logout
      req.session.idToken = params.id_token;
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const { User } = require('./models');
  const user = await User.findByPk(id);
  done(null, user);
});

// Routes
app.get('/login', (req, res, next) => {
  const serviceLevel = process.env.LOGINGOV_SERVICE_LEVEL || 'urn:acr.login.gov:auth-only';
  
  passport.authenticate('logingov', {
    acr_values: serviceLevel,
    prompt: 'select_account'
  })(req, res, next);
});

app.get('/auth/callback',
  passport.authenticate('logingov', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.get('/logout', (req, res) => {
  const idToken = req.session.idToken;
  
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    
    req.session.destroy(() => {
      if (idToken) {
        const logoutUrl = `${LOGINGOV_BASE}/openid_connect/logout` +
          `?id_token_hint=${idToken}` +
          `&post_logout_redirect_uri=${encodeURIComponent('https://your-app.gov')}` +
          `&state=${crypto.randomBytes(32).toString('hex')}`;
        
        res.redirect(logoutUrl);
      } else {
        res.redirect('/');
      }
    });
  });
});

// Middleware: Require authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.user });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Step 4: Implement User Data Management

### Database Schema

```sql
-- SQL Server schema
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    LoginGovSub NVARCHAR(255) NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL,
    EmailVerified BIT DEFAULT 0,
    GivenName NVARCHAR(255),
    FamilyName NVARCHAR(255),
    Birthdate DATE,
    PhoneNumber NVARCHAR(50),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    LastLogin DATETIME2,
    
    INDEX IX_Users_LoginGovSub (LoginGovSub)
);
```

### Minimal PII Storage

**Store only what you need:**

✅ **Always store:**
- `sub` (Login.gov UUID) — required for user identification
- `email` — for notifications

❌ **Avoid storing unless required:**
- SSN
- Birthdate
- Address
- Phone number

**If you must store sensitive PII:**
- Encrypt at rest using AES-256
- Use application-level encryption (not just database encryption)
- Document in Privacy Impact Assessment (PIA)

```python
# Example: Encrypt sensitive data before storing
from cryptography.fernet import Fernet

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    login_gov_sub = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), nullable=False)
    
    # Encrypted field
    _ssn_encrypted = db.Column('ssn_encrypted', db.LargeBinary)
    
    @property
    def ssn(self):
        if self._ssn_encrypted:
            cipher = Fernet(app.config['ENCRYPTION_KEY'])
            return cipher.decrypt(self._ssn_encrypted).decode()
        return None
    
    @ssn.setter
    def ssn(self, value):
        if value:
            cipher = Fernet(app.config['ENCRYPTION_KEY'])
            self._ssn_encrypted = cipher.encrypt(value.encode())
        else:
            self._ssn_encrypted = None
```

---

## Step 5: Implement Security Controls

### Token Validation

```python
def validate_id_token(id_token_jwt):
    """Validate Login.gov ID token"""
    import jwt
    from jwt import PyJWKClient
    
    # Get signing keys from JWKS endpoint
    jwks_url = f'{LOGINGOV_BASE}/api/openid_connect/certs'
    jwks_client = PyJWKClient(jwks_url)
    
    try:
        # Get signing key
        signing_key = jwks_client.get_signing_key_from_jwt(id_token_jwt)
        
        # Decode and validate token
        payload = jwt.decode(
            id_token_jwt,
            signing_key.key,
            algorithms=["RS256"],
            audience=os.getenv('LOGINGOV_CLIENT_ID'),
            issuer=LOGINGOV_BASE
        )
        
        # Validate nonce
        if payload.get('nonce') != session.get('nonce'):
            raise ValueError('Invalid nonce')
        
        # Validate issued-at time (reject if >5 minutes old)
        now = int(time.time())
        if now - payload.get('iat', 0) > 300:
            raise ValueError('Token issued too long ago')
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")
```

### Session Management

```python
# Configure session timeouts
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)  # Absolute timeout
app.config['SESSION_REFRESH_EACH_REQUEST'] = True  # Reset inactivity timer

# Middleware: Check session timeout
@app.before_request
def check_session_timeout():
    if 'user_id' in session:
        last_activity = session.get('last_activity')
        
        if last_activity:
            # Check inactivity timeout (30 minutes)
            if datetime.utcnow() - last_activity > timedelta(minutes=30):
                session.clear()
                flash('Your session has expired due to inactivity.')
                return redirect(url_for('login'))
        
        # Update last activity
        session['last_activity'] = datetime.utcnow()
```

---

## Step 6: Test in Sandbox

### Test Checklist

- [ ] **Successful authentication** with auth-only service level
- [ ] **Token validation** (signature, nonce, state, expiration)
- [ ] **User creation** on first login
- [ ] **User update** on subsequent logins
- [ ] **Session management** (timeout, persistence)
- [ ] **Logout** (local and Login.gov)
- [ ] **Error handling** (access_denied, invalid_request, server_error)
- [ ] **CSRF protection** (state parameter validation)
- [ ] **Replay protection** (nonce parameter validation)
- [ ] **Security headers** (CSP, HSTS, X-Frame-Options)

### Test Scenarios

**Scenario 1: New user registration**
1. Navigate to `/login`
2. Click "Create an account" on Login.gov
3. Complete registration with email and MFA
4. Verify redirect to dashboard
5. Verify user created in database

**Scenario 2: Returning user login**
1. Navigate to `/login`
2. Sign in with existing Login.gov account
3. Verify redirect to dashboard
4. Verify `last_login` updated in database

**Scenario 3: User cancels login**
1. Navigate to `/login`
2. Click "Cancel" on Login.gov
3. Verify error message displayed
4. Verify no session created

**Scenario 4: Session timeout**
1. Log in successfully
2. Wait 31 minutes (inactivity timeout)
3. Attempt to access protected route
4. Verify redirect to login page

**Scenario 5: Logout**
1. Log in successfully
2. Click "Logout"
3. Verify session cleared
4. Verify redirect to Login.gov logout
5. Verify redirect back to home page

---

## Step 7: Prepare for Production

### Production Configuration Checklist

- [ ] **IAA signed** and integration listed
- [ ] **ATO approved** for production environment
- [ ] **Production domain** (.gov, .mil, or dedicated .com)
- [ ] **SSL/TLS certificate** valid and trusted
- [ ] **Redirect URIs** use HTTPS only
- [ ] **Public certificate** uploaded to Partner Portal (OIDC)
- [ ] **Agency logo** provided (PNG/SVG, 1:1 aspect ratio, transparent background)
- [ ] **Privacy policy** published and URL provided
- [ ] **Terms of service** published and URL provided
- [ ] **Failure to proof URL** configured (if requesting verified attributes)
- [ ] **Production environment variables** configured
- [ ] **Security logging** enabled
- [ ] **Monitoring** configured (sign-in success/failure rates)

### Create Production App Configuration

1. Log in to Login.gov Partner Portal (production)
2. Create new Team (if not exists)
3. Create new App configuration
4. Configure:
   - **App name**: Your application name
   - **Protocol**: OpenID Connect
   - **Redirect URIs**: Production URLs only
   - **Service level**: Choose appropriate level
   - **Attribute bundle**: Minimal required attributes
   - **Agency logo**: Upload logo
   - **Privacy policy URL**: Your privacy policy
   - **Terms of service URL**: Your terms of service
5. Upload production public certificate
6. Save configuration

### Submit Launch Request

1. Navigate to Partner Support Help Desk
2. Submit launch request with:
   - IAA number (GTC-Order-Mod format)
   - App configuration ID
   - Requested go-live date (allow 2+ weeks)
   - Technical contact information
3. Wait for Login.gov team review
4. Address any feedback
5. Receive production approval

---

## Step 8: Deploy to Production

### Pre-Deployment Checklist

- [ ] All sandbox tests passing
- [ ] Production configuration approved by Login.gov
- [ ] Environment variables configured for production
- [ ] Private key secured (not in version control)
- [ ] Database schema deployed
- [ ] Security logging enabled
- [ ] Monitoring dashboards configured
- [ ] Incident response plan documented
- [ ] User documentation prepared

### Deployment Steps

1. **Deploy application** to production environment
2. **Configure environment variables**:
   ```bash
   LOGINGOV_ENV=production
   LOGINGOV_CLIENT_ID=your-production-client-id
   LOGINGOV_SERVICE_LEVEL=urn:acr.login.gov:auth-only
   SECRET_KEY=your-production-secret-key
   DATABASE_URL=your-production-database-url
   ```
3. **Test authentication** with production Login.gov
4. **Monitor logs** for errors
5. **Verify user creation** in production database
6. **Test logout** functionality
7. **Verify security headers** in production

### Post-Deployment Monitoring

**Monitor these metrics:**
- Authentication success rate (target: >95%)
- Authentication failure rate (investigate if >5%)
- Average authentication time (target: <3 seconds)
- Session timeout rate
- Logout success rate

**Set up alerts for:**
- Authentication failure rate >10%
- Login.gov service errors
- Token validation failures
- Session management errors

---

## Step 9: Document and Train

### User Documentation

Create user-facing documentation:

**"How to Sign In"**
1. Click "Sign In" button
2. You will be redirected to Login.gov
3. Sign in with your Login.gov account (or create one)
4. Complete multi-factor authentication
5. You will be redirected back to [Your App]

**"How to Create a Login.gov Account"**
1. Click "Sign In" button
2. Click "Create an account" on Login.gov
3. Enter your email address
4. Create a strong password
5. Set up multi-factor authentication (phone, authenticator app, or security key)
6. You will be redirected back to [Your App]

### Technical Documentation

Document in your System Security Plan (SSP):

**Authentication Method**: Login.gov OIDC
**Service Level**: [auth-only / verified / verified-facial-match-required]
**NIST 800-63-3 Compliance**: AAL2 [and IAL2 if verified-facial-match-required]
**User Attributes Collected**: [list attributes]
**PII Storage**: [describe what PII is stored and why]
**Session Management**: 30-minute inactivity timeout, 12-hour absolute timeout
**Logout**: Local session cleared, Login.gov logout initiated

---

## Common Issues and Solutions

### Issue 1: "Invalid client assertion"

**Cause**: JWT assertion signature invalid or expired

**Solution**:
- Verify private key matches public certificate uploaded to Partner Portal
- Verify JWT claims (iss, sub, aud, exp, iat)
- Verify JWT algorithm is RS256
- Ensure system clock is synchronized (NTP)

### Issue 2: "Invalid nonce"

**Cause**: Nonce in ID token doesn't match session nonce

**Solution**:
- Verify nonce is generated and stored in session before redirect
- Verify nonce is retrieved from session and compared to ID token
- Check session configuration (cookies must persist across requests)

### Issue 3: "Invalid state parameter"

**Cause**: State parameter doesn't match session state

**Solution**:
- Verify state is generated and stored in session before redirect
- Verify state is retrieved from session and compared to callback parameter
- Check for session fixation attacks (regenerate session ID after login)

### Issue 4: "User cancelled login" (access_denied error)

**Cause**: User clicked "Cancel" on Login.gov or failed identity verification

**Solution**:
- Display user-friendly message: "Login cancelled. Please try again."
- Provide link to try again or contact support
- Do not create user account or session

### Issue 5: "Token expired"

**Cause**: ID token or access token expired

**Solution**:
- Verify token expiration (exp claim)
- Implement token refresh if needed
- Redirect user to re-authenticate if token cannot be refreshed

---

## Security Best Practices

1. **Never log sensitive data**: Do not log tokens, nonces, or PII
2. **Use HTTPS everywhere**: All redirect URIs must use HTTPS
3. **Validate all tokens**: Always validate signature, issuer, audience, expiration
4. **Implement CSRF protection**: Always validate state parameter
5. **Implement replay protection**: Always validate nonce parameter
6. **Secure private key**: Never commit private key to version control
7. **Rotate keys regularly**: Rotate private keys every 90 days
8. **Monitor for anomalies**: Alert on high failure rates or unusual patterns
9. **Implement rate limiting**: Prevent brute force attacks on callback endpoint
10. **Follow least privilege**: Request only necessary user attributes

---

## What to Do When Uncertain

- If unsure about service level, **start with auth-only** and upgrade later
- If unsure about user attributes, **request only email** and add more later if approved
- If Login.gov integration is blocked, **consult your agency IAA contact**
- For technical questions, **submit ticket to Login.gov Partner Support**
- For security questions, **consult your agency security team**
