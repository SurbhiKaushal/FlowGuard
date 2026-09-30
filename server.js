const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const {
    searchInternships,
    filterByDeadline,
    rankInternships
} = require("./tools/internshipTools");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

let intentVersion = 1;
let currentIntent = "Find AI/ML internships";

let attentionContract = {
    state: "STUDYING",
    remainingSeconds: 1800,
    interruptRules: {
        decisionRequired: true,
        criticalDeadline: true,
        unsafeAction: true
    }
};

let tasks = [];
let events = [];

let metrics = {
    totalEvents: 0,
    continueCount: 0,
    queueCount: 0,
    interruptCount: 0,
    userInterruptions: 0,
    staleTasksCancelled: 0,
    corrections: 0,
    averageInterruptLatency: 0,
    toolCalls: 0,
    staleResultsRejected: 0,
    completedTasks: 0
};

let interruptTimes = [];
let agentRunId = 0;


/* ------------------------------------------------ */
/* BASIC HELPERS                                    */
/* ------------------------------------------------ */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function broadcast(message) {
    const data = JSON.stringify(message);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function logEvent(message, type = "INFO") {
    const event = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        message,
        type
    };

    events.unshift(event);

    if (events.length > 100) {
        events.pop();
    }

    broadcast({
        type: "event",
        event
    });
}

function sendState() {
    broadcast({
        type: "state",
        state: {
            intentVersion,
            currentIntent,
            attentionContract,
            tasks,
            events,
            metrics
        }
    });
}


/* ------------------------------------------------ */
/* TASK MANAGEMENT                                  */
/* ------------------------------------------------ */

function createTask(name, type = "research") {
    return {
        id: Date.now() + Math.random(),
        name,
        type,
        status: "RUNNING",
        progress: 0,
        version: intentVersion,
        cancelled: false,
        currentStep: "Preparing",
        toolCalls: 0,
        results: [],
        startedAt: Date.now()
    };
}

function isTaskStale(task) {
    return (
        task.version !== intentVersion ||
        task.cancelled ||
        (
            task.status !== "RUNNING" &&
            task.status !== "TOOL_RUNNING"
        )
    );
}

function cancelTask(task, reason) {
    if (
        task.status !== "RUNNING" &&
        task.status !== "TOOL_RUNNING"
    ) {
        return false;
    }

    task.status = "CANCELLED";
    task.cancelled = true;
    task.currentStep = "Cancelled";

    metrics.staleTasksCancelled++;

    logEvent(
        `${task.name} cancelled: ${reason}`,
        "CANCEL"
    );

    sendState();

    return true;
}

function cancelStaleTasks() {
    tasks.forEach(task => {

        if (
            task.version < intentVersion &&
            (
                task.status === "RUNNING" ||
                task.status === "TOOL_RUNNING"
            )
        ) {
            cancelTask(
                task,
                `intent v${task.version} is older than current intent v${intentVersion}`
            );
        }

    });
}


/* ------------------------------------------------ */
/* TOOL EXECUTION                                   */
/* ------------------------------------------------ */

async function executeTool(task, toolName, args = {}) {

    if (isTaskStale(task)) {
        return {
            stale: true,
            result: null
        };
    }

    task.status = "TOOL_RUNNING";
    task.currentStep = `Calling ${toolName}`;
    task.toolCalls++;

    metrics.toolCalls++;

    logEvent(
        `${task.name} → ${toolName}(${JSON.stringify(args)})`,
        "TOOL"
    );

    sendState();

    await sleep(1800);

    if (isTaskStale(task)) {

        metrics.staleResultsRejected++;

        logEvent(
            `${toolName} result rejected because task intent v${task.version} is stale.`,
            "STALE_RESULT"
        );

        task.status = "CANCELLED";
        task.cancelled = true;
        task.currentStep = "Stale result rejected";

        sendState();

        return {
            stale: true,
            result: null
        };
    }

    let result;

    try {

        if (toolName === "searchInternships") {

            result = searchInternships(args);

        } else if (toolName === "filterByDeadline") {

            result = filterByDeadline(
                args.internships,
                args.days
            );

        } else if (toolName === "rankInternships") {

            result = rankInternships(
                args.internships
            );

        } else {

            throw new Error(`Unknown tool: ${toolName}`);

        }

    } catch (error) {

        task.status = "FAILED";
        task.currentStep = "Tool failed";

        logEvent(
            `${toolName} failed: ${error.message}`,
            "ERROR"
        );

        sendState();

        return {
            stale: false,
            result: null,
            error: error.message
        };
    }

    task.results.push({
        tool: toolName,
        arguments: args,
        result
    });

    task.status = "RUNNING";
    task.currentStep = `${toolName} completed`;

    logEvent(
        `${toolName} completed with ${Array.isArray(result) ? result.length : 1} result(s).`,
        "TOOL_RESULT"
    );

    sendState();

    return {
        stale: false,
        result
    };
}


/* ------------------------------------------------ */
/* AGENT PLAN                                       */
/* ------------------------------------------------ */

function determineSearchArguments() {

    const text = currentIntent.toLowerCase();

    const args = {
        skill: "Python",
        paidOnly: false,
        remoteOnly: false
    };

    if (
        text.includes("paid") ||
        text.includes("stipend")
    ) {
        args.paidOnly = true;
    }

    if (
        text.includes("remote") ||
        text.includes("work from home")
    ) {
        args.remoteOnly = true;
    }

    if (text.includes("java")) {
        args.skill = "Java";
    }

    if (
        text.includes("machine learning") ||
        text.includes("ml")
    ) {
        args.skill = "Machine Learning";
    }

    if (text.includes("ai")) {
        args.skill = "AI";
    }

    if (text.includes("python")) {
        args.skill = "Python";
    }

    return args;
}


/* ------------------------------------------------ */
/* AGENT EVENT ENGINE                               */
/* ------------------------------------------------ */

function evaluateEvent(event) {

    metrics.totalEvents++;

    let decision = "QUEUE";

    if (event.canAutoResolve) {
        decision = "CONTINUE";
    }

    if (
        event.requiresDecision &&
        !event.canAutoResolve
    ) {
        decision = "QUEUE";
    }

    if (
        event.criticalDeadline ||
        (
            event.requiresDecision &&
            event.userConfirmationRequired
        )
    ) {
        decision = "INTERRUPT";
    }

    if (
        decision === "INTERRUPT" &&
        attentionContract.interruptRules.decisionRequired
    ) {

        metrics.interruptCount++;

        const now = Date.now();

        if (event.generatedAt) {

            const latency =
                now - event.generatedAt;

            interruptTimes.push(latency);

            metrics.averageInterruptLatency =
                Math.round(
                    interruptTimes.reduce(
                        (a, b) => a + b,
                        0
                    ) /
                    interruptTimes.length
                );
        }

        logEvent(
            `FLOWGUARD decided to INTERRUPT: ${event.message}`,
            "INTERRUPT"
        );

        broadcast({
            type: "interrupt",
            reason: event.message
        });

        sendState();

        return "INTERRUPT";
    }

    if (decision === "CONTINUE") {

        metrics.continueCount++;

        logEvent(
            `FLOWGUARD decided to CONTINUE: ${event.message}`,
            "CONTINUE"
        );

        sendState();

        return "CONTINUE";
    }

    metrics.queueCount++;

    logEvent(
        `FLOWGUARD decided to QUEUE: ${event.message}`,
        "QUEUE"
    );

    sendState();

    return "QUEUE";
}


/* ------------------------------------------------ */
/* MANUAL DECISION EVENTS                           */
/* ------------------------------------------------ */

function manualContinue() {

    metrics.totalEvents++;
    metrics.continueCount++;

    logEvent(
        "User selected CONTINUE. FLOWGUARD will handle the event without requesting attention.",
        "CONTINUE"
    );

    sendState();
}

function manualQueue() {

    metrics.totalEvents++;
    metrics.queueCount++;

    logEvent(
        "User selected QUEUE. FLOWGUARD will defer this event until a better moment.",
        "QUEUE"
    );

    sendState();
}

function manualInterrupt() {

    metrics.totalEvents++;
    metrics.interruptCount++;

    const now = Date.now();

    logEvent(
        "User selected INTERRUPT. FLOWGUARD is requesting attention.",
        "INTERRUPT"
    );

    broadcast({
        type: "interrupt",
        reason: "FLOWGUARD determined that your attention is required."
    });

    sendState();
}


/* ------------------------------------------------ */
/* SIMULATED EVENT GENERATION                       */
/* ------------------------------------------------ */

function generateAgentEvent(task, eventType) {

    if (isTaskStale(task)) {
        return;
    }

    const generatedAt = Date.now();

    let event;

    if (eventType === "normal") {

        event = {
            message:
                `${task.name} found additional information.`,
            canAutoResolve: true,
            requiresDecision: false,
            criticalDeadline: false,
            userConfirmationRequired: false,
            generatedAt
        };
    }

    if (eventType === "queue") {

        event = {
            message:
                `${task.name} found missing information that may require your preference.`,
            canAutoResolve: false,
            requiresDecision: true,
            criticalDeadline: false,
            userConfirmationRequired: false,
            generatedAt
        };
    }

    if (eventType === "critical") {

        event = {
            message:
                `${task.name} found an application deadline requiring your decision.`,
            canAutoResolve: false,
            requiresDecision: true,
            criticalDeadline: true,
            userConfirmationRequired: true,
            generatedAt
        };
    }

    if (event) {
        evaluateEvent(event);
    }

    sendState();
}


/* ------------------------------------------------ */
/* REAL BACKGROUND AGENT                            */
/* ------------------------------------------------ */

async function runTask(task) {

    logEvent(
        `${task.name} started using intent version ${task.version}.`,
        "TASK"
    );

    if (isTaskStale(task)) {
        return;
    }

    task.currentStep = "Searching internships";
    task.progress = 10;

    sendState();

    const searchArgs = determineSearchArguments();

    const searchResponse = await executeTool(
        task,
        "searchInternships",
        searchArgs
    );

    if (
        searchResponse.stale ||
        !searchResponse.result
    ) {
        return;
    }

    let results = searchResponse.result;

    task.progress = 40;
    task.currentStep = "Checking deadlines";

    sendState();

    const deadlineResponse = await executeTool(
        task,
        "filterByDeadline",
        {
            internships: results,
            days: 30
        }
    );

    if (
        deadlineResponse.stale ||
        !deadlineResponse.result
    ) {
        return;
    }

    results = deadlineResponse.result;

    task.progress = 65;
    task.currentStep = "Ranking matches";

    sendState();

    const rankResponse = await executeTool(
        task,
        "rankInternships",
        {
            internships: results
        }
    );

    if (
        rankResponse.stale ||
        !rankResponse.result
    ) {
        return;
    }

    results = rankResponse.result;

    task.progress = 90;
    task.currentStep =
        `Found ${results.length} matching internships`;

    sendState();

    if (isTaskStale(task)) {

        metrics.staleResultsRejected++;

        logEvent(
            `${task.name} produced a result for an obsolete intent. Result rejected.`,
            "STALE_RESULT"
        );

        return;
    }

    task.progress = 100;
    task.status = "COMPLETED";
    task.currentStep = "Completed";

    metrics.completedTasks++;

    task.resultsSummary =
        results.slice(0, 5).map(item => ({
            company: item.company,
            role: item.role,
            paid: item.paid,
            remote: item.remote,
            deadline: item.deadline
        }));

    logEvent(
        `${task.name} completed successfully with ${results.length} matching internships.`,
        "SUCCESS"
    );

    sendState();
}


/* ------------------------------------------------ */
/* START AGENT                                      */
/* ------------------------------------------------ */

function startTasks() {

    if (
        tasks.some(
            task =>
                task.status === "RUNNING" ||
                task.status === "TOOL_RUNNING"
        )
    ) {

        logEvent(
            "Background tasks are already running.",
            "INFO"
        );

        return;
    }

    agentRunId++;

    tasks = [

        createTask(
            "Internship Search",
            "search"
        ),

        createTask(
            "Company Research",
            "research"
        ),

        createTask(
            "Application Preparation",
            "application"
        )

    ];

    logEvent(
        `Agent started background work for intent v${intentVersion}: "${currentIntent}"`,
        "TASK"
    );

    tasks.forEach(task => {

        runTask(task).catch(error => {

            task.status = "FAILED";
            task.currentStep = "Unexpected failure";

            logEvent(
                `${task.name} failed: ${error.message}`,
                "ERROR"
            );

            sendState();

        });

    });

    sendState();
}


/* ------------------------------------------------ */
/* MANUAL EVENT SIMULATION                          */
/* ------------------------------------------------ */

function simulateEvent(eventType) {

    const runningTask =
        tasks.find(
            task =>
                task.status === "RUNNING" ||
                task.status === "TOOL_RUNNING"
        );

    if (!runningTask) {

        logEvent(
            "No running task is available to generate an event.",
            "INFO"
        );

        return;
    }

    generateAgentEvent(
        runningTask,
        eventType
    );
}


/* ------------------------------------------------ */
/* USER INTERRUPTION                                */
/* ------------------------------------------------ */

function userInterrupt() {

    metrics.userInterruptions++;

    logEvent(
        "USER INTERRUPTED THE AGENT.",
        "USER_INTERRUPT"
    );

    tasks.forEach(task => {

        if (
            task.status === "RUNNING" ||
            task.status === "TOOL_RUNNING"
        ) {

            cancelTask(
                task,
                "user interrupted the agent"
            );

        }

    });

    broadcast({
        type: "userInterrupt"
    });

    sendState();
}


/* ------------------------------------------------ */
/* INTENT UPDATE + REPLANNING                       */
/* ------------------------------------------------ */

function updateIntent(newIntent) {

    if (
        !newIntent ||
        !newIntent.trim()
    ) {
        return;
    }

    const previousIntent =
        currentIntent;

    intentVersion++;

    currentIntent =
        newIntent.trim();

    metrics.corrections++;

    logEvent(
        `USER UPDATED INTENT → "${currentIntent}"`,
        "CORRECTION"
    );

    logEvent(
        `Intent version changed v${intentVersion - 1} → v${intentVersion}.`,
        "VERSION"
    );

    cancelStaleTasks();

    logEvent(
        `Previous intent was: "${previousIntent}"`,
        "STALE"
    );

    logEvent(
        `Agent replanning using intent version ${intentVersion}.`,
        "REPLAN"
    );

    const newTasks = [

        createTask(
            "Updated Internship Search",
            "search"
        ),

        createTask(
            "Updated Company Research",
            "research"
        )

    ];

    newTasks.forEach(task => {
        tasks.push(task);
    });

    newTasks.forEach(task => {

        runTask(task).catch(error => {

            task.status = "FAILED";

            logEvent(
                `${task.name} failed: ${error.message}`,
                "ERROR"
            );

            sendState();

        });

    });

    sendState();
}


/* ------------------------------------------------ */
/* DEFER INTERRUPTION                               */
/* ------------------------------------------------ */

function deferInterrupt() {

    logEvent(
        "USER deferred the interruption. The decision has been queued.",
        "QUEUE"
    );

    metrics.queueCount++;

    broadcast({
        type: "interruptDeferred"
    });

    sendState();
}


/* ------------------------------------------------ */
/* RESET                                            */
/* ------------------------------------------------ */

function resetSystem() {

    intentVersion = 1;

    currentIntent =
        "Find AI/ML internships";

    attentionContract = {

        state: "STUDYING",

        remainingSeconds: 1800,

        interruptRules: {

            decisionRequired: true,

            criticalDeadline: true,

            unsafeAction: true

        }

    };

    tasks = [];
    events = [];

    metrics = {

        totalEvents: 0,

        continueCount: 0,

        queueCount: 0,

        interruptCount: 0,

        userInterruptions: 0,

        staleTasksCancelled: 0,

        corrections: 0,

        averageInterruptLatency: 0,

        toolCalls: 0,

        staleResultsRejected: 0,

        completedTasks: 0

    };

    interruptTimes = [];

    agentRunId++;

    logEvent(
        "FLOWGUARD system reset.",
        "INFO"
    );

    sendState();
}


/* ------------------------------------------------ */
/* WEBSOCKET                                        */
/* ------------------------------------------------ */

wss.on("connection", socket => {

    socket.send(
        JSON.stringify({
            type: "state",
            state: {
                intentVersion,
                currentIntent,
                attentionContract,
                tasks,
                events,
                metrics
            }
        })
    );

    socket.on("message", message => {

        try {

            const data =
                JSON.parse(message);

            if (data.action === "start") {
                startTasks();
            }

            if (data.action === "continueEvent") {
                manualContinue();
            }

            if (data.action === "queueEvent") {
                manualQueue();
            }

            if (data.action === "normalEvent") {
                simulateEvent("normal");
            }

            if (data.action === "criticalEvent") {
                simulateEvent("critical");
            }

            if (data.action === "interrupt") {
                userInterrupt();
            }

            if (data.action === "updateIntent") {
                updateIntent(data.intent);
            }

            if (data.action === "deferInterrupt") {
                deferInterrupt();
            }

            if (data.action === "reset") {
                resetSystem();
            }

        } catch (error) {

            logEvent(
                "Invalid WebSocket message received.",
                "ERROR"
            );

        }

    });

});


/* ------------------------------------------------ */
/* ATTENTION TIMER                                  */
/* ------------------------------------------------ */

setInterval(() => {

    if (
        attentionContract.remainingSeconds > 0
    ) {

        attentionContract.remainingSeconds--;

        sendState();

    }

}, 1000);


/* ------------------------------------------------ */
/* SERVER                                           */
/* ------------------------------------------------ */

server.listen(PORT, () => {

    console.log(
        `FLOWGUARD running at http://localhost:${PORT}`
    );

});