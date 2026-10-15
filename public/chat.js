
"use strict";

(() => {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const list = document.getElementById("messagesList");
  const welcome = document.getElementById("welcomeScreen");
  const typing = document.getElementById("typingIndicator");
  const send = document.getElementById("sendButton");
  const clear = document.getElementById("clearChat");

  // Works when the page and API are served by the same Worker.
  const API_URL = new URL("/api/chat", window.location.origin).href;
  const history = [];

  let busy = false;
  let controller = null;

  if (!form || !input || !list || !send) {
    console.error("Chat initialization failed: required HTML IDs are missing.");
    return;
  }

  function scrollBottom() {
    list.scrollTop = list.scrollHeight;
  }

  function update() {
    send.disabled = busy || !input.value.trim();
    input.disabled = busy;

    if (typing) typing.hidden = !busy;
    if (welcome) welcome.hidden = list.children.length > 0;
  }

  function addMessage(role, text = "", isError = false) {
    const item = document.createElement("div");
    item.className =
      `message ${role === "user" ? "user" : "bot"}` +
      (isError ? " error" : "");

    item.textContent = text;
    list.appendChild(item);
    scrollBottom();

    return item;
  }

  function extract(data) {
    if (typeof data === "string") return data;

    if (!data || typeof data !== "object") return "";

    if (data.error) {
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error)
      );
    }

    if (typeof data.response === "string") return data.response;
    if (typeof data.text === "string") return data.text;
    if (typeof data.generated_text === "string") return data.generated_text;

    const choice = data.choices?.[0];

    if (typeof choice?.delta?.content === "string") {
      return choice.delta.content;
    }

    if (typeof choice?.message?.content === "string") {
      return choice.message.content;
    }

    if (typeof data.token?.text === "string") {
      return data.token.text;
    }

    return "";
  }

  function parsePayload(raw) {
    const text = raw.trim();

    if (!text || text === "[DONE]") {
      return { done: text === "[DONE]", text: "" };
    }

    try {
      const data = JSON.parse(text);
      return { done: false, text: extract(data) };
    } catch (error) {
      // Valid non-JSON text can be a plain-text streaming response.
      if (
        error instanceof SyntaxError &&
        !text.startsWith("{") &&
        !text.startsWith("[")
      ) {
        return { done: false, text };
      }

      throw error;
    }
  }

  async function readStream(response, reply) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let answer = "";
    let eventLines = [];

    function append(text) {
      if (!text) return;

      answer += text;
      reply.textContent = answer;
      scrollBottom();
    }

    function processEvent() {
      if (!eventLines.length) return false;

      const raw = eventLines.join("\n");
      eventLines = [];

      const result = parsePayload(raw);
      append(result.text);

      return result.done;
    }

    function processLine(line) {
      if (line === "") {
        return processEvent();
      }

      // Standard Server-Sent Events.
      if (line.startsWith("data:")) {
        eventLines.push(line.slice(5).replace(/^ /, ""));
        return false;
      }

      // Other SSE metadata lines do not contain the answer.
      if (
        line.startsWith(":") ||
        line.startsWith("event:") ||
        line.startsWith("id:") ||
        line.startsWith("retry:")
      ) {
        return false;
      }

      // Also support newline-delimited JSON responses.
      const result = parsePayload(line);
      append(result.text);

      return result.done;
    }

    try {
      let done = false;

      while (!done) {
        const chunk = await reader.read();

        if (chunk.done) {
          buffer += decoder.decode();
        } else {
          buffer += decoder.decode(chunk.value, { stream: true });
        }

        let newline;

        while ((newline = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);

          if (line.endsWith("\r")) {
            line = line.slice(0, -1);
          }

          if (processLine(line)) {
            done = true;
            break;
          }
        }

        if (chunk.done || done) break;
      }

      if (buffer.trim()) {
        processLine(buffer.trimEnd().replace(/\r$/, ""));
      }

      // Process a final SSE event even if the stream omitted
      // its last blank-line delimiter.
      if (eventLines.length) processEvent();

      return answer;
    } finally {
      reader.releaseLock();
    }
  }

  async function submit(event) {
    event.preventDefault();

    const prompt = input.value.trim();
    if (!prompt || busy) return;

    busy = true;
    controller = new AbortController();

    const activeController = controller;
    const timeout = setTimeout(
      () => activeController.abort(),
      120000
    );

    addMessage("user", prompt);
    history.push({ role: "user", content: prompt });

    input.value = "";
    input.style.height = "auto";

    const reply = addMessage("assistant", "");
    update();

    let answer = "";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream, application/json"
        },
        body: JSON.stringify({
          messages: history.slice(-40)
        }),
        signal: activeController.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);

        throw new Error(
          `API HTTP ${response.status}: ${detail || "Request failed"}`
        );
      }

      if (!response.body) {
        throw new Error("The API returned no response body.");
      }

      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();

      if (contentType.includes("application/json")) {
        const data = await response.json();

        if (data.error) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.error)
          );
        }

        answer = extract(data);
        reply.textContent = answer;
      } else {
        answer = await readStream(response, reply);
      }

      if (!answer.trim()) {
        throw new Error(
          "The API responded but no answer text was received. Check Worker logs and the AI model response format."
        );
      }

      history.push({
        role: "assistant",
        content: answer
      });

      if (history.length > 40) {
        history.splice(0, history.length - 40);
      }
    } catch (error) {
      const message =
        error?.name === "AbortError"
          ? "Request timed out or was cancelled. Please try again."
          : error?.message || "Unable to connect to the AI API.";

      reply.textContent =
        (answer ? answer + "\n\n" : "") + "⚠️ " + message;

      reply.classList.add("error");

      if (history[history.length - 1]?.role === "user") {
        history.pop();
      }

      console.error("Chat API error:", error);
    } finally {
      clearTimeout(timeout);
      controller = null;
      busy = false;

      update();
      scrollBottom();
      input.focus();
    }
  }

  form.addEventListener("submit", submit);

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height =
      Math.min(input.scrollHeight, 200) + "px";

    update();
  });

  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();

      if (!busy && input.value.trim()) {
        form.requestSubmit();
      }
    }

    if (event.key === "Escape" && controller) {
      controller.abort();
    }
  });

  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.getAttribute("data-prompt") || "";
      update();

      if (input.value.trim() && !busy) {
        form.requestSubmit();
      }
    });
  });

  clear?.addEventListener("click", () => {
    if (busy) return;

    history.length = 0;
    list.replaceChildren();
    update();
  });

  update();
})();
