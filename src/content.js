(() => {
  if (window.__aiStudyAssistantContent) return;
  window.__aiStudyAssistantContent = true;

  const TOAST_ID = "ai-study-assistant-toast";

  function selectionText() {
    const sel = window.getSelection();
    return String(sel && sel.toString ? sel.toString() : "").trim();
  }

  function selectionAnchor() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return null;
    const node = range.commonAncestorContainer;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function showToast(text) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = TOAST_ID;
      el.setAttribute("role", "status");
      Object.assign(el.style, {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        zIndex: "2147483646",
        maxWidth: "320px",
        padding: "10px 14px",
        borderRadius: "10px",
        background: "#0f766e",
        color: "#fff",
        font: "13px/1.4 system-ui, sans-serif",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
      });
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
    clearTimeout(el._hide);
    el._hide = setTimeout(() => el.remove(), 3200);
  }

  function visible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function labelText(el) {
    const parts = [];
    if (el.id) {
      document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`).forEach((label) => {
        parts.push(label.innerText);
      });
    }
    const wrap = el.closest("label");
    if (wrap) parts.push(wrap.innerText);
    const aria = el.getAttribute("aria-label");
    if (aria) parts.push(aria);
    parts.push(el.value || "");
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function optionLetter(text) {
    const match = String(text || "").trim().match(/^([A-Ha-h])(?:[.\u3001、:：)\s]|$)/);
    return match ? match[1].toUpperCase() : "";
  }

  function parseFillTokens(result) {
    const tokens = [];
    const push = (value) => {
      const text = String(value || "").trim();
      if (text) tokens.push(text);
    };
    (result.choices || []).forEach(push);
    String(result.answer || "")
      .split(/[,，、;；\n]+/)
      .forEach(push);
    return [...new Set(tokens)];
  }

  function containerFromAnchor(anchor) {
    if (!anchor) return document.body;
    return (
      anchor.closest("form, article, section, li, fieldset, .question, [class*='question']") ||
      anchor.parentElement ||
      document.body
    );
  }

  function collectChoiceInputs(root) {
    return [...root.querySelectorAll('input[type="radio"], input[type="checkbox"]')].filter(visible);
  }

  function collectTextInputs(root) {
    return [
      ...root.querySelectorAll(
        'input:not([type]), input[type="text"], input[type="search"], input[type="number"], textarea'
      ),
    ].filter(visible);
  }

  function matchChoice(input, tokens) {
    const text = labelText(input);
    const letter = optionLetter(text) || optionLetter(input.value);
    const upperTokens = tokens.map((item) => item.toUpperCase());
    if (letter && upperTokens.includes(letter)) return true;
    return tokens.some((token) => {
      if (token.length < 1) return false;
      return text.includes(token) || String(input.value || "").includes(token);
    });
  }

  function setChecked(input, checked) {
    if (input.checked === checked) return;
    input.checked = checked;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setTextValue(input, value) {
    const proto =
      input.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillAnswer(result) {
    const tokens = parseFillTokens(result);
    if (!tokens.length) {
      return { ok: false, error: "没有可填入的答案" };
    }

    const root = containerFromAnchor(selectionAnchor());
    const type = result.type;

    if (type === "single" || type === "multi" || type === "true_false") {
      let choices = collectChoiceInputs(root);
      if (!choices.length) choices = collectChoiceInputs(document);
      if (!choices.length) {
        return { ok: false, error: "页面上没有找到选项控件，请对照侧边栏手工填写" };
      }
      let matched = 0;
      const names = new Set(
        choices.filter((el) => el.type === "radio").map((el) => el.name).filter(Boolean)
      );
      names.forEach((name) => {
        document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`).forEach((el) => {
          if (el.checked) setChecked(el, false);
        });
      });
      choices.forEach((el) => {
        const hit = matchChoice(el, tokens);
        if (el.type === "checkbox") setChecked(el, hit);
        else if (hit) setChecked(el, true);
        if (hit) matched += 1;
      });
      if (!matched) {
        return { ok: false, error: "无法把建议答案对上选项，请对照侧边栏手工填写" };
      }
      showToast("已填入建议，请人工核对后再提交");
      return { ok: true, filled: matched };
    }

    let fields = collectTextInputs(root);
    if (!fields.length) fields = collectTextInputs(document);
    const empty = fields.filter((el) => !String(el.value || "").trim());
    const target = (empty[0] || fields[0]);
    if (!target) {
      return { ok: false, error: "页面上没有找到填空框，请对照侧边栏手工填写" };
    }
    setTextValue(target, tokens.join(" "));
    showToast("已填入建议，请人工核对后再提交");
    return { ok: true, filled: 1 };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_SELECTION") {
      sendResponse({ ok: true, text: selectionText() });
      return;
    }
    if (message?.type === "FILL_ANSWER") {
      try {
        sendResponse(fillAnswer(message.result || {}));
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
})();
