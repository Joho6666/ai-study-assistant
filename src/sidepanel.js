const TYPE_LABEL = {
  single: "单选",
  multi: "多选",
  true_false: "判断",
  fill: "填空",
  short: "简答",
};

const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");
const resultCard = document.getElementById("result-card");
const metaEl = document.getElementById("meta");
const answerEl = document.getElementById("answer");
const explanationEl = document.getElementById("explanation");
const analyzeBtn = document.getElementById("analyze");
const readBtn = document.getElementById("read");
const fillBtn = document.getElementById("fill");
const copyBtn = document.getElementById("copy");
const memory = chrome.storage.session || chrome.storage.local;

let latest = null;
let latestTabId = null;
let busy = false;

function setStatus(kind, text) {
  statusEl.className = `banner ${kind}`;
  statusEl.textContent = text;
}

function setBusy(next) {
  busy = next;
  analyzeBtn.disabled = busy;
  readBtn.disabled = busy;
  analyzeBtn.textContent = busy ? "解析中…" : "解析";
}

function renderResult(result, tabId) {
  latest = result;
  if (tabId != null) latestTabId = tabId;
  resultCard.hidden = false;
  metaEl.replaceChildren();
  const typeChip = document.createElement("span");
  typeChip.className = "chip";
  typeChip.textContent = TYPE_LABEL[result.type] || result.type;
  metaEl.append(typeChip);
  if (result.uncertain) {
    const warn = document.createElement("span");
    warn.className = "chip warn";
    warn.textContent = "不确定，请人工核对";
    metaEl.append(warn);
  }
  answerEl.textContent = result.answer || "（无建议答案）";
  explanationEl.textContent = result.explanation || "没有解析。";
  fillBtn.disabled = result.uncertain || !result.answer;
  setStatus(
    result.uncertain ? "warn" : "ok",
    result.uncertain
      ? "模型也不确定，请当作参考，不要直接当标准答案。"
      : "已给出建议。核对后再点「填入建议」。"
  );
}

function applyMessage(message) {
  if (!message || !message.type) return;
  if (message.type === "ANALYZE_STARTED") {
    if (message.question) questionEl.value = message.question;
    setBusy(true);
    setStatus("ok", "正在请求模型…");
    return;
  }
  if (message.type === "ANALYZE_DONE") {
    setBusy(false);
    if (message.result && message.result.question) {
      questionEl.value = message.result.question;
    }
    renderResult(message.result, message.tabId);
    return;
  }
  if (message.type === "ANALYZE_ERROR") {
    setBusy(false);
    if (message.question) questionEl.value = message.question;
    setStatus("err", message.error || "解析失败");
  }
}

function ask(message) {
  return chrome.runtime.sendMessage(message);
}

analyzeBtn.addEventListener("click", async () => {
  const question = questionEl.value.trim();
  if (!question) {
    setStatus("warn", "请先选中或粘贴题目。");
    return;
  }
  setBusy(true);
  setStatus("ok", "正在请求模型…");
  try {
    const reply = await ask({ type: "ANALYZE_TEXT", question, source: "sidepanel" });
    if (!reply || !reply.ok) throw new Error((reply && reply.error) || "解析失败");
  } catch (error) {
    setStatus("err", error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
});

readBtn.addEventListener("click", async () => {
  setBusy(true);
  try {
    const reply = await ask({ type: "ANALYZE_ACTIVE_SELECTION" });
    if (!reply || !reply.ok) throw new Error((reply && reply.error) || "没有读到选中文字");
  } catch (error) {
    setStatus("err", error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
});

fillBtn.addEventListener("click", async () => {
  if (!latest) return;
  if (latest.uncertain) {
    setStatus("warn", "结果不确定，已禁止自动填入。请手工核对。");
    return;
  }
  fillBtn.disabled = true;
  try {
    const reply = await ask({
      type: "FILL_ANSWER",
      result: latest,
      tabId: latestTabId,
    });
    if (!reply || !reply.ok) throw new Error((reply && reply.error) || "填入失败");
    setStatus("ok", "已填入建议，请人工核对后再提交。插件不会替你交卷。");
  } catch (error) {
    setStatus("err", error instanceof Error ? error.message : String(error));
  } finally {
    fillBtn.disabled = latest.uncertain || !latest.answer;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!latest || !latest.answer) return;
  await navigator.clipboard.writeText(latest.answer);
  setStatus("ok", "答案已复制。");
});

chrome.runtime.onMessage.addListener(applyMessage);

const stored = await memory.get("lastAnalyze");
if (stored.lastAnalyze) applyMessage(stored.lastAnalyze);
