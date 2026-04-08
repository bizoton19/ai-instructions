# Internal Authentication Implementation

**Trigger**: Use when the user asks to implement authentication for an internal federal application, mentions Azure AD / Entra ID, SSO, SAML, PIV/CAC, or needs to set up authentication for federal employees.

**Description**: This skill provides a comprehensive, step-by-step workflow for implementing Microsoft Entra ID (Azure AD) authentication for U.S. federal government internal applications, covering OIDC/SAML integration, PIV/CAC support, Conditional Access, group-based authorization, and Azure Government cloud deployment.

---

## When to Use This Skill

- User asks to "implement Azure AD authentication" or "Entra ID SSO"
- User mentions "internal authentication" or "federal employee login"
- User asks to "integrate SAML for enterprise app"
- User needs to implement PIV/CAC smartcard authentication
- User asks about Conditional Access or MFA for internal apps
- User mentions Azure Government (GCC, GCC High, DoD)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Access to Microsoft Entra ID admin center for your tenant
- [ ] Understanding of your Azure Government cloud environment (GCC, GCC High, or DoD)
- [ ] Application Administrator or Cloud Application Administrator role in Entra ID
- [ ] Understanding of the application's authorization requirements (roles, groups)
- [ ] Authority to Operate (ATO) for your environment

---

## Step 1: Determine Azure Government Cloud Environment

Choose the appropriate Azure Government cloud based on your agency and data classification.

### Decision Tree

**What type of agency and data classification?**

- **Federal civilian agencies, non-CUI data** → Use **GCC** (Government Community Cloud)
  - Endpoint: `login.microsoftonline.com`
  - FedRAMP High authorized
  - Use for: General federal applications, non-sensitive data

- **DoD, federal agencies with CUI (Controlled Unclassified Information)** → Use **GCC High**
  - Endpoint: `login.microsoftonline.us`
  - FedRAMP High authorized, ITAR compliant
  - Use for: CUI, ITAR-controlled data, defense-related applications

- **Department of Defense, IL5 data** → Use **DoD**
  - Endpoint: `login.microsoftonline.us`
  - DoD IL5 authorized
  - Use for: DoD-specific applications, classified up to IL5

### Document Your Decision

```markdown
## Authentication Environment

**Cloud Environment**: GCC High
**Tenant ID**: [your-tenant-id]
**Entra ID Endpoint**: https://login.microsoftonline.us
**Rationale**: This application handles CUI data and is used by DoD personnel.

**Authentication Method**: OIDC (OpenID Connect)
**MFA Requirement**: Required for all users via Conditional Access
**PIV/CAC Support**: Required for federal employees
```

---

## Step 2: Register Application in Entra ID

### Create App Registration

1. Navigate to **Entra ID admin center** (portal.azure.us for GCC High/DoD)
2. Go to **Entra ID** > **App registrations** > **New registration**
3. Configure:
   - **Name**: Your application name (e.g., "Federal Document System")
   - **Supported account types**: "Accounts in this organizational directory only (single tenant)"
   - **Redirect URI**: 
     - Platform: Web
     - URI: `https://your-app.gov/auth/callback`
4. Click **Register**

### Configure Authentication

1. In your app registration, go to **Authentication**
2. Add additional redirect URIs if needed:
   ```
   https://your-app.gov/auth/callback
   https://localhost:3000/auth/callback  (for local development)
   ```
3. Configure **Front-channel logout URL**: `https://your-app.gov/logout`
4. Under **Implicit grant and hybrid flows**, leave all unchecked (use authorization code flow)
5. Under **Advanced settings**:
   - Allow public client flows: No
   - Enable the following mobile and desktop flows: No
6. Click **Save**

### Create Client Secret or Certificate

**Option A: Client Secret (simpler, less secure)**

1. Go to **Certificates & secrets** > **Client secrets** > **New client secret**
2. Description: "Production secret"
3. Expires: 90 days (rotate regularly)
4. Click **Add**
5. **Copy the secret value immediately** (you won't see it again)
6. Store in secure key vault (Azure Key Vault, AWS Secrets Manager)

**Option B: Certificate (recommended for production)**

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout private_key.pem -out certificate.pem -days 365 -nodes

# Convert to PFX format (for upload)
openssl pkcs12 -export -out certificate.pfx -inkey private_key.pem -in certificate.pem
```

1. Go to **Certificates & secrets** > **Certificates** > **Upload certificate**
2. Upload `certificate.pem`
3. Click **Add**

### Configure API Permissions

1. Go to **API permissions** > **Add a permission**
2. Select **Microsoft Graph** > **Delegated permissions**
3. Add permissions:
   - `User.Read` — Read user profile
   - `GroupMember.Read.All` — Read group membership (if using group-based authorization)
4. Click **Add permissions**
5. Click **Grant admin consent for [Your Organization]**

### Configure Token Configuration (Optional)

1. Go to **Token configuration** > **Add groups claim**
2. Select **Security groups**
3. Choose **Group ID** (recommended) or **sAMAccountName** (legacy)
4. Click **Add**

---

## Step 3: Implement OIDC Integration

### Pattern A: Python / Flask

**Install Dependencies:**

```bash
pip install msal flask-session requests
```

**Implementation:**

```python
import os
import secrets
from datetime import datetime, timedelta
from flask import Flask, session, redirect, url_for, request, abort
import msal

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)

# Azure AD configuration
TENANT_ID = os.getenv('AZURE_TENANT_ID')
CLIENT_ID = os.getenv('AZURE_CLIENT_ID')
CLIENT_SECRET = os.getenv('AZURE_CLIENT_SECRET')

# Determine authority based on cloud environment
CLOUD_ENV = os.getenv('AZURE_CLOUD_ENV', 'gcc')  # gcc, gcc-high, or dod
if CLOUD_ENV in ['gcc-high', 'dod']:
    AUTHORITY = f'https://login.microsoftonline.us/{TENANT_ID}'
else:
    AUTHORITY = f'https://login.microsoftonline.com/{TENANT_ID}'

SCOPE = ['User.Read', 'GroupMember.Read.All']
REDIRECT_URI = 'https://your-app.gov/auth/callback'

def get_msal_app():
    """Create MSAL confidential client application"""
    return msal.ConfidentialClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET
    )

@app.route('/login')
def login():
    """Initiate Azure AD authentication"""
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    session['state'] = state
    
    # Get MSAL app
    msal_app = get_msal_app()
    
    # Get authorization URL
    auth_url = msal_app.get_authorization_request_url(
        SCOPE,
        state=state,
        redirect_uri=REDIRECT_URI
    )
    
    return redirect(auth_url)

@app.route('/auth/callback')
def authorize():
    """Handle Azure AD callback"""
    
    # Check for errors
    if request.args.get('error'):
        error = request.args.get('error')
        error_description = request.args.get('error_description', '')
        app.logger.error(f'Azure AD error: {error} - {error_description}')
        return render_template('login_error.html'), 500
    
    # Validate state parameter (CSRF protection)
    if request.args.get('state') != session.get('state'):
        abort(400, 'Invalid state parameter')
    
    # Get authorization code
    code = request.args.get('code')
    if not code:
        abort(400, 'Missing authorization code')
    
    try:
        # Exchange authorization code for token
        msal_app = get_msal_app()
        result = msal_app.acquire_token_by_authorization_code(
            code,
            scopes=SCOPE,
            redirect_uri=REDIRECT_URI
        )
        
        if 'error' in result:
            app.logger.error(f'Token acquisition failed: {result.get("error_description")}')
            return render_template('login_error.html'), 500
        
        # Get user info from ID token
        id_token_claims = result.get('id_token_claims', {})
        
        # Create or update user in database
        from models import User, db
        
        user = User.query.filter_by(azure_ad_oid=id_token_claims['oid']).first()
        
        if not user:
            user = User(
                azure_ad_oid=id_token_claims['oid'],
                upn=id_token_claims.get('preferred_username'),
                email=id_token_claims.get('email'),
                display_name=id_token_claims.get('name'),
                given_name=id_token_claims.get('given_name'),
                surname=id_token_claims.get('family_name'),
                created_at=datetime.utcnow()
            )
            db.session.add(user)
            app.logger.info(f'New user created: {user.azure_ad_oid}')
        else:
            user.last_login = datetime.utcnow()
            app.logger.info(f'User logged in: {user.azure_ad_oid}')
        
        db.session.commit()
        
        # Create session
        session.permanent = True
        session['user_id'] = user.id
        session['azure_ad_oid'] = user.azure_ad_oid
        session['upn'] = user.upn
        session['display_name'] = user.display_name
        
        # Store groups if included in token
        session['groups'] = id_token_claims.get('groups', [])
        
        # Store access token for Graph API calls
        session['access_token'] = result.get('access_token')
        
        # Clear state
        session.pop('state', None)
        
        return redirect(url_for('dashboard'))
        
    except Exception as e:
        app.logger.error(f'Authentication failed: {e}')
        return render_template('login_error.html'), 500

@app.route('/logout')
def logout():
    """Logout from application and Azure AD"""
    
    # Clear local session
    session.clear()
    
    # Redirect to Azure AD logout
    logout_url = (
        f'{AUTHORITY}/oauth2/v2.0/logout'
        f'?post_logout_redirect_uri={url_for("index", _external=True, _scheme="https")}'
    )
    
    return redirect(logout_url)

# Middleware: Require authentication
def login_required(f):
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    
    return decorated_function

# Middleware: Require role
def require_role(role):
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_roles = session.get('roles', [])
            if role not in user_roles:
                abort(403, f'Access denied: {role} role required')
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Middleware: Require group membership
def require_group(group_id):
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_groups = session.get('groups', [])
            if group_id not in user_groups:
                abort(403, 'Access denied: Required group membership missing')
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/dashboard')
@login_required
def dashboard():
    """Protected route requiring authentication"""
    from models import User
    
    user = User.query.get(session['user_id'])
    return render_template('dashboard.html', user=user)

@app.route('/admin')
@login_required
@require_group(os.getenv('ADMIN_GROUP_ID'))
def admin_dashboard():
    """Protected route requiring admin group membership"""
    return render_template('admin.html')
```

### Pattern B: Node.js / Express

**Install Dependencies:**

```bash
npm install express express-session passport passport-azure-ad
```

**Implementation:**

```javascript
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;

const app = express();

// Azure AD configuration
const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

// Determine authority based on cloud environment
const CLOUD_ENV = process.env.AZURE_CLOUD_ENV || 'gcc';
const AUTHORITY_BASE = (CLOUD_ENV === 'gcc-high' || CLOUD_ENV === 'dod')
  ? 'https://login.microsoftonline.us'
  : 'https://login.microsoftonline.com';

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

// Configure OIDC strategy
passport.use(new OIDCStrategy({
    identityMetadata: `${AUTHORITY_BASE}/${TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    responseType: 'code',
    responseMode: 'form_post',
    redirectUrl: 'https://your-app.gov/auth/callback',
    allowHttpForRedirectUrl: false,
    validateIssuer: true,
    issuer: `${AUTHORITY_BASE}/${TENANT_ID}/v2.0`,
    passReqToCallback: false,
    scope: ['openid', 'profile', 'email', 'User.Read'],
    loggingLevel: 'info'
  },
  async (iss, sub, profile, accessToken, refreshToken, done) => {
    try {
      const { User } = require('./models');
      
      // Find or create user
      let user = await User.findOne({ where: { azureAdOid: profile.oid } });
      
      if (!user) {
        user = await User.create({
          azureAdOid: profile.oid,
          upn: profile.upn,
          email: profile.email,
          displayName: profile.displayName,
          givenName: profile.name?.givenName,
          surname: profile.name?.familyName
        });
      } else {
        user.lastLogin = new Date();
        await user.save();
      }
      
      // Attach groups to user object
      user.groups = profile._json.groups || [];
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, { id: user.id, groups: user.groups });
});

passport.deserializeUser(async (sessionUser, done) => {
  const { User } = require('./models');
  const user = await User.findByPk(sessionUser.id);
  user.groups = sessionUser.groups;
  done(null, user);
});

// Routes
app.get('/login',
  passport.authenticate('azuread-openidconnect', {
    failureRedirect: '/',
    failureFlash: true
  })
);

app.post('/auth/callback',
  passport.authenticate('azuread-openidconnect', {
    failureRedirect: '/',
    failureFlash: true
  }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    
    req.session.destroy(() => {
      const logoutUrl = `${AUTHORITY_BASE}/${TENANT_ID}/oauth2/v2.0/logout` +
        `?post_logout_redirect_uri=${encodeURIComponent('https://your-app.gov')}`;
      
      res.redirect(logoutUrl);
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

// Middleware: Require group membership
function requireGroup(groupId) {
  return (req, res, next) => {
    if (!req.user || !req.user.groups || !req.user.groups.includes(groupId)) {
      return res.status(403).send('Access denied: Required group membership missing');
    }
    next();
  };
}

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.user });
});

app.get('/admin', ensureAuthenticated, requireGroup(process.env.ADMIN_GROUP_ID), (req, res) => {
  res.render('admin', { user: req.user });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Step 4: Implement SAML Integration (Alternative)

### Pattern: Java / Spring Boot

**Add Dependencies (pom.xml):**

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-saml2-service-provider</artifactId>
</dependency>
```

**Configure SAML (application.yml):**

```yaml
spring:
  security:
    saml2:
      relyingparty:
        registration:
          azure-ad:
            assertingparty:
              metadata-uri: https://login.microsoftonline.us/${TENANT_ID}/federationmetadata/2007-06/federationmetadata.xml
            entity-id: https://your-app.gov
            acs:
              location: https://your-app.gov/login/saml2/sso/azure-ad
              binding: POST
            singlelogout:
              url: https://your-app.gov/logout/saml2/slo
              response-url: https://your-app.gov/logout/saml2/slo
              binding: POST
```

**Security Configuration:**

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {
    
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
            .authorizeRequests()
                .antMatchers("/", "/login/**").permitAll()
                .anyRequest().authenticated()
            .and()
            .saml2Login()
                .loginPage("/login")
            .and()
            .saml2Logout();
    }
    
    @Bean
    public UserDetailsService userDetailsService() {
        return new Saml2UserDetailsService();
    }
}

@Service
public class Saml2UserDetailsService implements UserDetailsService {
    
    @Autowired
    private UserRepository userRepository;
    
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Load user from database
        User user = userRepository.findByUpn(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        
        return org.springframework.security.core.userdetails.User
            .withUsername(user.getUpn())
            .password("")  // No password for SAML
            .authorities(user.getRoles())
            .build();
    }
}
```

---

## Step 5: Implement PIV/CAC Authentication

### Enable Certificate-Based Authentication in Entra ID

1. Navigate to **Entra ID** > **Security** > **Authentication methods**
2. Click **Certificate-based authentication**
3. Click **Enable**
4. Configure certificate authorities:
   - Upload DoD root CA certificates
   - Configure certificate validation rules
5. Map certificate fields to user attributes:
   - **Principal Name**: UPN
   - **Subject**: Email
6. Click **Save**

### Configure Application for Certificate Authentication

**ASP.NET Core Example:**

```csharp
// Startup.cs or Program.cs
services.AddAuthentication(CertificateAuthenticationDefaults.AuthenticationScheme)
    .AddCertificate(options =>
    {
        options.AllowedCertificateTypes = CertificateTypes.All;
        options.ValidateCertificateUse = true;
        options.RevocationMode = X509RevocationMode.Online;
        
        options.Events = new CertificateAuthenticationEvents
        {
            OnCertificateValidated = context =>
            {
                // Extract PIV/CAC certificate details
                var cert = context.ClientCertificate;
                
                // Extract UPN from certificate
                var upn = cert.GetNameInfo(X509NameType.UpnName, false);
                
                if (string.IsNullOrEmpty(upn))
                {
                    context.Fail("UPN not found in certificate");
                    return Task.CompletedTask;
                }
                
                // Find or create user
                var user = _userService.GetByUpn(upn);
                
                if (user == null)
                {
                    context.Fail("User not found");
                    return Task.CompletedTask;
                }
                
                // Create claims
                var claims = new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.DisplayName),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim("upn", upn),
                    new Claim("piv_authenticated", "true")
                };
                
                context.Principal = new ClaimsPrincipal(
                    new ClaimsIdentity(claims, context.Scheme.Name));
                context.Success();
                
                return Task.CompletedTask;
            },
            OnAuthenticationFailed = context =>
            {
                context.Fail($"Certificate validation failed: {context.Exception.Message}");
                return Task.CompletedTask;
            }
        };
    });
```

---

## Step 6: Configure App Roles and Groups

### Define App Roles in Manifest

1. Go to **App registrations** > your app > **Manifest**
2. Add `appRoles`:

```json
{
  "appRoles": [
    {
      "allowedMemberTypes": ["User"],
      "description": "Administrators have full access to all features",
      "displayName": "Administrator",
      "id": "unique-guid-1",
      "isEnabled": true,
      "value": "Admin"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Reviewers can review and approve submissions",
      "displayName": "Reviewer",
      "id": "unique-guid-2",
      "isEnabled": true,
      "value": "Reviewer"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Users can submit and view their own data",
      "displayName": "User",
      "id": "unique-guid-3",
      "isEnabled": true,
      "value": "User"
    }
  ]
}
```

3. Click **Save**

### Assign Users to Roles

1. Go to **Enterprise applications** > your app
2. Go to **Users and groups** > **Add user/group**
3. Select users or groups
4. Select role
5. Click **Assign**

### Check Roles in Application

```python
# Python example
from functools import wraps
from flask import abort, session

def require_role(role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_roles = session.get('roles', [])
            if role not in user_roles:
                abort(403, f'Access denied: {role} role required')
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/admin')
@login_required
@require_role('Admin')
def admin_dashboard():
    return render_template('admin.html')
```

---

## Step 7: Configure Conditional Access Policies

### Create Conditional Access Policy

1. Navigate to **Entra ID** > **Security** > **Conditional Access**
2. Click **New policy**
3. Configure:
   - **Name**: "Require MFA for [Your App]"
   - **Users**: All users (or specific groups)
   - **Cloud apps**: Select your application
   - **Conditions**: Configure as needed (location, device, risk)
   - **Grant**: Require multi-factor authentication
4. **Enable policy**: On
5. Click **Create**

### Recommended Policies

**Policy 1: Require MFA**
- Users: All users
- Cloud apps: Your application
- Grant: Require MFA

**Policy 2: Require Compliant Device**
- Users: All users
- Cloud apps: Your application
- Grant: Require device to be marked as compliant

**Policy 3: Block Legacy Authentication**
- Users: All users
- Cloud apps: All cloud apps
- Conditions: Client apps > Exchange ActiveSync clients, Other clients
- Grant: Block access

**Policy 4: Require Approved Client App (Mobile)**
- Users: All users
- Cloud apps: Your application
- Conditions: Device platforms > iOS, Android
- Grant: Require approved client app

---

## Step 8: Integrate with Microsoft Graph API

### Get User Profile and Groups

```python
# Python example using requests
import requests

def get_user_profile(access_token, user_id):
    """Get user profile from Microsoft Graph"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    # Determine Graph endpoint based on cloud
    if CLOUD_ENV in ['gcc-high', 'dod']:
        graph_endpoint = 'https://graph.microsoft.us'
    else:
        graph_endpoint = 'https://graph.microsoft.com'
    
    response = requests.get(
        f'{graph_endpoint}/v1.0/users/{user_id}',
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f'Graph API error: {response.text}')

def get_user_groups(access_token, user_id):
    """Get user's group membership from Microsoft Graph"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    if CLOUD_ENV in ['gcc-high', 'dod']:
        graph_endpoint = 'https://graph.microsoft.us'
    else:
        graph_endpoint = 'https://graph.microsoft.com'
    
    response = requests.get(
        f'{graph_endpoint}/v1.0/users/{user_id}/memberOf',
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json().get('value', [])
    else:
        raise Exception(f'Graph API error: {response.text}')
```

---

## Step 9: Test Authentication

### Test Checklist

- [ ] **Successful authentication** with Entra ID
- [ ] **User creation** on first login
- [ ] **User update** on subsequent logins
- [ ] **Group membership** retrieved and stored
- [ ] **Role-based authorization** working
- [ ] **Session management** (timeout, persistence)
- [ ] **Logout** (local and Entra ID)
- [ ] **Conditional Access** policies enforced
- [ ] **PIV/CAC authentication** (if enabled)
- [ ] **Error handling** (authentication failures, token errors)

### Test Scenarios

**Scenario 1: New user login**
1. Navigate to `/login`
2. Sign in with Entra ID credentials
3. Complete MFA if required
4. Verify redirect to dashboard
5. Verify user created in database

**Scenario 2: Returning user login**
1. Navigate to `/login`
2. Sign in with existing Entra ID account
3. Verify redirect to dashboard
4. Verify `last_login` updated in database

**Scenario 3: Role-based access control**
1. Log in as user with "Admin" role
2. Access `/admin` route
3. Verify access granted
4. Log out and log in as user without "Admin" role
5. Access `/admin` route
6. Verify access denied (403)

**Scenario 4: Conditional Access enforcement**
1. Configure Conditional Access policy requiring MFA
2. Log in
3. Verify MFA prompt appears
4. Complete MFA
5. Verify access granted

**Scenario 5: PIV/CAC authentication**
1. Insert PIV/CAC smartcard
2. Navigate to `/login`
3. Select certificate when prompted
4. Verify authentication successful
5. Verify `piv_authenticated` claim present

---

## Step 10: Deploy to Production

### Pre-Deployment Checklist

- [ ] Application registered in correct Entra ID tenant (GCC, GCC High, or DoD)
- [ ] Redirect URIs use HTTPS only
- [ ] Client secret or certificate configured and secured in key vault
- [ ] API permissions configured and admin consent granted
- [ ] App roles defined and users assigned
- [ ] Conditional Access policies configured and tested
- [ ] PIV/CAC authentication enabled (if required)
- [ ] Token validation implemented
- [ ] Session management configured
- [ ] Logout implemented (local and Entra ID)
- [ ] Error handling implemented
- [ ] Security logging enabled
- [ ] Sign-in logs monitored
- [ ] ATO approved for production environment

### Environment Variables

```bash
# Production environment variables
AZURE_CLOUD_ENV=gcc-high
AZURE_TENANT_ID=your-production-tenant-id
AZURE_CLIENT_ID=your-production-client-id
AZURE_CLIENT_SECRET=  # Store in Azure Key Vault
SECRET_KEY=  # Store in Azure Key Vault
DATABASE_URL=  # Store in Azure Key Vault
ADMIN_GROUP_ID=your-admin-group-id
```

### Monitoring

**Monitor these metrics:**
- Authentication success rate (target: >98%)
- Authentication failure rate (investigate if >2%)
- Average authentication time (target: <2 seconds)
- Conditional Access policy blocks
- Token validation failures

**Set up alerts for:**
- Authentication failure rate >5%
- Conditional Access policy blocks spike
- Token validation failures
- Session management errors

---

## Common Issues and Solutions

### Issue 1: "AADSTS50011: The reply URL specified in the request does not match"

**Cause**: Redirect URI in request doesn't match registered redirect URIs

**Solution**:
- Verify redirect URI in app registration matches exactly (including trailing slash)
- Ensure HTTPS is used (not HTTP)
- Check for typos in domain name

### Issue 2: "AADSTS65001: The user or administrator has not consented"

**Cause**: Admin consent not granted for API permissions

**Solution**:
- Go to **API permissions** in app registration
- Click **Grant admin consent for [Your Organization]**
- Verify consent granted for all permissions

### Issue 3: "AADSTS50105: The signed in user is not assigned to a role"

**Cause**: User not assigned to application

**Solution**:
- Go to **Enterprise applications** > your app > **Users and groups**
- Click **Add user/group**
- Assign user to appropriate role

### Issue 4: "Conditional Access policy blocks access"

**Cause**: User doesn't meet Conditional Access requirements (MFA, compliant device, etc.)

**Solution**:
- Review Conditional Access policy requirements
- Ensure user has completed MFA enrollment
- Ensure device is compliant (if required)
- Check sign-in logs for specific block reason

### Issue 5: "Token validation failed"

**Cause**: Token signature invalid, expired, or issuer mismatch

**Solution**:
- Verify token issuer matches expected authority
- Verify token audience matches client ID
- Check token expiration (exp claim)
- Verify JWKS endpoint accessible

---

## Security Best Practices

1. **Use certificates instead of secrets** for production (more secure, no expiration surprises)
2. **Rotate secrets/certificates regularly** (every 90 days)
3. **Store secrets in key vault** (Azure Key Vault, AWS Secrets Manager)
4. **Enable Conditional Access** (require MFA, compliant devices)
5. **Monitor sign-in logs** (alert on anomalies, failed authentications)
6. **Implement role-based access control** (use Entra ID groups and app roles)
7. **Validate all tokens** (signature, issuer, audience, expiration)
8. **Use HTTPS everywhere** (all redirect URIs must use HTTPS)
9. **Implement session timeouts** (30-minute inactivity, 12-hour absolute)
10. **Log authentication events** (success, failure, authorization decisions)

---

## What to Do When Uncertain

- If unsure about cloud environment, **ask your agency IT team** (GCC, GCC High, or DoD)
- If unsure about OIDC vs SAML, **use OIDC** for new applications (more modern, better support)
- If unsure about PIV/CAC requirement, **assume it's required** for federal employees
- If unsure about Conditional Access policies, **consult your security team**
- For technical questions, **reference Microsoft Entra ID documentation** or submit Azure support ticket
- For authorization strategy, **start with group-based** and add app roles if needed
