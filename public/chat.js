"use strict";
(() => {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const list = document.getElementById("messagesList");
  const welcome = document.getElementById("welcomeScreen");
  const typing = document.getElementById("typingIndicator");
  const send = document.getElementById("sendButton");
  const clear = document.getElementById("clearChat");
  const history = [];
  let busy = false;
  let controller;
  if (!form || !input || !list || !send) return;

  function scrollBottom() { list.scrollTop = list.scrollHeight; }
  function update() {
    send.disabled = busy || !input.value.trim();
    input.disabled = busy;
    if (typing) typing.hidden = !busy;
    if (welcome) welcome.hidden = list.children.length > 0;
  }
  function addMessage(role, text = "", isError = false) {
    const item = document.createElement("div");
    item.className = `message ${role === "user" ? "user" : "bot"}${isError ? " error" : ""}`;
    item.textContent = text;
    list.appendChild(item);
    scrollBottom();
    return item;
  }
  function extract(data) {
    if (typeof data.response === "string") return data.response;
    if (typeof data.text === "string") return data.text;
    if (typeof data.choices?.[0]?.delta?.content === "string") return data.choices[0].delta.content;
    return "";
  }
  async function submit(event) {
    event.preventDefault();
    const prompt = input.value.trim();
    if (!prompt || busy) return;
    busy = true;
    controller = new AbortController();
    const activeController = controller;
    const timeout = setTimeout(() => activeController.abort(), 120000);
    addMessage("user", prompt);
    history.push({ role: "user", content: prompt });
    input.value = "";
    input.style.height = "auto";
    const replyEl = addMessage("assistant", "");
    let answer = "";
    update();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ messages: history.slice(-40) }),
        signal: activeController.signal,
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`AI Worker returned HTTP ${response.status}: ${(await response.text()).slice(0, 180)}`);
      if (!response.body) throw new Error("The AI Worker returned no response stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneStream = false;
      const processEvent = (raw) => {
        const lines = raw.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart());
        if (!lines.length) return false;
        const dataText = lines.join("\n");
        if (dataText === "[DONE]") return true;
        let data;
        try { data = JSON.parse(dataText); } catch { return false; }
        if (data.error) throw new Error(String(data.error));
        const part = extract(data);
        if (part) { answer += part; replyEl.textContent = answer; scrollBottom(); }
        return false;
      };
      try {
        while (!doneStream) {
          const chunk = await reader.read();
          if (chunk.done) { buffer += decoder.decode(); break; }
          buffer += decoder.decode(chunk.value, { stream: true });
          let split;
          while ((split = /\r?\n\r?\n/.exec(buffer))) {
            const eventText = buffer.slice(0, split.index);
            buffer = buffer.slice(split.index + split[0].length);
            if (processEvent(eventText)) { doneStream = true; break; }
          }
        }
        if (buffer.trim()) processEvent(buffer);
      } finally { reader.releaseLock(); }
      if (!answer.trim()) throw new Error("No answer received. Check the Worker model and AI binding.");
      history.push({ role: "assistant", content: answer });
      if (history.length > 40) history.splice(0, history.length - 40);
    } catch (err) {
      const message = err?.name === "AbortError" ? "Request timed out. Please try again." : (err?.message || "Could not connect to the AI Worker.");
      replyEl.textContent = (answer ? answer + "\n\n" : "") + "⚠️ " + message;
      replyEl.classList.add("error");
      if (history[history.length - 1]?.role === "user") history.pop();
      console.error("Chat request failed", err);
    } finally {
      clearTimeout(timeout); controller = null; busy = false; update(); scrollBottom(); input.focus();
    }
  }
  form.addEventListener("submit", submit);
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 200) + "px"; update(); });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy && input.value.trim()) form.requestSubmit(); }
    if (e.key === "Escape" && controller) controller.abort();
  });
  document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => { input.value = button.getAttribute("data-prompt") || ""; update(); form.requestSubmit(); }));
  clear?.addEventListener("click", () => { if (busy) return; history.length = 0; list.replaceChildren(); update(); });
  update();
})();
