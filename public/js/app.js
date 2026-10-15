// Shared, non-secret client-side helpers. AI chat logic lives in /chat.js.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
});
