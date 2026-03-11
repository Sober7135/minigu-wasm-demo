import init, { MiniGuDb } from "./pkg/minigu_wasm.js";

const SEED_SCRIPT = `CALL create_test_graph_data("g", 5)
SESSION SET GRAPH g`;

const MATCH_QUERY = `MATCH (n:PERSON) RETURN n`;

const INSPECT_QUERY = `MATCH (n:PERSON) RETURN n LIMIT 2`;

const state = {
  db: null,
  ready: false,
  logLines: [],
  running: false,
};

const elements = {
  lastQuery: document.querySelector("#last-query"),
  outputJson: document.querySelector("#output-json"),
  outputLog: document.querySelector("#output-log"),
  outputTable: document.querySelector("#output-table"),
  resetDb: document.querySelector("#reset-db"),
  runDemo: document.querySelector("#run-demo"),
  runJson: document.querySelector("#run-json"),
  runTable: document.querySelector("#run-table"),
  scriptInput: document.querySelector("#script-input"),
  statusBadge: document.querySelector("#status-badge"),
  statusText: document.querySelector("#status-text"),
  presetButtons: [...document.querySelectorAll(".preset-button")],
};

boot().catch((error) => {
  setStatus("error", "Boot failed", formatError(error));
  appendLog(`boot failed: ${formatError(error)}`);
});

async function boot() {
  setStatus("busy", "Loading WASM", "Initializing the browser package...");
  await init();
  recreateDb();
  wireUi();
  elements.scriptInput.value = `${SEED_SCRIPT}\n${MATCH_QUERY}`;
  setStatus("ok", "Ready", "WASM loaded. You can run the smoke demo or execute statements manually.");
  appendLog("wasm module initialized");
}

function wireUi() {
  elements.resetDb.addEventListener("click", () => {
    if (state.running) {
      return;
    }
    recreateDb();
    setStatus("ok", "DB reset", "Created a fresh in-memory MiniGuDb instance.");
  });

  elements.runDemo.addEventListener("click", () => {
    void withRunLock(runSmokeDemo);
  });

  elements.runJson.addEventListener("click", () => {
    void withRunLock(() => runScript("json"));
  });

  elements.runTable.addEventListener("click", () => {
    void withRunLock(() => runScript("table"));
  });

  for (const button of elements.presetButtons) {
    button.addEventListener("click", () => {
      switch (button.dataset.preset) {
        case "seed":
          elements.scriptInput.value = SEED_SCRIPT;
          break;
        case "match":
          elements.scriptInput.value = MATCH_QUERY;
          break;
        case "inspect":
          elements.scriptInput.value = `${SEED_SCRIPT}\n${INSPECT_QUERY}`;
          break;
        default:
          break;
      }
    });
  }
}

function recreateDb() {
  if (state.db && typeof state.db.free === "function") {
    state.db.free();
  }
  state.db = new MiniGuDb();
  state.ready = true;
  elements.lastQuery.textContent = "Fresh in-memory database";
  renderTable("No results yet.");
  renderJson({ note: "Run a query to inspect JSON output." });
  appendLog("created fresh MiniGuDb()");
}

function runSmokeDemo() {
  recreateDb();
  setStatus("busy", "Running demo", "Creating sample graph data and executing MATCH query...");

  try {
    executeJsonStatement(`CALL create_test_graph_data("g", 5)`);
    executeJsonStatement("SESSION SET GRAPH g");
    executeDualReadStatement(MATCH_QUERY);
    setStatus(
      "ok",
      "Smoke demo passed",
      "The browser created an in-memory graph and returned query results from WASM."
    );
  } catch (error) {
    setStatus("error", "Smoke demo failed", formatError(error));
  }
}

function runScript(mode) {
  const statements = elements.scriptInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (statements.length === 0) {
    setStatus("error", "Nothing to run", "Add at least one statement to the script runner.");
    return;
  }

  setStatus("busy", "Running script", `Executing ${statements.length} statement(s) in ${mode} mode...`);

  try {
    for (let index = 0; index < statements.length - 1; index += 1) {
      executeJsonStatement(statements[index]);
    }

    const lastStatement = statements[statements.length - 1];
    if (mode === "table") {
      executeTableStatement(lastStatement);
    } else {
      executeJsonStatement(lastStatement);
    }

    setStatus("ok", "Script completed", `Executed ${statements.length} statement(s) successfully.`);
  } catch (error) {
    setStatus("error", "Script failed", formatError(error));
  }
}

function executeJsonStatement(statement) {
  if (!state.ready || state.db === null) {
    throw new Error("MiniGuDb is not ready yet.");
  }

  elements.lastQuery.textContent = statement;
  appendLog(`> ${statement}`);

  try {
    const jsonText = state.db.query_json(statement);
    renderTable("");
    renderJson(JSON.parse(jsonText));
    appendLog("< ok");
  } catch (error) {
    renderJson({ error: formatError(error) });
    appendLog(`< error: ${formatError(error)}`);
    throw error;
  }
}

function executeDualReadStatement(statement) {
  if (!state.ready || state.db === null) {
    throw new Error("MiniGuDb is not ready yet.");
  }

  elements.lastQuery.textContent = statement;
  appendLog(`> ${statement}`);

  try {
    const tableText = state.db.query_table(statement);
    const jsonText = state.db.query_json(statement);
    renderTable(tableText);
    renderJson(JSON.parse(jsonText));
    appendLog("< ok (table + json)");
  } catch (error) {
    renderJson({ error: formatError(error) });
    appendLog(`< error: ${formatError(error)}`);
    throw error;
  }
}

function executeTableStatement(statement) {
  if (!state.ready || state.db === null) {
    throw new Error("MiniGuDb is not ready yet.");
  }

  elements.lastQuery.textContent = statement;
  appendLog(`> ${statement}`);

  try {
    const tableText = state.db.query_table(statement);
    renderTable(tableText);
    elements.outputJson.textContent = "";
    appendLog("< ok (table)");
  } catch (error) {
    renderTable("");
    renderJson({ error: formatError(error) });
    appendLog(`< error: ${formatError(error)}`);
    throw error;
  }
}

async function withRunLock(fn) {
  if (state.running) {
    appendLog("ignored: another run is still in progress");
    setStatus("busy", "Busy", "Another run is still in progress.");
    return;
  }

  state.running = true;
  setControlsDisabled(true);
  try {
    fn();
  } finally {
    state.running = false;
    setControlsDisabled(false);
  }
}

function renderTable(text) {
  elements.outputTable.textContent = text;
}

function renderJson(value) {
  elements.outputJson.textContent = JSON.stringify(value, null, 2);
}

function appendLog(line) {
  const now = new Date().toLocaleTimeString("en-US", { hour12: false });
  state.logLines.push(`[${now}] ${line}`);
  state.logLines = state.logLines.slice(-24);
  elements.outputLog.textContent = state.logLines.join("\n");
}

function setStatus(kind, badgeText, detail) {
  elements.statusBadge.textContent = badgeText;
  elements.statusBadge.dataset.kind = kind;
  elements.statusText.textContent = detail;
}

function setControlsDisabled(disabled) {
  elements.resetDb.disabled = disabled;
  elements.runDemo.disabled = disabled;
  elements.runJson.disabled = disabled;
  elements.runTable.disabled = disabled;
  elements.scriptInput.disabled = disabled;
  for (const button of elements.presetButtons) {
    button.disabled = disabled;
  }
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}
