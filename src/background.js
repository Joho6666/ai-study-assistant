import { analyzeQuestion } from "./lib/llm.js";

const MENU_ID = "analyze-selection";

function ignore() {}

function setPanelOpensOnClick() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(ignore);
}

chrome.runtime.onInstalled.addListener(() => {
  setPanelOpensOnClick();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "解析选中题目",
      contexts: ["selection"],
    });
  });
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(setPanelOpensOnClick);
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs && tabs.length ? tabs[0] : undefined;
}

async function openPanel(tabId) {
  if (tabId != null) {
    await chrome.sidePanel.open({ tabId });
    return;
  }
  const tab = await currentTab();
  if (tab && tab.id != null) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
}

async function askTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

async function injectContent(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content.js"],
  });
}

async function readSelection(tabId) {
  let reply = await askTab(tabId, { type: "GET_SELECTION" });
  if (reply && reply.ok) return reply;
  try {
    await injectContent(tabId);
    reply = await askTab(tabId, { type: "GET_SELECTION" });
  } catch {
    reply = null;
  }
  return reply;
}

const memory = chrome.storage.session || chrome.storage.local;

function notify(message) {
  memory.set({ lastAnalyze: message }).catch(ignore);
  chrome.runtime.sendMessage(message).catch(ignore);
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function runAnalyze(question, tabId, source) {
  const text = String(question || "").trim();
  notify({ type: "ANALYZE_STARTED", question: text, source });
  try {
    if (!text) throw new Error("请先选中或粘贴题目");
    const result = await analyzeQuestion(text);
    notify({ type: "ANALYZE_DONE", result, tabId });
    return { ok: true, result };
  } catch (error) {
    const message = errorText(error);
    notify({ type: "ANALYZE_ERROR", error: message, question: text });
    return { ok: false, error: message };
  }
}

async function analyzeSelection(tab) {
  if (!tab || tab.id == null) throw new Error("没有可用的标签页");
  await openPanel(tab.id);
  const url = tab.url || "";
  if (url && !/^(https?:|file:)/.test(url)) {
    throw new Error("当前页面无法读取选区，请在网页里选中题目");
  }
  const reply = await readSelection(tab.id);
  const question = String((reply && reply.text) || "").trim();
  if (!question) throw new Error("没有选中文字。请先框选一题，再解析。");
  return runAnalyze(question, tab.id, "selection");
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const question = String(info.selectionText || "").trim();
  try {
    if (tab && tab.id) await openPanel(tab.id);
    if (question) {
      await runAnalyze(question, tab && tab.id, "context-menu");
      return;
    }
    await analyzeSelection(tab || (await currentTab()));
  } catch (error) {
    notify({ type: "ANALYZE_ERROR", error: errorText(error) });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "analyze-selection") return;
  try {
    await analyzeSelection(await currentTab());
  } catch (error) {
    notify({ type: "ANALYZE_ERROR", error: errorText(error) });
  }
});

async function fillOnTab(tabId, result) {
  if (tabId == null) throw new Error("没有可填入的标签页");
  let reply = await askTab(tabId, { type: "FILL_ANSWER", result });
  if (!reply) {
    await injectContent(tabId);
    reply = await askTab(tabId, { type: "FILL_ANSWER", result });
  }
  if (!reply) throw new Error("当前页面无法填入，请刷新后重试");
  return reply;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message && message.type;
  if (type === "ANALYZE_TEXT") {
    const tabId = (sender.tab && sender.tab.id) || message.tabId;
    runAnalyze(message.question, tabId, message.source || "sidepanel").then(sendResponse);
    return true;
  }
  if (type === "ANALYZE_ACTIVE_SELECTION") {
    (async () => analyzeSelection(sender.tab || (await currentTab())))()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: errorText(error) }));
    return true;
  }
  if (type === "FILL_ANSWER") {
    (async () => {
      const tabId = message.tabId || (sender.tab && sender.tab.id) || (await currentTab())?.id;
      return fillOnTab(tabId, message.result);
    })()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: errorText(error) }));
    return true;
  }
  return false;
});
