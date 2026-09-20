const form = document.querySelector("#chat-form");
const input = document.querySelector("#user-input");
const conversation = document.querySelector("#conversation");
const starterButtons = document.querySelectorAll("[data-prompt]");
const navItems = document.querySelectorAll(".nav-item");
const threadList = document.querySelector("#thread-list");
const clearThreadsButton = document.querySelector("#clear-threads");
const taskInputs = document.querySelectorAll("#focus-tasks input");
const progressBar = document.querySelector("#progress-bar");
const progressCount = document.querySelector("#progress-count");
const TASKS_KEY = "moesha-redesign-focus-tasks";

const replies = [
  "Let’s make that smaller and more concrete. What would a useful first version look like?",
  "I’d start by naming the outcome, then choosing the next action that takes less than 20 minutes.",
  "That sounds worth exploring. Share what you have so far and I’ll help you give it shape."
];
let replyIndex = 0;

function addThread(prompt) {
  const thread = document.createElement("button");
  thread.className = "thread-item is-selected";
  thread.type = "button";
  thread.innerHTML = `<span class="thread-mark coral">✦</span><span><strong></strong><small>Just now · new</small></span><span class="thread-arrow">›</span>`;
  thread.querySelector("strong").textContent = prompt.length > 30 ? `${prompt.slice(0, 30)}...` : prompt;
  threadList.querySelectorAll(".thread-item").forEach((item) => item.classList.remove("is-selected"));
  threadList.prepend(thread);
}

function updateProgress() {
  const completed = [...taskInputs].filter((task) => task.checked).length;
  progressCount.textContent = `${completed} / ${taskInputs.length}`;
  progressBar.style.width = `${(completed / taskInputs.length) * 100}%`;
  localStorage.setItem(TASKS_KEY, JSON.stringify([...taskInputs].map((task) => task.checked)));
}

function addMessage(text, role) {
  const message = document.createElement("article");
  message.className = `message ${role}-message`;

  if (role === "assistant") {
    message.innerHTML = `<div class="assistant-avatar"><img src="../img/Moesha.png" alt="Moesha" /></div><div class="message-body"><div class="message-label"><strong>Moesha</strong><span>just now</span></div><p></p></div>`;
  } else {
    message.innerHTML = `<div class="message-spacer" aria-hidden="true"></div><div class="message-body"><div class="message-label"><strong>You</strong><span>just now</span></div><p></p></div>`;
  }

  message.querySelector("p").textContent = text;
  conversation.appendChild(message);
  message.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function submitPrompt(prompt) {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) return;
  addMessage(cleanPrompt, "user");
  addThread(cleanPrompt);
  input.value = "";
  const thinking = document.createElement("article");
  thinking.className = "message assistant-message";
  thinking.innerHTML = `<div class="assistant-avatar"><img src="../img/Moesha.png" alt="Moesha" /></div><div class="message-body"><div class="message-label"><strong>Moesha</strong><span>thinking</span></div><p class="thinking">Working through that</p></div>`;
  conversation.appendChild(thinking);
  window.setTimeout(() => {
    thinking.remove();
    addMessage(replies[replyIndex % replies.length], "assistant");
    replyIndex += 1;
  }, 350);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitPrompt(input.value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

starterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
  });
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((navItem) => navItem.classList.remove("is-active"));
    item.classList.add("is-active");
  });
});

document.querySelector("#attach-button").addEventListener("click", () => {

  taskInputs.forEach((task) => task.addEventListener("change", updateProgress));

  clearThreadsButton.addEventListener("click", () => {
    threadList.innerHTML = "<p class=\"empty-threads\">No saved threads yet.</p>";
  });

  try {
    const savedTasks = JSON.parse(localStorage.getItem(TASKS_KEY) || "[]");
    taskInputs.forEach((task, index) => { task.checked = savedTasks[index] === true; });
  } catch {
    // Use the unchecked defaults when local storage is unavailable.
  }
  updateProgress();
  input.value = "I want to share a file or screenshot for context. ";
  input.focus();
});
