
"use strict";

(() => {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const list = document.getElementById("messagesList");
  const welcome = document.getElementById("welcomeScreen");
  const typing = document.getElementById("typingIndicator");
  const send = document.getElementById("sendButton");
  const clear = document.getElementById("clearChat");

  const API_URL = new URL("/api/chat", window.location.origin).href;
  const history = [];
  let busy = false;
  let controller = null;

  if (!form || !input || !list || !send) {
    console.error("Chat UI elements were not found. Check ai.html IDs.");
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
    if (typeof data.response === "string") return data.response;
    if (typeof data.text === "string") return data.text;
    if (typeof data.choices?.[0]?.delta?.content === "string") {
      return data.choices[0].delta.content;
    }
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

    const reply = addMessage("assistant", "");
    let answer = "";

    update();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream, application/json"
        },
        body: JSON.stringify({ messages: history.slice(-40) }),
        signal: activeController.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(
          `API HTTP ${response.status}: ${detail || "Request failed"}`
        );
      }

      if (!response.body) {
        throw new Error("The API returned an empty response stream.");
      }

      const contentType = response.headers.get("content-type") || "";

      // Support a normal JSON response as well as SSE streaming.
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.error) throw new Error(String(data.error));

        answer = extract(data);
        if (!answer) throw new Error("No answer found in the API response.");

        reply.textContent = answer;
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        function processEvent(raw) {
          const lines = raw
            .split(/\r?\n/)
            .filter(line => line.startsWith("data:"))
            .map(line => line.slice(5).trimStart());

          if (!lines.length) return false;

          const dataText = lines.join("\n");
          if (dataText === "[DONE]") return true;

          let data;
          try {
            data = JSON.parse(dataText);
          } catch {
            return false;
          }

          if (data.error) throw new Error(String(data.error));

          const part = extract(data);
          if (part) {
            answer += part;
            reply.textContent = answer;
            scrollBottom();
          }

          return false;
        }

        try {
          while (!finished) {
            const chunk = await reader.read();

            if (chunk.done) {
              buffer += decoder.decode();
              break;
            }

            buffer += decoder.decode(chunk.value, { stream: true });

            let match;
            while ((match = /\r?\n\r?\n/.exec(buffer))) {
              const eventText = buffer.slice(0, match.index);
              buffer = buffer.slice(match.index + match[0].length);

              if (processEvent(eventText)) {
                finished = true;
                break;
              }
            }
          }

          if (buffer.trim()) processEvent(buffer);
        } finally {
          reader.releaseLock();
        }
      }

      if (!answer.trim()) {
        throw new Error(
          "The API connected, but returned no readable answer. Check the AI model response."
        );
      }

      history.push({ role: "assistant", content: answer });

      if (history.length > 40) {
        history.splice(0, history.length - 40);
      }
    } catch (error) {
      const message =
        error?.name === "AbortError"
          ? "Request timed out or was cancelled. Please try again."
          : error?.message || "Could not connect to the AI API.";

      reply.textContent =
        (answer ? answer + "\n\n" : "") + "⚠️ " + message;
      reply.classList.add("error");

      if (history[history.length - 1]?.role === "user") {
        history.pop();
      }

      console.error("Chat request failed:", error);
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
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
    update();
  });

  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      if (!busy && input.value.trim()) form.requestSubmit();
    }

    if (event.key === "Escape" && controller) {
      controller.abort();
    }
  });

  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.getAttribute("data-prompt") || "";
      update();
      if (input.value.trim()) form.requestSubmit();
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