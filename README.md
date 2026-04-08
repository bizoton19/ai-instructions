# Federal Web Development Templates

Comprehensive AI agent instruction files for building U.S. federal government web applications with strict compliance, security, and pragmatic architecture standards.

## Overview

This repository contains Cursor rules, GitHub Copilot instructions, and AI agent skills for developers building federal internal and external websites. All templates enforce:

- **USWDS 3.x** (U.S. Web Design System)
- **Section 508 / WCAG 2.1 AA** accessibility compliance
- **OWASP Top 10** security standards
- **NIST** guidelines (SP 800-53, 800-63B, 800-190)
- **DevSecOps** practices
- **GSA Content Standards** (OMB M-23-22)
- **Pragmatic architecture** (KISS, DRY, monolith-first)

## Repository Structure

```
template-instructions/
├── .cursor/rules/               # Cursor AI rules
│   ├── federal-ui.mdc          # Frontend: USWDS, 508, design excellence
│   ├── backend-security.mdc    # Backend: OWASP, NIST, DevSecOps
│   └── backend-architecture.mdc # Backend: KISS, DRY, monolith-first
│
├── .github/                     # GitHub Copilot instructions
│   ├── copilot-instructions.md           # Frontend (equivalent to federal-ui.mdc)
│   ├── copilot-backend-security.md       # Backend security
│   ├── copilot-backend-architecture.md   # Backend architecture
│   ├── copilot-auth-public.md            # Public authentication
│   └── copilot-auth-internal.md          # Internal authentication
│
└── skills/                      # AI agent skills (step-by-step workflows)
    ├── federal-ui-design/
    │   └── SKILL.md            # Frontend implementation workflow
    ├── 508-audit/
    │   └── SKILL.md            # Accessibility audit workflow
    ├── backend-security/
    │   └── SKILL.md            # Security audit and implementation
    ├── backend-architecture/
    │   ├── SKILL.md            # Architecture design workflow
    │   └── workflow-bpmn.md   # Workflow/BPMN implementation
    ├── auth-public/
    │   └── SKILL.md            # Login.gov integration workflow
    └── auth-internal/
        └── SKILL.md            # Azure AD/Entra ID integration workflow
```

## Frontend Standards

### USWDS 3.x Compliance
- Exclusive use of U.S. Web Design System
- Design tokens for spacing, color, typography
- Component markup matches USWDS exactly
- USWDS icon sprite (245+ icons, no Font Awesome)

### Section 508 / WCAG 2.1 AA
- Semantic HTML5 structure
- Proper heading hierarchy
- Form labels and ARIA attributes
- Keyboard navigation support
- 4.5:1 color contrast minimum
- Alt text for all images

### Design Excellence
- Visual hierarchy and whitespace
- Icon-led components (USWDS icons only)
- Modern layout patterns (cards, grids)
- Micro-interactions with `prefers-reduced-motion`
- No emojis, no AI slop, no generic designs

### GSA Content Standards
- Timeliness (3-year review cycle)
- Plain language (8th grade reading level target)
- No duplication (prohibited by OMB M-23-22)
- OMB-approved content protection
- Accuracy (3-day update window)

## Backend Standards

### Security (OWASP Top 10)
- **A01**: Server-side access control, RBAC, ownership validation
- **A02**: TLS 1.2+, bcrypt/Argon2, AES-256, FIPS 140-2
- **A03**: Parameterized queries, input validation, no eval()
- **A04**: Threat modeling, rate limiting, secure defaults
- **A05**: Security headers, no debug in prod, dependency updates
- **A06**: SBOM, automated scanning, 30-day patch window
- **A07**: MFA, strong passwords, secure sessions
- **A08**: Code signing, CI/CD security, SRI
- **A09**: Structured logging, 90-day retention, alerting
- **A10**: URL validation, allowlists, block internal IPs

### NIST Compliance
- **SP 800-53**: Access control, audit, authentication controls
- **SP 800-63B**: AAL2 for privileged accounts, password policies
- **SP 800-190**: Container security (minimal images, non-root)

### DevSecOps Pipeline
- SAST (Bandit, ESLint Security, SonarQube)
- Dependency scanning (pip-audit, npm audit, Snyk)
- Container scanning (Trivy, Clair)
- Secrets scanning (TruffleHog, git-secrets)
- Fail builds on critical/high vulnerabilities

### Architecture Principles

**KISS (Keep It Simple):**
- Simple solutions over complexity
- Use library functions, don't reinvent
- Avoid premature optimization

**DRY (Don't Repeat Yourself):**
- Extract after 3+ instances of duplication
- Wait for clear patterns before abstracting
- Duplication is cheaper than wrong abstraction

**Monolith-First:**
- Default to monolithic architecture
- Only consider microservices when:
  - 50+ engineers who cannot coordinate
  - 10M+ users with distinct scaling needs
  - Truly independent bounded contexts
  - Mature DevOps and observability

**Design Patterns - Use Sparingly:**
- Only when solving real problems
- Must make code easier to understand
- Pass the 4-question smell test

**Database Strategy:**
- **SQL Server / Azure SQL** default (FedRAMP authorized)
- PostgreSQL alternative for on-premises
- Normalization by app type:
  - System of Record: 3NF strict
  - Transactional: 3NF default
  - Intermediary/Review: 2NF or denormalized
  - Reporting: Denormalized (star/snowflake)
- Audit fields on all tables (CreatedAt, CreatedBy, UpdatedAt, UpdatedBy)
- CASCADE DELETE on foreign keys
- Business rules in application, not CHECK constraints

## Workflow & BPMN

For workflow-style applications (approvals, business processes), use open-source frameworks:

**Python:**
- Temporal.io (durable execution, long-running)
- Celery (background jobs)
- Airflow/Prefect (data pipelines)

**Node.js:**
- Temporal.io (same as Python)
- Bull/BullMQ (Redis-based queues)
- Camunda (BPMN 2.0 engine)

**Java:**
- Camunda (industry standard, visual designer)
- Activiti (open-source BPMN)
- jBPM (Red Hat enterprise)

## Authentication Standards

### Public-Facing Applications

**Login.gov Integration (Mandatory):**
- OIDC with `private_key_jwt` authentication
- NIST 800-63-3 service levels (AAL2, IAL2)
- Identity verification workflows
- Minimal PII storage
- Production deployment via Partner Portal

### Internal Applications

**Azure AD / Entra ID Integration (Mandatory):**
- Azure Government cloud support (GCC, GCC High, DoD)
- OIDC and SAML 2.0 protocols
- PIV/CAC smartcard authentication (HSPD-12)
- Conditional Access policies
- Group-based authorization and RBAC
- Microsoft Graph API integration

## Usage

### For Cursor

1. Copy `.cursor/rules/*.mdc` to your project's `.cursor/rules/` directory
2. Copy relevant skills from `skills/` to your project
3. Cursor will automatically apply rules to your codebase

### For GitHub Copilot

1. Copy `.github/copilot-*.md` files to your project's `.github/` directory
2. Rename to `copilot-instructions.md` or include in your existing instructions
3. GitHub Copilot will use these guidelines for suggestions

### For AI Agents

Reference the SKILL.md files when working with AI agents:
- "Follow the federal-ui-design skill"
- "Audit security using the backend-security skill"
- "Design architecture using the backend-architecture skill"

## License

Public domain. These templates are provided for use by U.S. federal agencies and contractors.

## Contributing

Improvements welcome. Ensure all changes maintain compliance with federal standards.

## Contact

Questions about these templates: Create an issue in this repository.

Questions about specific federal requirements:
- USWDS: https://designsystem.digital.gov/
- Section 508: https://www.section508.gov/
- OWASP: https://owasp.org/
- NIST: https://csrc.nist.gov/
- GSA Web Style Guide: https://www.gsa.gov/reference/gsa-web-style-guide
