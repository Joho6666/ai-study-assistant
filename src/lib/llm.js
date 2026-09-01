import { SYSTEM_PROMPT, userPrompt } from "./prompt.js";
import { loadSettings, normalizeApiBase } from "./settings.js";

const ALLOWED_TYPES = new Set(["single", "multi", "true_false", "fill", "short"]);

export function chatCompletionsUrl(apiBase) {
  const base = normalizeApiBase(apiBase);
  return `${base}/chat/completions`;
}

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("模型返回为空");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

export function normalizeResult(parsed, question) {
  const type = ALLOWED_TYPES.has(parsed.type) ? parsed.type : "short";
  const choices = Array.isArray(parsed.choices)
    ? parsed.choices.map((item) => String(item).trim()).filter(Boolean)
    : [];
  let answer = parsed.answer == null ? "" : String(parsed.answer).trim();
  if (!answer && choices.length) answer = choices.join("、");
  const uncertain = Boolean(parsed.uncertain) || !answer;
  return {
    type,
    answer,
    choices: type === "multi" ? choices : choices.slice(0, 1),
    explanation: String(parsed.explanation || "").trim(),
    uncertain,
    question,
  };
}

export async function analyzeQuestion(question) {
  const text = String(question || "").trim();
  if (!text) throw new Error("请先选中或粘贴题目");
  if (text.length > 8000) throw new Error("题干过长，请只选一题");

  const settings = await loadSettings();
  if (!settings.apiKey) {
    throw new Error("尚未配置 API Key，请在扩展选项页填写");
  }

  const url = chatCompletionsUrl(settings.apiBase);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(text) },
      ],
    }),
  });

  const bodyText = await response.text();
  let payload = {};
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    payload = { raw: bodyText };
  }

  if (!response.ok) {
    const detail =
      payload.error?.message ||
      payload.message ||
      bodyText.slice(0, 240) ||
      `HTTP ${response.status}`;
    throw new Error(`接口失败：${detail}`);
  }

  const content = payload.choices?.[0]?.message?.content;
  const parsed = extractJsonObject(content);
  return normalizeResult(parsed, text);
}
