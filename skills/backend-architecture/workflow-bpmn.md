# Workflow and BPMN Implementation

**Trigger**: Use when the user asks about workflows, approval processes, business processes, BPMN, or mentions Camunda, Temporal, Airflow, or similar workflow engines.

**Description**: This skill guides you through implementing workflow-style applications using open-source BPMN frameworks instead of building custom workflow logic from scratch.

---

## When to Use This Skill

- User asks to implement an approval workflow
- User mentions multi-step business processes
- User asks about BPMN or workflow engines
- User needs long-running processes (days/weeks)
- User needs human-in-the-loop processes
- User asks about process orchestration
- User needs compensation logic (undo on failure)

---

## When NOT to Use Workflows

Don't use workflow engines for:
- ❌ Simple state machines (use a `status` column)
- ❌ Real-time request-response APIs
- ❌ Simple background jobs (use task queue)
- ❌ Scheduled tasks (use cron)
- ❌ Processes that complete in <1 minute

---

## Decision Tree: Which Workflow Framework?

### Step 1: Identify Your Use Case

**Simple Background Jobs** (email, reports, data processing)
→ Use task queue (Celery, Bull, Sidekiq)
→ Skip to "Task Queue Implementation" section

**Multi-Step Approval Workflows** (document review, procurement)
→ Use BPMN engine (Camunda, Temporal)
→ Continue to Step 2

**Data Pipelines** (ETL, batch processing)
→ Use Airflow or Prefect
→ Skip to "Data Pipeline Workflows" section

### Step 2: Choose BPMN Engine by Language

**Python:**
- **Temporal.io** - Best for durable execution, retries, long-running processes
- **Prefect** - Modern alternative to Airflow, better DX
- **Airflow** - Industry standard for data pipelines (overkill for simple workflows)

**Node.js:**
- **Temporal.io** - Same as Python, excellent Node.js SDK
- **Bull/BullMQ** - Redis-based, good for job queues
- **Camunda** - Full BPMN 2.0 engine (requires Java runtime)

**Java:**
- **Camunda** - Industry standard, visual designer, full BPMN 2.0
- **Activiti** - Open-source, less actively maintained
- **jBPM** - Red Hat, good for enterprise

### Step 3: Complexity Assessment

**Simple Workflow** (3-5 steps, no branching)
→ Consider task queue first
→ If workflow engine needed, use Temporal

**Complex Workflow** (10+ steps, branching, parallel execution)
→ Use Camunda (Java) or Temporal (Python/Node.js)

**Visual Modeling Required** (business users design workflows)
→ Use Camunda (has visual BPMN designer)

---

## Implementation Guide: Temporal.io (Python)

### Why Temporal?

- Durable execution (survives crashes)
- Automatic retries with exponential backoff
- Built-in versioning
- Excellent observability
- Supports long-running workflows (days/weeks)
- No external database required (uses event sourcing)

### Installation

```bash
# Install Temporal Python SDK
pip install temporalio

# Start Temporal server (Docker)
docker run -d -p 7233:7233 -p 8233:8233 temporalio/auto-setup:latest
```

### Example: Document Approval Workflow

```python
# workflows/document_approval.py
from datetime import timedelta
from temporalio import workflow
from temporalio.common import RetryPolicy

@workflow.defn
class DocumentApprovalWorkflow:
    """
    Multi-step document approval workflow
    
    Steps:
    1. Submit document for review
    2. Assign to reviewer
    3. Wait for review (human task)
    4. If approved, publish document
    5. If rejected, notify author
    """
    
    @workflow.run
    async def run(self, document_id: str, author_id: str) -> dict:
        # Step 1: Validate document
        await workflow.execute_activity(
            validate_document,
            document_id,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=10)
            )
        )
        
        # Step 2: Assign to reviewer
        reviewer_id = await workflow.execute_activity(
            assign_reviewer,
            document_id,
            start_to_close_timeout=timedelta(minutes=5)
        )
        
        # Step 3: Wait for review (human task)
        # This can wait for days without blocking resources
        review_result = await workflow.wait_condition(
            lambda: self.review_completed,
            timeout=timedelta(days=7)
        )
        
        if not review_result:
            # Timeout - escalate
            await workflow.execute_activity(
                escalate_review,
                document_id,
                reviewer_id,
                start_to_close_timeout=timedelta(minutes=5)
            )
            # Wait another 3 days
            review_result = await workflow.wait_condition(
                lambda: self.review_completed,
                timeout=timedelta(days=3)
            )
        
        # Step 4: Process review result
        if review_result and review_result['approved']:
            # Publish document
            await workflow.execute_activity(
                publish_document,
                document_id,
                start_to_close_timeout=timedelta(minutes=10)
            )
            
            # Notify author
            await workflow.execute_activity(
                notify_author,
                author_id,
                'approved',
                start_to_close_timeout=timedelta(minutes=5)
            )
            
            return {'status': 'approved', 'document_id': document_id}
        else:
            # Reject document
            rejection_reason = review_result.get('reason', 'No reason provided')
            
            await workflow.execute_activity(
                notify_author,
                author_id,
                'rejected',
                rejection_reason,
                start_to_close_timeout=timedelta(minutes=5)
            )
            
            return {
                'status': 'rejected',
                'document_id': document_id,
                'reason': rejection_reason
            }
    
    @workflow.signal
    def submit_review(self, review_result: dict):
        """Signal from external system when review is completed"""
        self.review_completed = review_result
```

### Activity Implementations

```python
# activities/document_activities.py
from temporalio import activity

@activity.defn
async def validate_document(document_id: str) -> bool:
    """Validate document meets requirements"""
    # Fetch document from database
    document = await db.documents.find_one({'_id': document_id})
    
    if not document:
        raise ValueError(f'Document {document_id} not found')
    
    # Validation logic
    if not document.get('title'):
        raise ValueError('Document must have a title')
    
    if not document.get('content'):
        raise ValueError('Document must have content')
    
    if len(document['content']) < 100:
        raise ValueError('Document content too short (min 100 characters)')
    
    # Update document status
    await db.documents.update_one(
        {'_id': document_id},
        {'$set': {'status': 'pending_review', 'validated_at': datetime.utcnow()}}
    )
    
    return True

@activity.defn
async def assign_reviewer(document_id: str) -> str:
    """Assign document to available reviewer"""
    # Find available reviewer (round-robin or load-based)
    reviewer = await db.users.find_one({
        'role': 'reviewer',
        'is_active': True,
        'current_workload': {'$lt': 10}
    })
    
    if not reviewer:
        raise ValueError('No available reviewers')
    
    # Assign document
    await db.documents.update_one(
        {'_id': document_id},
        {'$set': {'reviewer_id': reviewer['_id'], 'assigned_at': datetime.utcnow()}}
    )
    
    # Increment reviewer workload
    await db.users.update_one(
        {'_id': reviewer['_id']},
        {'$inc': {'current_workload': 1}}
    )
    
    # Send notification
    await send_email(
        to=reviewer['email'],
        subject='New Document for Review',
        body=f'Document {document_id} has been assigned to you for review.'
    )
    
    return str(reviewer['_id'])

@activity.defn
async def publish_document(document_id: str) -> bool:
    """Publish approved document"""
    await db.documents.update_one(
        {'_id': document_id},
        {'$set': {
            'status': 'published',
            'published_at': datetime.utcnow()
        }}
    )
    
    # Create public version
    document = await db.documents.find_one({'_id': document_id})
    await db.published_documents.insert_one({
        'original_id': document_id,
        'title': document['title'],
        'content': document['content'],
        'author_id': document['author_id'],
        'published_at': datetime.utcnow()
    })
    
    return True

@activity.defn
async def notify_author(author_id: str, status: str, reason: str = None):
    """Notify author of review result"""
    author = await db.users.find_one({'_id': author_id})
    
    if status == 'approved':
        subject = 'Your Document Has Been Approved'
        body = 'Your document has been reviewed and approved for publication.'
    else:
        subject = 'Your Document Has Been Rejected'
        body = f'Your document has been rejected. Reason: {reason}'
    
    await send_email(
        to=author['email'],
        subject=subject,
        body=body
    )
```

### Worker Setup

```python
# worker.py
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker
from workflows.document_approval import DocumentApprovalWorkflow
from activities.document_activities import (
    validate_document,
    assign_reviewer,
    publish_document,
    notify_author,
    escalate_review
)

async def main():
    # Connect to Temporal server
    client = await Client.connect("localhost:7233")
    
    # Create worker
    worker = Worker(
        client,
        task_queue="document-approval",
        workflows=[DocumentApprovalWorkflow],
        activities=[
            validate_document,
            assign_reviewer,
            publish_document,
            notify_author,
            escalate_review
        ]
    )
    
    # Run worker
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
```

### Starting Workflows from API

```python
# api/routes.py
from flask import Blueprint, request, jsonify
from temporalio.client import Client

workflows_bp = Blueprint('workflows', __name__, url_prefix='/api/workflows')

@workflows_bp.route('/document-approval', methods=['POST'])
@login_required
async def start_document_approval(current_user):
    """Start document approval workflow"""
    data = request.json
    document_id = data.get('document_id')
    
    # Connect to Temporal
    client = await Client.connect("localhost:7233")
    
    # Start workflow
    handle = await client.start_workflow(
        DocumentApprovalWorkflow.run,
        document_id,
        current_user.id,
        id=f"document-approval-{document_id}",
        task_queue="document-approval"
    )
    
    return jsonify({
        'workflow_id': handle.id,
        'document_id': document_id,
        'status': 'started'
    }), 202

@workflows_bp.route('/document-approval/<workflow_id>/review', methods=['POST'])
@login_required
async def submit_review(current_user, workflow_id):
    """Submit review result (signals workflow)"""
    data = request.json
    
    # Verify reviewer
    if not current_user.has_role('reviewer'):
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Connect to Temporal
    client = await Client.connect("localhost:7233")
    
    # Get workflow handle
    handle = client.get_workflow_handle(workflow_id)
    
    # Send signal to workflow
    await handle.signal(
        DocumentApprovalWorkflow.submit_review,
        {
            'approved': data.get('approved'),
            'reason': data.get('reason'),
            'reviewer_id': current_user.id
        }
    )
    
    return jsonify({'status': 'review_submitted'}), 200
```

---

## Implementation Guide: Camunda (Java/Spring Boot)

### Why Camunda?

- Full BPMN 2.0 compliance
- Visual workflow designer (Camunda Modeler)
- Excellent for complex workflows
- Battle-tested in enterprise environments
- Good for when business users need to design workflows

### Installation

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.camunda.bpm.springboot</groupId>
    <artifactId>camunda-bpm-spring-boot-starter-rest</artifactId>
    <version>7.19.0</version>
</dependency>

<dependency>
    <groupId>org.camunda.bpm.springboot</groupId>
    <artifactId>camunda-bpm-spring-boot-starter-webapp</artifactId>
    <version>7.19.0</version>
</dependency>
```

### BPMN Process Definition

Create `document-approval.bpmn` using Camunda Modeler:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  
  <bpmn:process id="document-approval" name="Document Approval" isExecutable="true">
    
    <!-- Start Event -->
    <bpmn:startEvent id="start" name="Document Submitted">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <!-- Service Task: Validate Document -->
    <bpmn:serviceTask id="validate" name="Validate Document"
                      camunda:delegateExpression="${validateDocumentDelegate}">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <!-- Service Task: Assign Reviewer -->
    <bpmn:serviceTask id="assign" name="Assign Reviewer"
                      camunda:delegateExpression="${assignReviewerDelegate}">
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <!-- User Task: Review Document -->
    <bpmn:userTask id="review" name="Review Document"
                   camunda:assignee="${reviewerId}">
      <bpmn:incoming>flow3</bpmn:incoming>
      <bpmn:outgoing>flow4</bpmn:outgoing>
    </bpmn:userTask>
    
    <!-- Exclusive Gateway: Approved? -->
    <bpmn:exclusiveGateway id="gateway" name="Approved?">
      <bpmn:incoming>flow4</bpmn:incoming>
      <bpmn:outgoing>flowApproved</bpmn:outgoing>
      <bpmn:outgoing>flowRejected</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <!-- Service Task: Publish Document -->
    <bpmn:serviceTask id="publish" name="Publish Document"
                      camunda:delegateExpression="${publishDocumentDelegate}">
      <bpmn:incoming>flowApproved</bpmn:incoming>
      <bpmn:outgoing>flowEnd1</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <!-- Service Task: Notify Rejection -->
    <bpmn:serviceTask id="notifyRejection" name="Notify Author"
                      camunda:delegateExpression="${notifyRejectionDelegate}">
      <bpmn:incoming>flowRejected</bpmn:incoming>
      <bpmn:outgoing>flowEnd2</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <!-- End Events -->
    <bpmn:endEvent id="endApproved" name="Document Published">
      <bpmn:incoming>flowEnd1</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:endEvent id="endRejected" name="Document Rejected">
      <bpmn:incoming>flowEnd2</bpmn:incoming>
    </bpmn:endEvent>
    
    <!-- Sequence Flows -->
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="validate" />
    <bpmn:sequenceFlow id="flow2" sourceRef="validate" targetRef="assign" />
    <bpmn:sequenceFlow id="flow3" sourceRef="assign" targetRef="review" />
    <bpmn:sequenceFlow id="flow4" sourceRef="review" targetRef="gateway" />
    
    <bpmn:sequenceFlow id="flowApproved" sourceRef="gateway" targetRef="publish">
      <bpmn:conditionExpression>${approved == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:sequenceFlow id="flowRejected" sourceRef="gateway" targetRef="notifyRejection">
      <bpmn:conditionExpression>${approved == false}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:sequenceFlow id="flowEnd1" sourceRef="publish" targetRef="endApproved" />
    <bpmn:sequenceFlow id="flowEnd2" sourceRef="notifyRejection" targetRef="endRejected" />
    
  </bpmn:process>
</bpmn:definitions>
```

### Java Delegates (Service Tasks)

```java
// ValidateDocumentDelegate.java
@Component("validateDocumentDelegate")
public class ValidateDocumentDelegate implements JavaDelegate {
    
    @Autowired
    private DocumentRepository documentRepository;
    
    @Override
    public void execute(DelegateExecution execution) throws Exception {
        String documentId = (String) execution.getVariable("documentId");
        
        Document document = documentRepository.findById(documentId)
            .orElseThrow(() -> new RuntimeException("Document not found"));
        
        // Validation logic
        if (document.getTitle() == null || document.getTitle().isEmpty()) {
            throw new BpmnError("VALIDATION_ERROR", "Document must have a title");
        }
        
        if (document.getContent() == null || document.getContent().length() < 100) {
            throw new BpmnError("VALIDATION_ERROR", "Document content too short");
        }
        
        // Update status
        document.setStatus("PENDING_REVIEW");
        document.setValidatedAt(LocalDateTime.now());
        documentRepository.save(document);
        
        execution.setVariable("validated", true);
    }
}

// AssignReviewerDelegate.java
@Component("assignReviewerDelegate")
public class AssignReviewerDelegate implements JavaDelegate {
    
    @Autowired
    private UserRepository userRepository;
    
    @Override
    public void execute(DelegateExecution execution) throws Exception {
        // Find available reviewer
        User reviewer = userRepository.findAvailableReviewer()
            .orElseThrow(() -> new RuntimeException("No available reviewers"));
        
        String documentId = (String) execution.getVariable("documentId");
        
        // Assign document
        Document document = documentRepository.findById(documentId).get();
        document.setReviewerId(reviewer.getId());
        document.setAssignedAt(LocalDateTime.now());
        documentRepository.save(document);
        
        // Set variable for user task
        execution.setVariable("reviewerId", reviewer.getId());
        
        // Send notification
        emailService.sendReviewAssignment(reviewer.getEmail(), documentId);
    }
}
```

### REST API Integration

```java
// WorkflowController.java
@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {
    
    @Autowired
    private RuntimeService runtimeService;
    
    @Autowired
    private TaskService taskService;
    
    @PostMapping("/document-approval")
    public ResponseEntity<Map<String, String>> startApprovalWorkflow(
            @RequestBody DocumentApprovalRequest request,
            @AuthenticationPrincipal User currentUser) {
        
        Map<String, Object> variables = new HashMap<>();
        variables.put("documentId", request.getDocumentId());
        variables.put("authorId", currentUser.getId());
        
        ProcessInstance instance = runtimeService.startProcessInstanceByKey(
            "document-approval",
            request.getDocumentId(),
            variables
        );
        
        Map<String, String> response = new HashMap<>();
        response.put("processInstanceId", instance.getId());
        response.put("documentId", request.getDocumentId());
        
        return ResponseEntity.accepted().body(response);
    }
    
    @PostMapping("/tasks/{taskId}/complete")
    public ResponseEntity<Void> completeTask(
            @PathVariable String taskId,
            @RequestBody Map<String, Object> variables,
            @AuthenticationPrincipal User currentUser) {
        
        // Verify task is assigned to current user
        Task task = taskService.createTaskQuery()
            .taskId(taskId)
            .taskAssignee(currentUser.getId())
            .singleResult();
        
        if (task == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        // Complete task with variables
        taskService.complete(taskId, variables);
        
        return ResponseEntity.ok().build();
    }
}
```

---

## Task Queue Implementation (Simple Workflows)

For simple background jobs, use a task queue instead of a workflow engine.

### Python/Celery Example

```python
# tasks.py
from celery import Celery, chain, group

app = Celery('tasks', broker='redis://localhost:6379/0')

@app.task
def validate_document(document_id):
    """Validate document"""
    document = Document.query.get(document_id)
    # Validation logic
    return document_id

@app.task
def assign_reviewer(document_id):
    """Assign reviewer"""
    # Assignment logic
    return reviewer_id

@app.task
def send_notification(reviewer_id, document_id):
    """Send notification"""
    # Send email
    return True

# Chain tasks together
def start_approval_workflow(document_id):
    """Start approval workflow as task chain"""
    workflow = chain(
        validate_document.s(document_id),
        assign_reviewer.s(),
        send_notification.s(document_id)
    )
    workflow.apply_async()
```

---

## BPMN Best Practices

### 1. Keep Workflows Simple

- Max 5-10 steps per workflow
- Split complex workflows into sub-processes
- Use clear, descriptive names for tasks

### 2. Handle Errors Gracefully

```python
# Temporal error handling
@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self):
        try:
            await workflow.execute_activity(
                risky_activity,
                retry_policy=RetryPolicy(maximum_attempts=3)
            )
        except ActivityError as e:
            # Log error
            workflow.logger.error(f"Activity failed: {e}")
            
            # Compensation logic
            await workflow.execute_activity(
                rollback_activity
            )
            
            raise
```

### 3. Version Workflows

```python
# Temporal versioning
@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self):
        # Check workflow version
        version = workflow.get_version("my-change", Workflow.DEFAULT_VERSION, 2)
        
        if version == 1:
            # Old behavior
            result = await old_activity()
        else:
            # New behavior
            result = await new_activity()
```

### 4. Monitor and Observe

- Track workflow execution times
- Monitor failure rates
- Set up alerts for stuck workflows
- Use workflow engine's built-in dashboards

---

## Common Mistakes to Avoid

1. **Using workflows for simple tasks**: Use task queues instead
2. **Not handling timeouts**: Always set timeouts on activities
3. **Modifying running workflows**: Use versioning instead
4. **Tight coupling**: Workflows should be independent
5. **No compensation logic**: Always plan for rollback
6. **Ignoring monitoring**: Set up observability from day one

---

## Resources

- Temporal Documentation: https://docs.temporal.io/
- Camunda Documentation: https://docs.camunda.org/
- BPMN 2.0 Specification: https://www.omg.org/spec/BPMN/2.0/
- Airflow Documentation: https://airflow.apache.org/docs/
- Prefect Documentation: https://docs.prefect.io/
