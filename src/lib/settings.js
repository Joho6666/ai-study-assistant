const DEFAULTS = {
  apiBase: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "deepseek-chat",
};

export function normalizeApiBase(raw) {
  let base = String(raw || "").trim().replace(/\/+$/, "");
  if (!base) return DEFAULTS.apiBase;
  if (base.endsWith("/chat/completions")) {
    base = base.slice(0, -"/chat/completions".length).replace(/\/+$/, "");
  }
  return base;
}

export async function loadSettings() {
  const stored = await chrome.storage.local.get(["apiBase", "apiKey", "model"]);
  return {
    apiBase: normalizeApiBase(stored.apiBase || DEFAULTS.apiBase),
    apiKey: String(stored.apiKey || ""),
    model: String(stored.model || DEFAULTS.model).trim() || DEFAULTS.model,
  };
}

export async function saveSettings(partial) {
  const current = await loadSettings();
  const next = {
    apiBase: normalizeApiBase(partial.apiBase ?? current.apiBase),
    apiKey: String(partial.apiKey ?? current.apiKey),
    model: String(partial.model ?? current.model).trim() || DEFAULTS.model,
  };
  await chrome.storage.local.set(next);
  return next;
}

export { DEFAULTS };
