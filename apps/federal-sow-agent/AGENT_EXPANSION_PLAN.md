# Federal Document Writer Agent Expansion Plan

## 1. Conceptual Shift
Transitioning from a single-purpose "SOW Agent" to a "General Federal Document Agent" is a highly scalable and valuable approach. By allowing users to select an "Agent Persona" or "Document Type," the application becomes a central hub for acquisition and project management drafting.

### Do they need to be trained?
**No.** Modern Large Language Models (LLMs) like GPT-4o, Claude 3.5 Sonnet, or Gemini Pro do not require fine-tuning (training) for these tasks. 

They only need **special instructions (System Prompts)**. This is known as "in-context learning." You can define an agent simply by providing a robust system prompt that dictates its persona, tone, rules, and the structure of the document it needs to produce.

## 2. Proposed Agent Types (Personas)
We can structure the different agents as a configuration dictionary in the backend, mapping an `agent_type` to a specific set of instructions.

1. **SOW/PWS Writer:** 
   - *Persona:* Expert Federal Contracting Officer Representative (COR).
   - *Task:* Draft clear, measurable Statements of Work or Performance Work Statements.
2. **IGCE (Cost Estimator) Analyst:**
   - *Persona:* Federal Financial Analyst / Cost Estimator.
   - *Task:* Analyze context documents to extract labor categories, hours, and materials to draft an Independent Government Cost Estimate justification.
3. **Requirements Analyst (PRS/SRD):**
   - *Persona:* Senior Systems Engineer / Business Analyst.
   - *Task:* Draft System Requirements Documents (SRD) or Performance Requirements Summaries (PRS) with acceptable quality levels (AQLs).
4. **Market Research Analyst:**
   - *Persona:* Procurement Analyst.
   - *Task:* Synthesize vendor capabilities and industry data to draft a Market Research Report.

## 3. Architectural Changes Required

### A. Database (Models)
- Update the `AgentSession` model to include an `agent_type` column (String).
- *Optional:* Create a new `AgentPersona` table if you want admins to create custom agents dynamically via the UI. For the immediate future, a hardcoded dictionary in the backend is simpler and faster.

### B. Backend (FastAPI)
- **New Endpoint:** `GET /agents` to list available agent types, their descriptions, and icons.
- **Update Session Creation:** `POST /workspaces/{id}/sessions` must now accept an `agent_type` parameter.
- **Dynamic Prompting:** In the `generate.py` router, look up the `agent_type` for the current session and inject the corresponding System Prompt into the LangChain pipeline instead of the hardcoded SOW prompt.

### C. Frontend (React / USWDS)
- **Rebranding:** Change titles from "Federal SOW Writer Agent" to "Federal Document Writer Agent".
- **Wizard Step 0 / New Session Flow:** When a user clicks "New Session," instead of immediately creating it, present a modal or a new Wizard Step: "Select your Agent."
- **Agent Selection UI:** Display a grid of USWDS cards for each agent type (SOW, Cost Estimation, Requirements). The user selects one, names the session, and the session is created with that specific type.
- **Dynamic Context:** Update the UI text based on the selected agent (e.g., if Cost Estimator is selected, prompt the user to "Upload pricing sheets, labor rates, and historical costs").

## 4. Execution Steps (To-Dos)

- [ ] **Step 1: Backend Data Model Update**
  - Add `agent_type: Mapped[str] = mapped_column(String(64), default="sow")` to `AgentSession` in `models.py`.
  - Update `schemas.py` to accept `agent_type` in `SessionCreate`.
  - Provide a migration/re-init of the database.

- [ ] **Step 2: Define Agent Profiles (Backend)**
  - Create `app/agents_config.py`.
  - Define a dictionary of agents with `id`, `name`, `description`, and `system_prompt`.
  - Update LangChain generation logic to use `session.agent_type` to fetch the right system prompt.
  - Create a `GET /agents` route to serve the available agent list to the frontend.

- [ ] **Step 3: Frontend Rebranding & API Updates**
  - Update `api.js` to handle fetching agents and passing `agent_type` when creating a session.
  - Change global titles and headers to "Federal Document Writer".

- [ ] **Step 4: Frontend Agent Selection UI**
  - Modify the "New session" button behavior.
  - Create a modal or a dedicated view showing USWDS cards for each available agent.
  - When the user selects an agent card, prompt for the session title, then call `api.createSession(workspaceId, title, agent_type)`.
  - Display the selected agent type as a badge next to the session name in the sidebar and toolbar.
