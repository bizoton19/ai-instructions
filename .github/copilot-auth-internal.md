# Federal Internal Authentication — AI Agent Standards

You are building a U.S. federal government internal application for federal employees and contractors. Authentication is strictly regulated.

---

## 1. Azure AD / Entra ID — Mandatory for Internal Authentication

**Microsoft Entra ID (formerly Azure AD) is the required identity provider for federal internal applications.**

### Why Entra ID?

- **FedRAMP High authorized** in Azure Government clouds (GCC, GCC High, DoD)
- **Centralized identity** — single sign-on across all federal applications
- **PIV/CAC support** — smartcard authentication for federal employees
- **Conditional Access** — enforce MFA, device compliance, location policies
- **Seamless integration** with Microsoft 365, Azure services, and on-premises Active Directory

### Azure Government Cloud Environments

| Environment | Use Case | FedRAMP Level | Entra ID Endpoint |
|-------------|----------|---------------|-------------------|
| **GCC** | Federal civilian agencies | FedRAMP High | `login.microsoftonline.com` |
| **GCC High** | DoD, federal agencies with CUI | FedRAMP High | `login.microsoftonline.us` |
| **DoD** | Department of Defense | DoD IL5 | `login.microsoftonline.us` |

### When to Use Entra ID

- ✅ Internal federal employee applications
- ✅ Contractor applications (with guest accounts)
- ✅ Applications requiring PIV/CAC authentication
- ✅ Applications requiring Conditional Access policies
- ✅ Applications integrated with Microsoft 365

### When NOT to Use Entra ID

- ❌ Public-facing applications (use Login.gov)
- ❌ Applications for non-federal users (use Login.gov)

---

## 2. Authentication Protocols

### OIDC / OAuth 2.0 (Preferred for Modern Apps)

Use OpenID Connect for:
- Single-page applications (React, Angular, Vue)
- Mobile applications
- Web APIs
- Modern web applications

**Endpoints (GCC High / DoD):**
- **Authorization**: `https://login.microsoftonline.us/{tenant-id}/oauth2/v2.0/authorize`
- **Token**: `https://login.microsoftonline.us/{tenant-id}/oauth2/v2.0/token`
- **JWKS**: `https://login.microsoftonline.us/{tenant-id}/discovery/v2.0/keys`

**Required Parameters:**
```
client_id: your-app-client-id
redirect_uri: https://your-app.gov/auth/callback
response_type: code
scope: openid profile email
response_mode: form_post
state: random-csrf-token
nonce: random-replay-token
```

### SAML 2.0 (Preferred for Enterprise Apps)

Use SAML for:
- Legacy enterprise applications
- Java/Spring applications
- Applications with existing SAML support
- Applications requiring federation with AD FS

**Endpoints (GCC High / DoD):**
- **SSO**: `https://login.microsoftonline.us/{tenant-id}/saml2`
- **Metadata**: `https://login.microsoftonline.us/{tenant-id}/federationmetadata/2007-06/federationmetadata.xml`

---

## 3. PIV/CAC Authentication (Smartcard)

**PIV/CAC authentication is required for federal employees per HSPD-12 and FIPS 201.**

### Certificate-Based Authentication (CBA)

Enable certificate-based authentication in Entra ID:

```csharp
// ASP.NET Core configuration
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
                var subjectDN = cert.Subject;
                
                // Extract FASC-N or UUID from certificate
                var upn = cert.GetNameInfo(X509NameType.UpnName, false);
                
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
                    new Claim("piv_authenticated", "true")
                };
                
                context.Principal = new ClaimsPrincipal(
                    new ClaimsIdentity(claims, context.Scheme.Name));
                context.Success();
                
                return Task.CompletedTask;
            }
        };
    });
```

### Entra ID Certificate-Based Authentication

Configure in Entra ID admin center:
1. Navigate to **Entra ID** > **Security** > **Authentication methods** > **Certificate-based authentication**
2. Enable CBA for your tenant
3. Configure certificate authorities (upload DoD root CAs)
4. Map certificate fields to user attributes (UPN, email)

---

## 4. Single Sign-On (SSO) Implementation

### Pattern 1: OIDC for Web Apps

**Node.js / Express Example:**

```javascript
const passport = require('passport');
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;

// Configure OIDC strategy for Azure Government
passport.use(new OIDCStrategy({
    identityMetadata: `https://login.microsoftonline.us/${process.env.TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    responseType: 'code',
    responseMode: 'form_post',
    redirectUrl: 'https://your-app.gov/auth/callback',
    allowHttpForRedirectUrl: false,
    validateIssuer: true,
    issuer: `https://login.microsoftonline.us/${process.env.TENANT_ID}/v2.0`,
    passReqToCallback: false,
    scope: ['openid', 'profile', 'email'],
    loggingLevel: 'info'
  },
  async (iss, sub, profile, accessToken, refreshToken, done) => {
    try {
      // Find or create user
      let user = await User.findOne({ where: { azureAdOid: profile.oid } });
      
      if (!user) {
        user = await User.create({
          azureAdOid: profile.oid,
          upn: profile.upn,
          email: profile.email,
          displayName: profile.displayName,
          givenName: profile.given_name,
          surname: profile.family_name
        });
      } else {
        // Update last login
        user.lastLogin = new Date();
        await user.save();
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

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
  req.logout();
  res.redirect(
    `https://login.microsoftonline.us/${process.env.TENANT_ID}/oauth2/v2.0/logout` +
    `?post_logout_redirect_uri=${encodeURIComponent('https://your-app.gov')}`
  );
});
```

### Pattern 2: SAML for Enterprise Apps

**Java / Spring Boot Example:**

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
}

// application.yml
spring:
  security:
    saml2:
      relyingparty:
        registration:
          azure-ad:
            assertingparty:
              metadata-uri: https://login.microsoftonline.us/{tenant-id}/federationmetadata/2007-06/federationmetadata.xml
            entity-id: https://your-app.gov
            acs:
              location: https://your-app.gov/login/saml2/sso/azure-ad
              binding: POST
            singlelogout:
              url: https://your-app.gov/logout/saml2/slo
              response-url: https://your-app.gov/logout/saml2/slo
              binding: POST
```

---

## 5. Conditional Access Integration

### Enforce Conditional Access Policies

Entra ID Conditional Access policies are evaluated at authentication time:

- **MFA requirement**: Require MFA for all users or specific roles
- **Device compliance**: Require managed/compliant devices
- **Location-based**: Block access from non-federal networks
- **Risk-based**: Block high-risk sign-ins

**Application must respect Conditional Access:**
- Do not cache tokens indefinitely (respect token expiration)
- Support token refresh for long-running sessions
- Handle `interaction_required` errors by redirecting to Entra ID

```python
# Handle Conditional Access challenge
try:
    token = oauth.azure.authorize_access_token()
except OAuthError as e:
    if e.error == 'interaction_required':
        # User must complete MFA or device compliance
        return oauth.azure.authorize_redirect(
            redirect_uri=url_for('authorize', _external=True),
            prompt='login'  # Force re-authentication
        )
    raise
```

---

## 6. Group-Based Authorization

### Use Entra ID Groups for RBAC

```csharp
// C# example: Check group membership
[Authorize]
public class AdminController : Controller
{
    private readonly IGraphServiceClient _graphClient;
    
    public async Task<IActionResult> Index()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        // Check if user is member of admin group
        var groups = await _graphClient.Users[userId]
            .MemberOf
            .Request()
            .GetAsync();
        
        var isAdmin = groups.Any(g => 
            g is Group group && 
            group.DisplayName == "Application Admins");
        
        if (!isAdmin)
        {
            return Forbid();
        }
        
        return View();
    }
}
```

### Group Claims in Token

Configure Entra ID to include group claims in tokens:

1. Navigate to **App registrations** > your app > **Token configuration**
2. Add **groups claim**
3. Select **Security groups** or **All groups**
4. Choose **Group ID** (recommended) or **sAMAccountName** (legacy)

```python
# Python example: Check group membership from token
@app.route('/admin')
@login_required
def admin_dashboard():
    groups = session.get('groups', [])
    
    # Check if user is in admin group
    ADMIN_GROUP_ID = os.getenv('ADMIN_GROUP_ID')
    if ADMIN_GROUP_ID not in groups:
        abort(403, 'Access denied: Admin role required')
    
    return render_template('admin.html')
```

---

## 7. Guest Users (B2B Collaboration)

### Inviting External Collaborators

For contractors or partners who need access to internal applications:

```csharp
// Invite guest user via Microsoft Graph
var invitation = new Invitation
{
    InvitedUserEmailAddress = "contractor@company.com",
    InviteRedirectUrl = "https://your-app.gov",
    SendInvitationMessage = true,
    InvitedUserMessageInfo = new InvitedUserMessageInfo
    {
        CustomizedMessageBody = "You have been invited to access the Federal Document System."
    }
};

var result = await graphClient.Invitations
    .Request()
    .AddAsync(invitation);
```

### Guest User Restrictions

- **Limit guest permissions**: Use default guest user permissions (restricted)
- **Require approval**: Use Entra ID entitlement management for guest access requests
- **Time-bound access**: Set expiration dates on guest accounts
- **Monitor guest activity**: Review guest sign-ins and access patterns

---

## 8. On-Premises Active Directory Integration

### Hybrid Identity with Entra Connect

For agencies with on-premises Active Directory:

**Entra Connect Sync:**
- Synchronizes users, groups, and passwords from on-prem AD to Entra ID
- Supports password hash sync (PHS), pass-through authentication (PTA), or federation (AD FS)

**Recommended Approach:**
- Use **password hash sync** for simplicity and resilience
- Enable **seamless SSO** for on-premises applications
- Use **Entra Connect Health** for monitoring

### Federation with AD FS

For agencies requiring on-premises authentication:

```xml
<!-- AD FS Relying Party Trust configuration -->
<RelyingParty>
  <Identifier>https://your-app.gov</Identifier>
  <Endpoint>
    <EndpointType>SAML AssertionConsumerService</EndpointType>
    <Binding>urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST</Binding>
    <Location>https://your-app.gov/saml/acs</Location>
  </Endpoint>
  <ClaimsProviderName>Active Directory</ClaimsProviderName>
  <ClaimRules>
    <ClaimRule>
      <RuleType>IssuanceClaim</RuleType>
      <ClaimType>http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn</ClaimType>
    </ClaimRule>
  </ClaimRules>
</RelyingParty>
```

---

## 9. Application Registration

### Register Application in Entra ID

**For Web Applications:**

1. Navigate to **Entra ID** > **App registrations** > **New registration**
2. Configure:
   - **Name**: Your application name
   - **Supported account types**: Accounts in this organizational directory only (single tenant)
   - **Redirect URI**: `https://your-app.gov/auth/callback` (Web)
3. Create **client secret** or upload **certificate** (certificate preferred for production)
4. Configure **API permissions**:
   - `User.Read` (delegated) — read user profile
   - `GroupMember.Read.All` (delegated) — read group membership
5. Grant **admin consent** for permissions

### App Registration Best Practices

- **Use certificates** instead of client secrets for production (more secure)
- **Rotate secrets/certificates** every 90 days
- **Use separate registrations** for dev, staging, and production
- **Limit redirect URIs** to only necessary endpoints
- **Enable logging** in Entra ID sign-in logs

---

## 10. Token Management

### Access Token Validation

```python
# Python example: Validate Azure AD access token
import jwt
from jwt import PyJWKClient

def validate_access_token(token):
    """Validate Azure AD access token"""
    
    # Get signing keys from JWKS endpoint
    jwks_url = f"https://login.microsoftonline.us/{TENANT_ID}/discovery/v2.0/keys"
    jwks_client = PyJWKClient(jwks_url)
    
    try:
        # Get signing key
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Decode and validate token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=f"https://login.microsoftonline.us/{TENANT_ID}/v2.0"
        )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")
```

### Token Refresh

```javascript
// Node.js example: Refresh access token
const msal = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.us/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

async function refreshAccessToken(refreshToken) {
  const refreshTokenRequest = {
    refreshToken: refreshToken,
    scopes: ['openid', 'profile', 'email']
  };
  
  try {
    const response = await cca.acquireTokenByRefreshToken(refreshTokenRequest);
    return response.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
}
```

---

## 11. Authorization Patterns

### Role-Based Access Control (RBAC)

**Use Entra ID App Roles:**

1. Define roles in app registration manifest:
```json
{
  "appRoles": [
    {
      "allowedMemberTypes": ["User"],
      "description": "Administrators have full access",
      "displayName": "Administrator",
      "id": "unique-guid-1",
      "isEnabled": true,
      "value": "Admin"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Reviewers can review and approve",
      "displayName": "Reviewer",
      "id": "unique-guid-2",
      "isEnabled": true,
      "value": "Reviewer"
    }
  ]
}
```

2. Assign users/groups to roles in Enterprise Apps
3. Check roles in application:

```csharp
// C# example
[Authorize(Roles = "Admin")]
public class AdminController : Controller
{
    // Only users with Admin role can access
}

// Python example
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
@require_role('Admin')
def admin_dashboard():
    return render_template('admin.html')
```

---

## 12. Security Requirements

### Session Management

- **Session timeout**: Maximum 30 minutes of inactivity for sensitive apps, 8 hours for standard apps
- **Absolute timeout**: Maximum 12 hours
- **Token lifetime**: Access tokens expire in 1 hour, refresh tokens in 90 days
- **Secure cookies**: HTTPOnly, Secure, SameSite=Lax

### Conditional Access Policies

Configure in Entra ID admin center:

**Recommended Policies:**
- **Require MFA** for all users
- **Require compliant device** or **hybrid Azure AD joined device**
- **Block legacy authentication** (no basic auth, no POP3/IMAP)
- **Require approved client apps** for mobile access
- **Block access from untrusted locations** (non-federal networks)

### Sign-In Risk Policies

- **Low risk**: Allow with MFA
- **Medium risk**: Require MFA and password change
- **High risk**: Block access, require admin intervention

---

## 13. Microsoft Graph API Integration

### Accessing User Data

```csharp
// C# example: Get user profile and group membership
using Microsoft.Graph;

var graphClient = new GraphServiceClient(authProvider);

// Get user profile
var user = await graphClient.Users[userId]
    .Request()
    .Select("displayName,mail,jobTitle,department")
    .GetAsync();

// Get user's groups
var groups = await graphClient.Users[userId]
    .MemberOf
    .Request()
    .GetAsync();

// Get user's manager
var manager = await graphClient.Users[userId]
    .Manager
    .Request()
    .GetAsync();
```

### Service Principal Authentication

For background jobs and service-to-service authentication:

```python
# Python example: Service principal authentication
from azure.identity import ClientSecretCredential
from msgraph.core import GraphClient

credential = ClientSecretCredential(
    tenant_id=TENANT_ID,
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    authority="https://login.microsoftonline.us"
)

graph_client = GraphClient(credential=credential)

# Query users (requires application permissions)
users = graph_client.get('/users?$top=10')
```

---

## 14. Logging and Monitoring

### Sign-In Logs

- **Monitor sign-in logs** in Entra ID admin center
- **Alert on anomalies**: Impossible travel, unfamiliar locations, multiple failures
- **Export logs** to SIEM (Splunk, Azure Sentinel, CloudWatch)

### Application Logs

```python
# Log authentication events
def log_auth_event(event_type, user_id, result, details=None):
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': event_type,
        'user_id': user_id,
        'upn': details.get('upn') if details else None,
        'ip_address': request.remote_addr,
        'user_agent': request.headers.get('User-Agent'),
        'result': result,
        'details': details or {}
    }
    
    if result == 'failure':
        logging.warning(json.dumps(log_entry))
    else:
        logging.info(json.dumps(log_entry))

# Usage
@app.route('/auth/callback')
def authorize():
    try:
        token = oauth.azure.authorize_access_token()
        user_info = token['userinfo']
        
        log_auth_event(
            'authentication',
            user_info['oid'],
            'success',
            {'upn': user_info['upn'], 'method': 'azure_ad'}
        )
        
        return redirect('/dashboard')
    except Exception as e:
        log_auth_event(
            'authentication',
            None,
            'failure',
            {'error': str(e)}
        )
        raise
```

---

## 15. Production Deployment Checklist

Before deploying to production:

- [ ] Application registered in correct Entra ID tenant (GCC, GCC High, or DoD)
- [ ] Redirect URIs use HTTPS only
- [ ] Client secret or certificate configured and secured
- [ ] API permissions configured and admin consent granted
- [ ] App roles defined and users assigned
- [ ] Conditional Access policies configured
- [ ] PIV/CAC authentication enabled (if required)
- [ ] Token validation implemented
- [ ] Session management configured
- [ ] Logout implemented (local and Entra ID)
- [ ] Error handling implemented
- [ ] Security logging enabled
- [ ] Sign-in logs monitored
- [ ] ATO approved for production environment

---

## 16. What to Do When Uncertain

- If unsure about cloud environment, **ask your agency IT team** (GCC, GCC High, or DoD)
- If unsure about OIDC vs SAML, **use OIDC** for new applications
- If unsure about PIV/CAC requirement, **assume it's required** for federal employees
- If unsure about Conditional Access, **consult your security team**
- For technical questions, **reference Microsoft Entra ID documentation** or submit Azure support ticket
