function findInputEl() {
  // Tweak these if AID changes its DOM:
  return (
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector('textarea') ||
    document.querySelector('input[type="text"]')
  );
}

function insertText(el, text) {
  if (!el) return;

  // ContentEditable
  if (el.isContentEditable) {
    el.focus();
    document.execCommand("insertText", false, text);
    // Try to trigger frameworks (React) updates:
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return;
  }

  // Textarea/Input
  const start = el.selectionStart ?? el.value?.length ?? 0;
  const end = el.selectionEnd ?? start;
  const v = el.value ?? "";
  el.value = v.slice(0, start) + text + v.slice(end);
  el.focus();
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "AID_INSERT") return;
  insertText(findInputEl(), msg.text || "");
});
