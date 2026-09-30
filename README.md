# FLOWGUARD

### An Attention Contract Layer for Interruptible Real-Time Agents

> **Samsung PRISM GenAI Hackathon 2026 — Theme 05: Interruptible Real-Time Agents**

FLOWGUARD is a real-time agent orchestration prototype that allows an autonomous agent to work in the background while protecting the user's attention.

Instead of treating every agent event as something that should immediately reach the user, FLOWGUARD introduces an **Attention Contract** between the user and the agent.

The user can define when they want to be interrupted. Background events are then classified as:

* **CONTINUE** — handle the event without disturbing the user.
* **QUEUE** — defer the event until a better moment.
* **INTERRUPT** — request the user's attention because their decision or action is needed.

FLOWGUARD also handles **changing user intent**. When the user changes an instruction, previously started tasks can become stale. FLOWGUARD detects the stale intent, rejects outdated results, cancels affected work, and replans tasks using the new intent.

---

## 1. Problem

Real-time agents are becoming capable of performing multi-step tasks asynchronously.

However, an agent working autonomously creates another problem:

**When should the agent actually interrupt the user?**

If an agent interrupts too frequently, the user loses focus.

If it never interrupts, important decisions may be delayed.

Another problem occurs when the user changes their mind while the agent is already working. Results produced from an older instruction can become invalid.

For example:

```text
User:
"Find AI/ML internships for me."

Agent:
Starts searching and preparing results.

User later:
"Actually, only show paid AI/ML internships."

Problem:
What should happen to the tasks started using the previous instruction?
```

FLOWGUARD addresses both problems:

1. **Attention management**
2. **Intent correction and stale-task protection**

---

## 2. Solution

FLOWGUARD introduces an **Attention Contract Layer** between the user and the autonomous agent.

The user establishes a temporary contract such as:

> "Don't interrupt me unless you really need me."

The agent continues working in the background.

Each important event passes through the Attention Decision Engine before reaching the user.

```text
Background Event
       |
       v
Attention Decision Engine
       |
       +----> CONTINUE
       |
       +----> QUEUE
       |
       +----> INTERRUPT
```

The agent can therefore continue autonomous work without constantly demanding the user's attention.

---

## 3. Attention Contract

An Attention Contract represents the user's current availability and interruption preference.

Example:

```text
Focus Window:
45 minutes

Current Intent:
Find AI/ML internships

Interruption Policy:
Don't interrupt me unless you really need me.
```

The contract allows FLOWGUARD to treat the user's attention as a limited resource.

Routine events can continue automatically.

Uncertain events can be queued.

Important events can request an interruption.

---

## 4. Intent Correction

FLOWGUARD uses **intent versioning** to prevent outdated agent work from overriding a newer user decision.

Example:

```text
Intent v1
"Find AI/ML internships"
```

The agent starts background tasks.

The user then changes the instruction:

```text
Intent v2
"Only paid AI/ML internships"
```

FLOWGUARD performs the following steps:

```text
User changes intent
        |
        v
Intent version v1 -> v2
        |
        v
Check running tasks
        |
        v
Detect tasks using stale intent
        |
        v
Cancel/reject stale work
        |
        v
Reject outdated results
        |
        v
Replan tasks
        |
        v
Execute using Intent v2
```

This prevents a late result from an older instruction from overwriting the user's newer decision.

### Core principle

> **A late result from an old intent must never overwrite a newer user decision.**

---

## 5. Real-Time Decision Engine

FLOWGUARD currently demonstrates three possible decisions.

| Event                             | Decision  | Meaning                               |
| --------------------------------- | --------- | ------------------------------------- |
| Routine background progress       | CONTINUE  | Agent handles it without interrupting |
| Non-urgent uncertainty            | QUEUE     | Agent waits for a better moment       |
| Important or time-sensitive event | INTERRUPT | User attention is requested           |

The user can also manually control the decision through the dashboard.

Available controls include:

* Continue
* Queue
* Interrupt
* Start background work
* Update intent
* Defer an interruption
* Handle an interruption
* Reset the session

---

## 6. Working Prototype

The prototype is implemented as a browser-based real-time dashboard.

The frontend communicates with the backend using WebSockets.

The backend manages:

* Attention contract state
* Current user intent
* Intent versions
* Background tasks
* Task progress
* Task cancellation
* Stale-result detection
* Task replanning
* Runtime events
* Metrics

The prototype demonstrates the concept using an internship-search scenario.

---

## 7. Example Scenario

### Initial instruction

```text
Find AI/ML internships.
```

FLOWGUARD starts background work such as:

```text
Internship Search
Company Research
Application Preparation
```

The agent continues working while the user's attention is protected.

### User correction

The user changes the instruction to:

```text
Only paid AI/ML internships.
```

FLOWGUARD creates a new intent version:

```text
v1 -> v2
```

Tasks based on the old intent become stale.

Their results are rejected and affected work is replanned.

The new task arguments reflect the updated requirement:

```text
searchInternships({
    skill: "AI",
    paidOnly: true,
    remoteOnly: false
})
```

This demonstrates that the agent does not blindly continue executing an outdated plan.

---

## 8. Architecture
<img width="1323" height="694" alt="image" src="https://github.com/user-attachments/assets/adb53fd6-02cd-4844-906f-21eacb36d9c0" />


### Main components

#### Browser Dashboard

Provides:

* Attention state
* Focus timer
* Current intent
* Background task progress
* Decision controls
* Activity log
* Runtime metrics

#### Session & State Manager

Maintains:

* Attention contract
* Current intent
* Intent version
* Running tasks
* Events
* Runtime metrics

#### Task Manager

Responsible for:

* Creating tasks
* Running asynchronous tasks
* Tracking task progress
* Cancelling stale tasks
* Updating task state

#### Attention Decision Engine

Evaluates background events and determines:

```text
CONTINUE
QUEUE
INTERRUPT
```

#### Tool Orchestrator

Coordinates the local tools used by the prototype.

#### Local Tool Layer

The current prototype uses a deterministic local internship dataset.

---

## 9. Technology Stack

### Frontend

* HTML
* CSS
* JavaScript
* WebSocket client

### Backend

* Node.js
* Express.js
* WebSocket (`ws`)
* Asynchronous JavaScript execution

### Data / Tools

* JSON
* Local deterministic internship dataset
* Custom JavaScript tool functions

### Development

* Visual Studio Code
* Git
* GitHub

---

## 10. Project Structure

```text
FlowGuard/
│
├── data/
│   └── internships.json
│
├── tools/
│   └── internshipTools.js
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

---

## 11. Local Tool Layer

The prototype contains three main tool functions:

```text
searchInternships()
filterByDeadline()
rankInternships()
```

The internship dataset contains example internship records with fields such as:

* Company
* Role
* Location
* Paid status
* Skills
* Deadline

The data is intentionally local and deterministic so that the prototype can demonstrate agent behavior reliably without requiring paid APIs or external services.

**The internship data is not intended to represent a live job-search service.**

---

## 12. How to Run

### Requirements

Install:

* Node.js
* npm
* Git

No paid API or external AI service is required to run the current prototype.

### Step 1 — Clone the repository

```bash
git clone https://github.com/SurbhiKaushal/FlowGuard.git
```

### Step 2 — Open the project

```bash
cd FlowGuard
```

### Step 3 — Install dependencies

```bash
npm install
```

### Step 4 — Start the server

```bash
npm start
```

The application will start on the local server.

Open the displayed localhost address in a browser.

---

## 13. Demo Flow

The recommended demonstration flow is:

### Step 1

Open the FLOWGUARD dashboard.

### Step 2

Start background work.

### Step 3

Observe asynchronous tasks running in the background.

### Step 4

Demonstrate the Attention Decision Engine:

```text
CONTINUE
QUEUE
INTERRUPT
```

### Step 5

Change the user intent:

```text
Find AI/ML internships
```

to:

```text
Only paid AI/ML internships
```

### Step 6

Observe:

```text
Intent v1 -> v2
```

### Step 7

Observe stale tasks/results being rejected.

### Step 8

Observe new tasks being replanned using the updated intent.

### Step 9

Review the runtime metrics and activity log.

---

## 14. Metrics

FLOWGUARD tracks runtime metrics related to attention management and correction.

The dashboard currently displays:

* Total Events
* Continued Events
* Queued Events
* Interrupted Events
* Corrections
* Stale Tasks Cancelled
* Average Interrupt Latency

These metrics are intended to make agent behavior observable rather than treating interruption as an invisible side effect.

**The current prototype does not claim benchmark performance on FDB-v3.**

---

## 15. Key Technical Ideas

### 1. Attention as a Contract

The user's attention is treated as a resource that an agent should request deliberately.

### 2. Intent Versioning

Every major user instruction update creates a new intent version.

```text
v1 -> v2 -> v3 ...
```

### 3. Stale Task Detection

Tasks created under an older intent can be identified as stale when the intent changes.

### 4. Stale Result Rejection

Results from outdated tasks are rejected instead of being applied to the current state.

### 5. Asynchronous Execution

Multiple background tasks can progress without blocking the user interface.

### 6. Real-Time Communication

WebSockets provide bidirectional communication between the dashboard and backend.

### 7. Explicit User Control

The user can continue, queue, interrupt, defer, or handle events rather than being forced into a single interaction pattern.

---

## 16. Why This Matters for Interruptible Agents

Traditional assistants often treat interaction as:

```text
User asks
   ↓
Agent responds
   ↓
Interaction ends
```

An interruptible agent can instead operate continuously:

```text
User
 ↓
Intent + Attention Contract
 ↓
Agent works asynchronously
 ↓
Background events
 ↓
Attention Decision
 ↓
Continue / Queue / Interrupt
 ↓
User correction
 ↓
Replan
 ↓
Continue execution
```

FLOWGUARD focuses on the layer that determines **when autonomous execution should require human attention** and **how the agent should react when the user's intent changes during execution**.

---

## 17. Limitations

The current prototype is a hackathon demonstration and has several limitations:

* The internship dataset is local rather than live.
* The current attention decision logic is implemented as prototype logic rather than a production-scale learned model.
* The prototype currently demonstrates browser-based interaction rather than direct integration with Galaxy hardware.
* The current prototype does not claim full FDB-v3 benchmark coverage.
* Production deployment would require stronger persistence, authentication, security, fault recovery, and more sophisticated task scheduling.

---

## 18. Future Scope

Potential future extensions include:

* Full-duplex voice interaction
* Multimodal interruption signals
* Device-level notification control
* Galaxy device integration
* Context-aware interruption policies
* More sophisticated urgency and importance estimation
* Multi-agent arbitration
* Persistent task recovery
* Live external tools and APIs
* Evaluation on FDB-v3 and other full-duplex benchmarks
* Personalized attention policies
* Cross-device agent coordination

---

## 19. Samsung Relevance

Samsung is expanding Galaxy AI toward more agentic, connected, and cross-application experiences.

FLOWGUARD explores a complementary problem:

> **When an agent can act autonomously, how should it decide when the user's attention is actually required?**

The prototype is designed as an **attention-management layer** that could conceptually sit between autonomous agent execution and user-facing interaction.

It is not a replacement for Samsung's existing agentic systems.

---

## 20. AI Disclosure

Generative AI tools were used during the development process for:

* Brainstorming and refining the project concept
* Explaining programming concepts
* Assisting with code generation and debugging
* Improving documentation and presentation wording

The final project structure, implementation, integration, testing, debugging, and demonstration were reviewed and assembled by the project team.

The prototype's runtime behavior is implemented using the project's JavaScript/Node.js code and local deterministic data.

---

## 21. Hackathon Information

**Event:** Samsung PRISM GenAI Hackathon 2026

**Theme:** Theme 05 — Interruptible Real-Time Agents

**Project:** FLOWGUARD

**Tag:**

```text
PRISM_GENAI_HACKATHON_Y2026
```

---

## 22. Repository

GitHub:

https://github.com/SurbhiKaushal/FlowGuard

---

## 23. Demo

Demo Video:

**[Add your YouTube / Google Drive demo link here]**

---

## 24. Presentation

The project presentation is included in the repository:

```text
docs/FLOWGUARD_Presentation.pptx
```

---

## 25. Team

**Project:** FLOWGUARD

**Samsung PRISM GenAI Hackathon 2026**

**Theme 05 — Interruptible Real-Time Agents**

---

### FLOWGUARD

> **Let the agent do the work. Let the user decide when their attention matters.**
