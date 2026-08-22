const $ = (selector) => document.querySelector(selector);
const review = $("#review");
const complete = $("#complete");
const errorPanel = $("#error");
const dimensions = ["clarity", "fidelity", "concision", "naturalness"];
let current = null;
let busy = false;

function showError(message) {
  review.classList.add("hidden"); complete.classList.add("hidden");
  errorPanel.classList.remove("hidden");
  $("#errorMessage").textContent = message;
}

async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "request_failed");
  return value;
}

function scoreSelect(dimension, candidate) {
  const select = document.createElement("select");
  select.dataset.dimension = dimension; select.dataset.candidate = candidate;
  select.setAttribute("aria-label", `${dimension} score for response ${candidate.toUpperCase()}`);
  for (const [value, label] of [["", `${candidate.toUpperCase()} —`], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]) {
    const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option);
  }
  return select;
}

function resetScores() {
  const grid = $("#scoreGrid"); grid.replaceChildren();
  for (const dimension of dimensions) {
    const row = document.createElement("div"); row.className = "score-row";
    const label = document.createElement("label"); label.textContent = dimension;
    row.append(label, scoreSelect(dimension, "a"), scoreSelect(dimension, "b")); grid.append(row);
  }
  $("#details").open = false;
}

function secondaryScores() {
  const result = {};
  for (const dimension of dimensions) {
    const a = $(`select[data-dimension="${dimension}"][data-candidate="a"]`).value;
    const b = $(`select[data-dimension="${dimension}"][data-candidate="b"]`).value;
    if (a || b) {
      if (!a || !b) throw new Error(`Score both responses for ${dimension}, or leave both blank.`);
      result[dimension] = { a: Number(a), b: Number(b) };
    }
  }
  return result;
}

function renderSession(session) {
  current = session.pair;
  const { completed: done, total } = session.progress;
  $("#progressLabel").textContent = `${Math.min(done + (session.complete ? 0 : 1), total)} / ${total}`;
  $("#progressBar").style.width = `${total ? done / total * 100 : 0}%`;
  if (session.complete) { void renderResults(); return; }
  errorPanel.classList.add("hidden"); complete.classList.add("hidden"); review.classList.remove("hidden");
  $("#task").textContent = current.task;
  $("#draft").textContent = current.draft;
  $("#responseA").textContent = current.response_a;
  $("#responseB").textContent = current.response_b;
  resetScores();
  window.scrollTo({ top: 0, behavior: done ? "smooth" : "auto" });
}

async function choose(choice) {
  if (busy || !current) return;
  let secondary;
  try { secondary = secondaryScores(); } catch (error) { showError(error.message); return; }
  busy = true; review.classList.add("busy");
  try {
    const session = await request("/api/judgments", {
      method: "POST", body: JSON.stringify({ pair_id: current.pair_id, choice, secondary }),
    });
    renderSession(session);
  } catch (error) {
    showError(`Could not save this judgment: ${error.message}`);
  } finally {
    busy = false; review.classList.remove("busy");
  }
}

async function renderResults() {
  try {
    const results = await request("/api/results");
    review.classList.add("hidden"); errorPanel.classList.add("hidden"); complete.classList.remove("hidden");
    $("#progressLabel").textContent = `${results.pairs.length} / ${results.pairs.length}`;
    $("#progressBar").style.width = "100%";
    const cards = $("#resultCards"); cards.replaceChildren();
    for (const [label, value] of [["Direct rewrite", results.preference.direct_rewrite], ["Structured revision", results.preference.schema_revision], ["Ties", results.preference.tie]]) {
      const card = document.createElement("div"); card.className = "result-card";
      const strong = document.createElement("strong"); strong.textContent = value;
      const span = document.createElement("span"); span.textContent = label;
      card.append(strong, span); cards.append(card);
    }
    const direct = results.preference.direct_rewrite; const revision = results.preference.schema_revision;
    $("#resultNote").textContent = direct === revision
      ? "The preference result is even. Review the secondary scores before drawing a conclusion."
      : `${direct > revision ? "Direct rewrite" : "Structured revision"} received more primary preferences. Treat this small reviewed corpus as directional evidence.`;
  } catch (error) { showError(`Could not reveal completed results: ${error.message}`); }
}

async function load() {
  try { renderSession(await request("/api/session")); }
  catch (error) { showError(`Could not load the private review session: ${error.message}`); }
}

document.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => void choose(button.dataset.choice)));
document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches("select, input, textarea, summary")) return;
  const choice = { a: "a", b: "b", t: "tie" }[event.key.toLowerCase()];
  if (choice) { event.preventDefault(); void choose(choice); }
});
$("#contextToggle").addEventListener("click", () => {
  const body = $("#contextBody"); const hidden = body.classList.toggle("hidden");
  $("#contextToggle").textContent = hidden ? "Show context" : "Hide context";
});
$("#retry").addEventListener("click", () => { errorPanel.classList.add("hidden"); void load(); });
void load();
