# Backend Architecture Design and Refactoring

**Trigger**: Use when the user asks about architecture decisions, mentions microservices vs monolith, asks to refactor code, or discusses design patterns, DDD, or event-driven architecture.

**Description**: This skill guides you through making pragmatic backend architecture decisions that favor simplicity, maintainability, and federal system requirements over complexity and hype.

---

## When to Use This Skill

- User asks "should I use microservices?"
- User wants to refactor a monolith
- User asks about design patterns or DDD
- User mentions event-driven architecture or message queues
- User asks how to structure a new backend project
- User wants to improve code organization or modularity
- User asks about scaling strategies

---

## Prerequisites

Before making architecture decisions, gather:
- [ ] Current team size and expected growth
- [ ] Current user base and expected growth (next 12 months)
- [ ] Domain complexity (simple CRUD vs complex business rules)
- [ ] Deployment constraints (on-prem, cloud, hybrid)
- [ ] Existing infrastructure and team expertise
- [ ] Performance requirements (response time, throughput)
- [ ] Compliance requirements (FedRAMP, FISMA, etc.)

---

## Decision Tree: Monolith vs Microservices

### Start Here: Should I Use Microservices?

Answer these questions honestly:

**Team Size:**
- Do you have fewer than 50 engineers? → **Stay monolithic**
- Do you have 50+ engineers who cannot coordinate in a monolith? → **Consider microservices**

**User Scale:**
- Do you have fewer than 1 million users? → **Stay monolithic**
- Do you have 10+ million users with distinct scaling needs per feature? → **Consider microservices**

**Domain Complexity:**
- Is your domain mostly CRUD operations? → **Stay monolithic**
- Do you have truly independent bounded contexts that change at different rates? → **Consider microservices**

**Operational Maturity:**
- Do you lack mature DevOps, observability, and incident response? → **Stay monolithic**
- Do you have dedicated SRE team and mature ops practices? → **Consider microservices**

**If you answered "Stay monolithic" to ANY question above, stay monolithic.**

### Monolith-First Implementation

```
Phase 1: Start with Monolith (Months 0-12)
├── Single codebase
├── Single database
├── Single deployment
└── Modular structure (see below)

Phase 2: Modular Monolith (Months 12-24)
├── Enforce module boundaries
├── Separate module APIs
├── Independent module testing
└── Prepare for potential extraction

Phase 3: Extract Services (Only if needed, Months 24+)
├── Extract highest-load modules first
├── One service at a time
├── Maintain monolith for remaining features
└── Shared database initially, split later
```

---

## Step 1: Project Structure Setup

### Python/Flask Modular Monolith

```bash
my-federal-app/
├── app/
│   ├── __init__.py              # App factory
│   ├── config.py                # Configuration
│   ├── extensions.py            # Shared extensions (db, cache, etc.)
│   │
│   ├── modules/                 # Domain modules
│   │   ├── __init__.py
│   │   │
│   │   ├── users/               # User management module
│   │   │   ├── __init__.py
│   │   │   ├── models.py        # User, Role models
│   │   │   ├── services.py      # Business logic
│   │   │   ├── routes.py        # API endpoints
│   │   │   ├── schemas.py       # Validation schemas
│   │   │   └── tests/
│   │   │       ├── test_models.py
│   │   │       ├── test_services.py
│   │   │       └── test_routes.py
│   │   │
│   │   ├── documents/           # Document management module
│   │   │   ├── __init__.py
│   │   │   ├── models.py
│   │   │   ├── services.py
│   │   │   ├── routes.py
│   │   │   ├── schemas.py
│   │   │   └── tests/
│   │   │
│   │   └── reports/             # Reporting module
│   │       ├── __init__.py
│   │       ├── models.py
│   │       ├── services.py
│   │       ├── routes.py
│   │       └── tests/
│   │
│   ├── shared/                  # Shared utilities
│   │   ├── __init__.py
│   │   ├── auth.py              # Authentication helpers
│   │   ├── decorators.py        # Custom decorators
│   │   ├── exceptions.py        # Custom exceptions
│   │   └── utils.py             # Utility functions
│   │
│   └── tasks/                   # Background tasks
│       ├── __init__.py
│       ├── email.py
│       └── reports.py
│
├── migrations/                  # Database migrations
├── tests/
│   ├── integration/             # Integration tests
│   └── e2e/                     # End-to-end tests
│
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

### Node.js/Express Modular Monolith

```bash
my-federal-app/
├── src/
│   ├── index.js                 # App entry point
│   ├── config/
│   │   ├── database.js
│   │   └── environment.js
│   │
│   ├── modules/                 # Domain modules
│   │   ├── users/
│   │   │   ├── user.model.js
│   │   │   ├── user.service.js
│   │   │   ├── user.controller.js
│   │   │   ├── user.routes.js
│   │   │   ├── user.validation.js
│   │   │   └── __tests__/
│   │   │
│   │   ├── documents/
│   │   │   ├── document.model.js
│   │   │   ├── document.service.js
│   │   │   ├── document.controller.js
│   │   │   ├── document.routes.js
│   │   │   └── __tests__/
│   │   │
│   │   └── reports/
│   │       ├── report.model.js
│   │       ├── report.service.js
│   │       ├── report.controller.js
│   │       └── report.routes.js
│   │
│   ├── shared/                  # Shared utilities
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── errorHandler.js
│   │   │   └── validation.js
│   │   └── utils/
│   │       ├── logger.js
│   │       └── helpers.js
│   │
│   └── tasks/                   # Background jobs
│       ├── emailQueue.js
│       └── reportQueue.js
│
├── tests/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Step 2: Module Boundary Enforcement

### Define Module Interfaces

Each module should expose a clear public API and hide implementation details.

**Python Example:**

```python
# app/modules/users/__init__.py
"""
Users module public API

This module handles user management, authentication, and authorization.
Other modules should only use the functions exported here.
"""

from .services import (
    create_user,
    get_user_by_id,
    get_user_by_email,
    update_user,
    delete_user,
    authenticate_user,
    check_permission
)

__all__ = [
    'create_user',
    'get_user_by_id',
    'get_user_by_email',
    'update_user',
    'delete_user',
    'authenticate_user',
    'check_permission'
]
```

**Node.js Example:**

```javascript
// src/modules/users/index.js
/**
 * Users module public API
 * 
 * This module handles user management, authentication, and authorization.
 * Other modules should only use the functions exported here.
 */

const UserService = require('./user.service');

module.exports = {
  createUser: UserService.createUser,
  getUserById: UserService.getUserById,
  getUserByEmail: UserService.getUserByEmail,
  updateUser: UserService.updateUser,
  deleteUser: UserService.deleteUser,
  authenticateUser: UserService.authenticateUser,
  checkPermission: UserService.checkPermission
};
```

### Enforce Boundaries with Linting

**Python (using import-linter):**

```ini
# .importlinter
[importlinter]
root_package = app

[importlinter:contract:1]
name = Modules should not import from other modules' internals
type = forbidden
source_modules =
    app.modules.documents
    app.modules.reports
forbidden_modules =
    app.modules.users.models
    app.modules.users.routes
    app.modules.users.schemas
```

**Node.js (using ESLint):**

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/modules/*/!(index.js)'],
          message: 'Import from module index only, not internal files'
        }
      ]
    }]
  }
};
```

---

## Step 3: Service Layer Pattern (Simplified)

Use a service layer to encapsulate business logic. Keep it simple—don't over-engineer.

### When to Use Service Layer

- ✅ Business logic that involves multiple models
- ✅ Operations that need to be reused across routes
- ✅ Complex validation or data transformation
- ✅ Operations that interact with external APIs

### When NOT to Use Service Layer

- ❌ Simple CRUD operations (use models directly)
- ❌ Operations used in only one place
- ❌ Trivial getters/setters

### Service Layer Example (Python)

```python
# app/modules/documents/services.py
from app.extensions import db
from app.modules.documents.models import Document
from app.modules.users.services import check_permission
from app.shared.exceptions import NotFoundError, ForbiddenError

class DocumentService:
    """
    Business logic for document management
    """
    
    @staticmethod
    def create_document(user_id, title, content, classification='unclassified'):
        """
        Create a new document with proper validation and authorization
        """
        # Check user has permission to create documents
        if not check_permission(user_id, 'document:create'):
            raise ForbiddenError('User lacks document creation permission')
        
        # Validate classification level
        valid_classifications = ['unclassified', 'cui', 'confidential']
        if classification not in valid_classifications:
            raise ValueError(f'Invalid classification: {classification}')
        
        # Create document
        document = Document(
            owner_id=user_id,
            title=title,
            content=content,
            classification=classification
        )
        
        db.session.add(document)
        db.session.commit()
        
        # Log creation for audit
        log_security_event('document_created', user_id, document.id)
        
        return document
    
    @staticmethod
    def get_document(document_id, user_id):
        """
        Get document with access control check
        """
        document = Document.query.get(document_id)
        
        if not document:
            raise NotFoundError(f'Document {document_id} not found')
        
        # Check access
        if document.owner_id != user_id:
            if not check_permission(user_id, 'document:read_all'):
                raise ForbiddenError('Access denied')
        
        return document
    
    @staticmethod
    def update_document(document_id, user_id, **updates):
        """
        Update document with validation and authorization
        """
        document = DocumentService.get_document(document_id, user_id)
        
        # Check edit permission
        if document.owner_id != user_id:
            if not check_permission(user_id, 'document:edit_all'):
                raise ForbiddenError('Cannot edit this document')
        
        # Apply updates
        for key, value in updates.items():
            if hasattr(document, key):
                setattr(document, key, value)
        
        db.session.commit()
        
        # Log update for audit
        log_security_event('document_updated', user_id, document.id)
        
        return document
```

### Route Layer (Keep Thin)

```python
# app/modules/documents/routes.py
from flask import Blueprint, request, jsonify
from app.modules.documents.services import DocumentService
from app.modules.documents.schemas import DocumentCreateSchema, DocumentUpdateSchema
from app.shared.decorators import login_required

documents_bp = Blueprint('documents', __name__, url_prefix='/api/documents')

@documents_bp.route('', methods=['POST'])
@login_required
def create_document(current_user):
    """Create a new document"""
    schema = DocumentCreateSchema()
    data = schema.load(request.json)
    
    document = DocumentService.create_document(
        user_id=current_user.id,
        **data
    )
    
    return jsonify(document.to_dict()), 201

@documents_bp.route('/<int:document_id>', methods=['GET'])
@login_required
def get_document(current_user, document_id):
    """Get a document by ID"""
    document = DocumentService.get_document(document_id, current_user.id)
    return jsonify(document.to_dict())

@documents_bp.route('/<int:document_id>', methods=['PATCH'])
@login_required
def update_document(current_user, document_id):
    """Update a document"""
    schema = DocumentUpdateSchema()
    data = schema.load(request.json)
    
    document = DocumentService.update_document(
        document_id,
        current_user.id,
        **data
    )
    
    return jsonify(document.to_dict())
```

---

## Step 4: Database Design (Keep It Simple)

### Use Relational Database by Default

PostgreSQL is the default choice for federal systems:
- Excellent JSON support (JSONB)
- Full-text search
- Row-level security
- Mature, stable, well-documented
- FIPS 140-2 validated encryption

### Schema Design Principles

```sql
-- Good: Normalized schema with proper constraints
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'admin', 'auditor')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE is_active = TRUE;

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    classification VARCHAR(50) NOT NULL DEFAULT 'unclassified',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    CONSTRAINT valid_classification CHECK (
        classification IN ('unclassified', 'cui', 'confidential', 'secret')
    )
);

CREATE INDEX idx_documents_owner ON documents(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_classification ON documents(classification);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id),
    resource_type VARCHAR(100),
    resource_id UUID,
    action VARCHAR(50) NOT NULL,
    result VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
```

### Migration Strategy

Use a migration tool:
- **Python**: Alembic (Flask-Migrate)
- **Node.js**: Knex.js, Sequelize migrations
- **Ruby**: ActiveRecord migrations

```python
# Example Alembic migration
"""Add classification to documents

Revision ID: 001
Revises: 
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('documents',
        sa.Column('classification', sa.String(50), nullable=False, server_default='unclassified')
    )
    op.create_check_constraint(
        'valid_classification',
        'documents',
        "classification IN ('unclassified', 'cui', 'confidential', 'secret')"
    )

def downgrade():
    op.drop_constraint('valid_classification', 'documents')
    op.drop_column('documents', 'classification')
```

---

## Step 5: Avoiding Premature Abstraction

### The Rule of Three

Don't create an abstraction until you have **three** instances of duplication.

**Bad: Premature abstraction**

```python
# After seeing duplication ONCE, developer creates complex abstraction
class BaseService:
    def __init__(self, model_class):
        self.model_class = model_class
    
    def get_by_id(self, id):
        return self.model_class.query.get(id)
    
    def create(self, **kwargs):
        instance = self.model_class(**kwargs)
        db.session.add(instance)
        db.session.commit()
        return instance
    
    # 20 more generic methods...

class UserService(BaseService):
    def __init__(self):
        super().__init__(User)

class DocumentService(BaseService):
    def __init__(self):
        super().__init__(Document)
```

**Good: Wait for clear pattern**

```python
# Keep it simple until pattern emerges
class UserService:
    @staticmethod
    def get_by_id(user_id):
        return User.query.get(user_id)
    
    @staticmethod
    def create(email, password, **kwargs):
        user = User(email=email, **kwargs)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user

class DocumentService:
    @staticmethod
    def get_by_id(document_id):
        return Document.query.get(document_id)
    
    @staticmethod
    def create(owner_id, title, content):
        document = Document(owner_id=owner_id, title=title, content=content)
        db.session.add(document)
        db.session.commit()
        return document

# If you see the SAME pattern 3+ times, THEN abstract
```

### Design Pattern Checklist

Before using a design pattern, answer:

1. **Do I have a real problem this pattern solves?**
   - ❌ "I might need to swap databases later" (YAGNI)
   - ✅ "I have 3 payment processors and need to switch between them"

2. **Will this make code easier to understand?**
   - ❌ 5 files and 3 interfaces for a simple operation
   - ✅ Clear separation of concerns with obvious benefits

3. **Can I explain this to a junior developer in 2 minutes?**
   - ❌ Complex factory hierarchy with abstract base classes
   - ✅ "This function creates objects based on a type parameter"

---

## Step 6: When to Extract a Service (Microservices)

Only extract a service when you have **clear evidence** of need.

### Extraction Criteria Checklist

Extract a service ONLY if **ALL** are true:

- [ ] Service has distinct scaling needs (10x more load than rest of app)
- [ ] Service changes frequently and independently
- [ ] Service has clear bounded context with minimal dependencies
- [ ] Team has capacity to operate distributed system
- [ ] Monitoring and observability are mature
- [ ] You've exhausted monolith optimization options

### Extraction Process

```
1. Identify Service Boundary
   ├── Map dependencies (data, APIs, shared code)
   ├── Define service API contract
   └── Estimate extraction effort

2. Create Service Interface in Monolith
   ├── Extract service layer
   ├── Define clear API
   └── Add integration tests

3. Build Service Separately
   ├── Copy code to new repo
   ├── Set up CI/CD
   ├── Deploy to staging

4. Dual-Write Phase
   ├── Write to both monolith and service
   ├── Read from monolith
   └── Compare results

5. Read Cutover
   ├── Read from service
   ├── Fall back to monolith on error
   └── Monitor closely

6. Cleanup
   ├── Remove code from monolith
   ├── Remove dual-write logic
   └── Update documentation
```

---

## Step 7: Common Architecture Mistakes

### Mistake 1: Microservices Too Early

**Symptom**: 3-person team with 10 microservices

**Fix**: Merge services back into monolith. Extract only when scaling demands it.

### Mistake 2: Shared Database Between Services

**Symptom**: Multiple services directly querying same database tables

**Fix**: Each service should own its data. Use APIs for cross-service data access.

### Mistake 3: Distributed Monolith

**Symptom**: Services that must be deployed together, tight coupling

**Fix**: Merge back into monolith or properly decouple with async messaging.

### Mistake 4: Over-Engineering Simple CRUD

**Symptom**: Repository pattern, factory pattern, strategy pattern for simple CRUD

**Fix**: Use ORM directly in routes. Add service layer only when business logic emerges.

### Mistake 5: Premature Event-Driven Architecture

**Symptom**: Message queue for every operation, eventual consistency everywhere

**Fix**: Use synchronous calls by default. Add async only for long-running operations.

---

## Step 8: Performance Optimization Strategy

### Measure First

```python
# Add timing middleware
import time
from flask import request, g

@app.before_request
def before_request():
    g.start_time = time.time()

@app.after_request
def after_request(response):
    if hasattr(g, 'start_time'):
        elapsed = time.time() - g.start_time
        response.headers['X-Response-Time'] = f'{elapsed:.3f}s'
        
        if elapsed > 0.5:  # Log slow requests
            logging.warning(f'Slow request: {request.path} took {elapsed:.3f}s')
    
    return response
```

### Common Optimizations (In Order of Impact)

1. **Add Database Indexes** (biggest impact, lowest effort)
   ```sql
   -- Find slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   
   -- Add indexes for frequently queried columns
   CREATE INDEX idx_documents_owner_created 
   ON documents(owner_id, created_at DESC);
   ```

2. **Fix N+1 Queries** (use joins or eager loading)
   ```python
   # Bad: N+1 query
   documents = Document.query.all()
   for doc in documents:
       print(doc.owner.name)  # Triggers query for each document
   
   # Good: Eager loading
   documents = Document.query.options(
       joinedload(Document.owner)
   ).all()
   ```

3. **Add Caching** (for expensive operations)
   ```python
   from functools import lru_cache
   
   @lru_cache(maxsize=128)
   def get_user_permissions(user_id):
       # Expensive permission calculation
       return Permission.query.filter_by(user_id=user_id).all()
   ```

4. **Use Connection Pooling** (reuse database connections)
   ```python
   # SQLAlchemy connection pool
   app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
       'pool_size': 10,
       'pool_recycle': 3600,
       'pool_pre_ping': True
   }
   ```

5. **Add Pagination** (never return unbounded results)
   ```python
   @app.route('/api/documents')
   def list_documents():
       page = request.args.get('page', 1, type=int)
       per_page = request.args.get('per_page', 20, type=int)
       
       if per_page > 100:
           per_page = 100  # Max limit
       
       documents = Document.query.paginate(
           page=page,
           per_page=per_page,
           error_out=False
       )
       
       return jsonify({
           'items': [doc.to_dict() for doc in documents.items],
           'total': documents.total,
           'page': page,
           'per_page': per_page,
           'pages': documents.pages
       })
   ```

---

## Step 9: Documentation

### Architecture Decision Records (ADRs)

Document significant decisions in `docs/adr/` directory:

```markdown
# ADR 001: Use Monolithic Architecture

## Status
Accepted

## Context
We need to decide on the initial architecture for the federal document management system.

Team size: 5 engineers
Expected users: 10,000 in year 1
Domain: Document management with approval workflows

## Decision
We will use a modular monolithic architecture with clear module boundaries.

## Consequences

### Positive
- Simpler development and deployment
- Easier debugging and testing
- Lower operational overhead
- Faster iteration speed

### Negative
- May need to refactor if we reach 100k+ users
- All modules deployed together

## Alternatives Considered
- Microservices: Rejected due to small team size and operational complexity
- Serverless: Rejected due to federal compliance requirements
```

### System Diagrams (C4 Model)

Create simple diagrams:

```
Level 1: System Context
┌─────────────────────────────────────────┐
│                                         │
│         Federal Document System         │
│                                         │
│  ┌──────────┐      ┌──────────────┐   │
│  │  Users   │─────▶│  Web App     │   │
│  └──────────┘      └──────────────┘   │
│                           │             │
│                           ▼             │
│                    ┌──────────────┐   │
│                    │  PostgreSQL  │   │
│                    └──────────────┘   │
└─────────────────────────────────────────┘

Level 2: Container Diagram
┌────────────────────────────────────────────┐
│  Web Application Container                 │
│                                            │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Users   │  │Documents │  │ Reports │ │
│  │  Module  │  │  Module  │  │ Module  │ │
│  └──────────┘  └──────────┘  └─────────┘ │
│       │             │             │        │
│       └─────────────┴─────────────┘        │
│                     │                      │
│              ┌──────────────┐             │
│              │  Shared DB   │             │
│              └──────────────┘             │
└────────────────────────────────────────────┘
```

---

## Step 10: Final Architecture Checklist

Before considering architecture complete:

- [ ] Project structure follows modular monolith pattern
- [ ] Module boundaries clearly defined
- [ ] Service layer used for business logic (not over-engineered)
- [ ] Database schema normalized with proper constraints
- [ ] Migrations set up and tested
- [ ] No premature abstractions or unused design patterns
- [ ] Performance targets met (measure, don't guess)
- [ ] Architecture decisions documented (ADRs)
- [ ] System diagrams created
- [ ] Team can explain architecture in 5 minutes

---

## Resources

- Martin Fowler - Monolith First: https://martinfowler.com/bliki/MonolithFirst.html
- Sam Newman - Monolith to Microservices: https://samnewman.io/books/monolith-to-microservices/
- C4 Model: https://c4model.com/
- 12-Factor App: https://12factor.net/
- PostgreSQL Documentation: https://www.postgresql.org/docs/
