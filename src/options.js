import { loadSettings, saveSettings } from "./lib/settings.js";

const apiBaseEl = document.getElementById("apiBase");
const modelEl = document.getElementById("model");
const apiKeyEl = document.getElementById("apiKey");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");
const toggleBtn = document.getElementById("toggle");

function flash(kind, text) {
  statusEl.hidden = false;
  statusEl.className = `banner ${kind}`;
  statusEl.textContent = text;
}

const settings = await loadSettings();
apiBaseEl.value = settings.apiBase;
modelEl.value = settings.model;
apiKeyEl.value = settings.apiKey;

saveBtn.addEventListener("click", async () => {
  await saveSettings({
    apiBase: apiBaseEl.value,
    model: modelEl.value,
    apiKey: apiKeyEl.value,
  });
  flash("ok", "已保存到本机。");
});

toggleBtn.addEventListener("click", () => {
  const hidden = apiKeyEl.type === "password";
  apiKeyEl.type = hidden ? "text" : "password";
  toggleBtn.textContent = hidden ? "隐藏 Key" : "显示 Key";
});
