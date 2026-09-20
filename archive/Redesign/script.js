// SECTION: DOM references
const voiceToggle = document.getElementById("voice-toggle");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const newChatBtn = document.getElementById("new-chat-btn");
const sampleQuestionBtn = document.getElementById("sample-question-btn");
const quickHtmlBtn = document.getElementById("quick-html");
const quickCssBtn = document.getElementById("quick-css");
const quickJsBtn = document.getElementById("quick-js");
const quickHealthBtn = document.getElementById("quick-health");
const quickDietBtn = document.getElementById("quick-diet");
const quickFinanceBtn = document.getElementById("quick-finance");
const quickIdeasBtn = document.getElementById("quick-ideas");
const quickTriviaBtn = document.getElementById("quick-trivia");
const micBtn = document.getElementById("mic-btn");
const exampleList = document.getElementById("example-list");
const plannerList = document.getElementById("planner-list");
const clearPlannerBtn = document.getElementById("clear-planner-btn");
const assistantAvatarSrc = "../../img/Moesha.png";
const STORAGE_KEY = "moesha-redesign-planner-v1";
const THREADS_KEY = "moesha-redesign-threads-v1";
const ELEVENLABS_KEY = "moesha-redesign-elevenlabs-key";
const ELEVENLABS_VOICE_ID = "moesha-redesign-elevenlabs-voice";
const VOICE_ENABLED_KEY = "moesha-redesign-voice-enabled";
const TIMER_KEY = "moesha-redesign-timer-v1";
const notes = [];
const reminders = [];
function readStorage(key, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

let elevenLabsApiKey = readStorage(ELEVENLABS_KEY);
let elevenLabsVoiceId = readStorage(ELEVENLABS_VOICE_ID);
let isVoiceEnabled = readStorage(VOICE_ENABLED_KEY) === "true";
const elevenLabsStatus = document.getElementById("elevenlabs-status");

function loadPlannerState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed.notes)) notes.push(...parsed.notes);
    if (Array.isArray(parsed.reminders)) reminders.push(...parsed.reminders);
  } catch (error) {
    console.warn("Planner storage could not be loaded", error);
  }
}

function savePlannerState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, reminders }));
  } catch (error) {
    console.warn("Planner storage could not be saved", error);
  }
}

function getDateLabel() {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => { toast.hidden = true; }, 2800);
}

function saveThread(prompt) {
  try {
    const saved = JSON.parse(localStorage.getItem(THREADS_KEY) || "[]");
    const threads = [{ title: prompt.slice(0, 36), createdAt: new Date().toISOString() }, ...saved].slice(0, 8);
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch (error) {
    console.warn("Redesign threads could not be saved", error);
  }
}

function createAssistantAvatar() {
  const avatar = document.createElement("div");
  avatar.className = "message-avatar assistant-avatar";

  const image = document.createElement("img");
  image.className = "avatar-image";
  image.src = assistantAvatarSrc;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.addEventListener("error", () => {
    image.remove();
  });

  avatar.appendChild(image);
  return avatar;
}

// SECTION: Helpers
function updateElevenLabsStatus() {
  if (elevenLabsStatus) {
    const label = elevenLabsApiKey ? "ElevenLabs: on" : "ElevenLabs: off";
    elevenLabsStatus.innerHTML = `<span class="status-text">${label}</span>`;
    elevenLabsStatus.title = "Click to set or update your ElevenLabs API key";
  }
}

async function speakText(text, lang = "en-US") {
  if (!isVoiceEnabled) return;

  if (elevenLabsApiKey) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + (elevenLabsVoiceId || "JBFqnCBsd6RMkjVDRZzb"), {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.4, similarity_boost: 0.9 },
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
        return;
      }
    } catch (error) {
      console.warn("ElevenLabs TTS failed", error);
    }
  }

  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.pitch = 1.35;
  utterance.volume = 1;

  const langPrefix = (lang || "en-US").slice(0, 2).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(langPrefix) &&
      /female|samantha|victoria|zira|ava|jenny|susan|paulina|monica|premium/i.test(voice.name)
    ) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix) && voice.localService) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function showBrowserNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(() => {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}

function parseTimerDuration(userText) {
  if (typeof userText !== "string") return null;

  const matches = [...userText.toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/g)];
  if (!matches.length) return null;

  let totalMs = 0;
  const parts = { hours: 0, minutes: 0, seconds: 0 };

  matches.forEach((match) => {
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (/hours?|hrs?|hr|h$/.test(unit)) {
      totalMs += value * 60 * 60 * 1000;
      parts.hours += value;
    } else if (/minutes?|mins?|min|m$/.test(unit)) {
      totalMs += value * 60 * 1000;
      parts.minutes += value;
    } else if (/seconds?|secs?|sec|s$/.test(unit)) {
      totalMs += value * 1000;
      parts.seconds += value;
    }
  });

  if (totalMs <= 0) return null;

  return { totalMs, parts };
}

function formatTimerDisplay(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

const timerState = {
  totalMs: 0,
  remainingMs: 0,
  intervalId: null,
  isRunning: false,
  endTime: 0,
};

function updateTimerDisplay() {
  const displayMs = timerState.remainingMs > 0 ? timerState.remainingMs : timerState.totalMs;
  if (timerDisplay) {
    timerDisplay.textContent = formatTimerDisplay(timerState.remainingMs > 0 ? timerState.remainingMs : (timerState.isRunning ? timerState.remainingMs : timerState.totalMs));
  }
}

function stopTimerInterval() {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
}

function updateTimerButtons() {
  if (!timerStartBtn || !timerPauseBtn || !timerResetBtn) return;
  timerStartBtn.disabled = timerState.isRunning || timerState.totalMs <= 0;
  timerPauseBtn.disabled = !timerState.isRunning;
  timerResetBtn.disabled = timerState.totalMs <= 0 && timerState.remainingMs <= 0;
}

function saveTimerState() {
  try {
    const remainingMs = timerState.isRunning ? Math.max(0, timerState.endTime - Date.now()) : timerState.remainingMs;
    localStorage.setItem(TIMER_KEY, JSON.stringify({ totalMs: timerState.totalMs, remainingMs }));
  } catch (error) {
    console.warn("Redesign timer could not be saved", error);
  }
}

function setTimerFromInput(value) {
  const parsed = parseTimerDuration(value || "");
  if (!parsed) return null;

  timerState.totalMs = parsed.totalMs;
  timerState.remainingMs = parsed.totalMs;
  timerState.endTime = 0;
  timerState.isRunning = false;
  stopTimerInterval();
  updateTimerDisplay();
  updateTimerButtons();
  saveTimerState();

  return {
    text: `Timer set for ${formatTimerDisplay(parsed.totalMs)}. I’ll notify you when it’s done.`,
    tag: "Timer",
    lang: "en-US",
  };
}

function setTimerFromRequest(userText) {
  const parsed = parseTimerDuration(userText);
  if (!parsed) return null;

  const timerLabel = formatTimerDisplay(parsed.totalMs);
  reminders.push({ text: `Timer: ${timerLabel}`, createdAt: new Date() });
  renderPlanner();
  if (timerInput) timerInput.value = `${parsed.totalMs / 1000} seconds`;
  timerState.totalMs = parsed.totalMs;
  timerState.remainingMs = parsed.totalMs;
  startTimerFromWidget();

  return {
    text: `Timer set for ${timerLabel}. I’ll notify you when it’s done.`,
    tag: "Timer",
    lang: "en-US",
  };
}

function startTimerFromWidget() {
  const sourceText = timerInput ? timerInput.value.trim() : "";
  const parsed = parseTimerDuration(sourceText);

  if (!parsed) {
    const reply = "Enter a timer like 5 minutes, 1 hour, or 30s to start the countdown.";
    if (timerDisplay) timerDisplay.textContent = "00:00:00";
    if (chatWindow) {
      appendMessage({ role: "assistant", text: reply, messageTagType: "Timer" });
      speakText(reply, "en-US");
    }
    return;
  }

  if (!timerState.isRunning) {
    timerState.totalMs = parsed.totalMs;
    timerState.remainingMs = timerState.remainingMs > 0 ? timerState.remainingMs : parsed.totalMs;
    timerState.endTime = Date.now() + timerState.remainingMs;
    timerState.isRunning = true;
    updateTimerDisplay();

    stopTimerInterval();
    timerState.intervalId = window.setInterval(() => {
      timerState.remainingMs = Math.max(0, timerState.endTime - Date.now());
      updateTimerDisplay();

      if (timerState.remainingMs <= 0) {
        stopTimerInterval();
        timerState.isRunning = false;
        timerState.remainingMs = 0;
        timerState.totalMs = 0;
        saveTimerState();
        updateTimerButtons();
        updateTimerDisplay();
        showBrowserNotification("Moesha timer", "Your timer is complete.");
        speakText("Your timer is complete.", "en-US");
      }
    }, 1000);
  }

  updateTimerButtons();
}

function pauseTimerFromWidget() {
  if (!timerState.isRunning) return;
  timerState.remainingMs = Math.max(0, timerState.endTime - Date.now());
  timerState.isRunning = false;
  stopTimerInterval();
  updateTimerDisplay();
  updateTimerButtons();
  saveTimerState();
}

function resetTimerFromWidget() {
  pauseTimerFromWidget();
  timerState.totalMs = parseTimerDuration(timerInput ? timerInput.value.trim() : "")?.totalMs || timerState.totalMs || 0;
  timerState.remainingMs = timerState.totalMs;
  timerState.endTime = 0;
  updateTimerDisplay();
  updateTimerButtons();
  saveTimerState();
}

// -----------------------------
// Handler registry & dispatch
// -----------------------------
const handlers = [];

function registerHandler(name, { keywords = [], fn, priority = 0 } = {}) {
  handlers.push({ name, keywords, fn, priority });
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreHandler(handler, text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const k of handler.keywords) {
    if (!k) continue;
    if (typeof k === "string") {
      const kw = k.toLowerCase();
      // exact word boundary match gets a higher boost
      const wordRe = new RegExp("\\b" + escapeRegExp(kw) + "\\b");
      if (wordRe.test(lower)) {
        score += 2;
      } else if (lower.includes(kw)) {
        score += 1;
      }
    } else if (k instanceof RegExp) {
      if (k.test(lower)) score += 2;
    }
  }
  // Priority should be a small tie-breaker, not overpower keyword matches
  return score + (handler.priority || 0) * 0.01;
}

function dispatchToHandlers(text) {
  const trimmed = (text || "").toLowerCase().trim();

  // If user explicitly uses translate/traduce command, prefer translate handler
  if (/^(translate|traduce)\b/i.test(trimmed)) {
    const trans = handlers.find(h => h.name === 'translate');
    if (trans) return { ...trans.fn(text), handler: 'translate', confidence: 1 };
  }

  const exactGreetingRe = /^(hi|hello|hola|hey|buenos d[ií]as|buenas|buenas tardes|buenas noches)\b[!,.]?$/i;
  if (exactGreetingRe.test(trimmed)) {
    const greet = handlers.find(h => h.name === 'greeting');
    if (greet) return { ...greet.fn(text), handler: 'greeting', confidence: 1 };
  }
  // Planner has its own detection; check it first so planner commands take precedence
  const plannerHandler = handlers.find((h) => h.name === "planner");
  if (plannerHandler) {
    const plannerRes = plannerHandler.fn(text);
    if (plannerRes) return { ...plannerRes, handler: "planner", confidence: 1 };
  }

  // Score remaining handlers by keyword matches (exclude greeting from general scoring)
  const scored = handlers
    .filter((h) => h.name !== "planner" && h.name !== "greeting")
    .map((h) => ({ handler: h, score: scoreHandler(h, text) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) {
    const fallback = handlers.find((h) => h.name === "fallback");
    if (fallback) return { ...fallback.fn(text), handler: "fallback", confidence: 0.25 };
    return { text: "I don't understand that yet.", tag: "Fallback", lang: "en-US", confidence: 0.2 };
  }

  const result = best.handler.fn(text) || { text: "No reply", tag: "Unknown", lang: "en-US" };
  const keywordCount = Math.max(1, best.handler.keywords.length);
  // Use a smaller divisor so handlers with many keywords aren't unfairly penalized.
  const scale = Math.max(1, Math.ceil(keywordCount / 3));
  let confidence = Math.min(1, best.score / scale);
  // Ensure a small positive score yields at least a modest confidence
  if (confidence === 0 && best.score > 0) confidence = Math.min(0.3, best.score / (scale * 2));
  return { ...result, handler: best.handler.name, confidence };
}

// Register basic handlers (uses existing helper functions where possible)
registerHandler("planner", { keywords: ["note", "remind", "timer", "alarm", "reminder", "schedule", "appointment"], fn: handlePlannerIntent, priority: 2 });
registerHandler("weather", { keywords: ["weather", "forecast", "temperature", "rain", "sunny", "cloudy", "clima", "tiempo"], fn: (text) => {
  const cityMatch = text.toLowerCase().match(/(?:in|for|at)\s+([a-zA-Z ]+)/i);
  const city = cityMatch ? cityMatch[1].trim() : "your area";
  return { text: getWeatherSummary(city), tag: "Weather helper", lang: "en-US" };
} });
registerHandler("coding", { keywords: ["html", "css", "flex", "grid", "javascript", "js", "python", "c++", "java", "responsive"], fn: (text) => {
  if (/html/i.test(text)) return { text: "Check your HTML nesting and attributes; ensure elements are closed.", tag: "Coding helper", lang: "en-US" };
  if (/css|flex|grid/i.test(text)) return { text: "Inspect computed styles in DevTools and validate layout rules (display, parent constraints).", tag: "Coding helper", lang: "en-US" };
  if (/javascript|\bjs\b/i.test(text)) return { text: "Check the console for runtime errors and ensure scripts are loaded after DOM or use DOMContentLoaded.", tag: "Coding helper", lang: "en-US" };
  return { text: "I can help with coding questions—can you share a bit more detail or an error message?", tag: "Coding helper", lang: "en-US" };
} });
registerHandler("health", { keywords: ["health", "exercise", "workout", "sleep", "salud", "ejercicio"], fn: (text) => {
  return { text: "General wellness tips: consistent sleep, balanced meals, movement, and stress management. For personalized advice, consult a professional.", tag: "Health helper", lang: /\b(es|spanish|esp)\b/i.test(text.toLowerCase()) ? "es-ES" : "en-US" };
} });
registerHandler("diet", {
  keywords: ["diet", "nutrition", "calorie", "calories", "macro", "macros", "protein", "carbs", "meal plan", "meal", "vegan", "vegetarian", "keto", "lose weight", "gain muscle", "bulk", "cut", "bmi", "bmr", "dieta", "nutrición"],
  priority: 1,
  fn: handleDietIntent,
});
registerHandler("finance", { keywords: ["finance", "budget", "money", "saving", "debt", "dinero", "ahorro", "ahorrar", "presupuesto"], fn: (text) => ({ text: "Track income/expenses for a month, set a simple budget, and prioritize essentials.", tag: "Finance helper", lang: /\b(dinero|ahorro|presupuesto|guardar)\b/i.test(text.toLowerCase()) ? "es-ES" : "en-US" }) });
registerHandler("ideas", { keywords: ["idea", "brainstorm", "project"], fn: (text) => ({ text: "Write ideas quickly without judging, group similar ones, pick 1–2, and break into tiny next steps.", tag: "Ideas helper", lang: "en-US" }) });
registerHandler("trivia", {
  keywords: ["trivia", "fact", "facts", "fun fact", "history", "historia", "curiosity", "interesting", "did you know", "ancient", "civilization", "space", "universe", "planet"],
  priority: 1,
  fn: handleTriviaIntent,
});
registerHandler("translate", { keywords: [/^translate\b/i, /^traduce\b/i, "translate", "traduce", "translate to spanish", "traduce a español", "español", "spanish"], fn: (text) => {
  if (/^translate\b/i.test(text)) {
    const phrase = text.slice(10).trim();
    return { text: phrase ? `Approximate translation: \"${phrase}\" → (approx.)` : "Tell me what to translate.", tag: "Translation helper", lang: "en-US" };
  }
  if (/^traduce\b/i.test(text)) {
    const frase = text.slice(8).trim();
    return { text: frase ? `Traducción aproximada: \"${frase}\" → (approx.)` : "Dime qué quieres traducir.", tag: "Ayuda de traducción", lang: "es-ES" };
  }
  return null;
} });
registerHandler("greeting", { keywords: ["hi", "hello", "hola", "hey", "buenos días", "buenas", "buenas tardes", "buenas noches"], fn: (text) => ({ text: /\b(hola|buenas|buenos|buenas tardes|buenas noches)/i.test(text) ? "Hola, soy Moesha. ¿En qué te puedo ayudar hoy?" : "Hi, I'm Moesha! What can I help you with today?", tag: "Welcome", lang: /\b(hola|buenas|buenos)/i.test(text) ? "es-ES" : "en-US" }), priority: 4 });
registerHandler("fallback", { keywords: [], fn: (text) => ({ text: "This is a front-end demo; I provide general guidance. Please give a specific topic or error to get a focused answer.", tag: "Multi-domain helper", lang: "en-US" }) });

function setAlarmFromRequest(userText) {
  const lower = userText.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!timeMatch) return null;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || 0);
  const period = timeMatch[3];
  let alarmHour = hour;

  if (period === "pm" && alarmHour < 12) alarmHour += 12;
  if (period === "am" && alarmHour === 12) alarmHour = 0;

  const now = new Date();
  const alarmTime = new Date();
  alarmTime.setHours(alarmHour, minute, 0, 0);

  if (alarmTime <= now) alarmTime.setDate(alarmTime.getDate() + 1);

  const diff = alarmTime.getTime() - now.getTime();
  reminders.push({ text: `Alarm: ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, createdAt: new Date() });
  renderPlanner();

  setTimeout(() => {
    showBrowserNotification("Moesha alarm", `Alarm ringing at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}.`);
  }, diff);

  return {
    text: `Alarm set for ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}.`,
    tag: "Alarm",
    lang: "en-US",
  };
}

function renderPlanner() {
  if (!plannerList) return;
  plannerList.innerHTML = "";

  if (notes.length === 0 && reminders.length === 0) {
    const empty = document.createElement("li");
    empty.className = "planner-empty";
    empty.textContent = "No notes or reminders yet.";
    plannerList.appendChild(empty);
    savePlannerState();
    return;
  }

  const noteItems = notes.slice(-4).map((note) => {
    const item = document.createElement("li");
    item.textContent = `📝 ${note.text}`;
    return item;
  });

  const reminderItems = reminders.slice(-4).map((reminder) => {
    const item = document.createElement("li");
    item.textContent = `🔔 ${reminder.text}`;
    return item;
  });

  [...noteItems, ...reminderItems].forEach((item) => plannerList.appendChild(item));
  savePlannerState();
}

function clearPlanner() {
  notes.length = 0;
  reminders.length = 0;
  renderPlanner();
}

// Safely renders assistant/user text, converting ```fenced``` blocks into copyable code blocks
// and newlines into <br>. Uses textContent/createTextNode only, so no HTML injection is possible.
function appendTextSegment(container, segment) {
  if (!segment) return;
  const p = document.createElement("p");
  p.className = "message-text";
  const lines = segment.split("\n");
  lines.forEach((line, i) => {
    if (i > 0) p.appendChild(document.createElement("br"));
    p.appendChild(document.createTextNode(line));
  });
  container.appendChild(p);
}

function renderMessageBody(container, text) {
  const fenceRe = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let hasContent = false;

  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      appendTextSegment(container, text.slice(lastIndex, match.index));
      hasContent = true;
    }
    const code = document.createElement("pre");
    code.className = "message-code";
    code.textContent = match[2].replace(/\n$/, "");
    container.appendChild(code);
    hasContent = true;
    lastIndex = fenceRe.lastIndex;
  }

  if (lastIndex < text.length) {
    appendTextSegment(container, text.slice(lastIndex));
    hasContent = true;
  }

  if (!hasContent) {
    appendTextSegment(container, text);
  }
}

function appendMessage({ role, text, messageTagType }) {
  const article = document.createElement("article");
  article.className = `message message-${role}`;

  const avatar = role === "assistant" ? createAssistantAvatar() : document.createElement("div");
  if (role !== "assistant") {
    avatar.className = "message-avatar";
    avatar.textContent = "You";
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const roleLabel = document.createElement("span");
  roleLabel.className = "message-role";
  roleLabel.textContent = role === "assistant" ? "Assistant" : "You";

  meta.appendChild(roleLabel);

  if (role === "assistant") {
    const tag = document.createElement("span");
    tag.className = "message-tag";
    tag.textContent = messageTagType || "Code · Health · Diet · Trivia · Weather · Ideas · Writing · Finance · Trading";
    meta.appendChild(tag);
  }

  bubble.appendChild(meta);
  renderMessageBody(bubble, text);

  article.appendChild(avatar);
  article.appendChild(bubble);
  chatWindow.appendChild(article);

  // Enhance any code blocks inside this new message
  enhanceCodeBlocks(article);

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Adds a temporary typing indicator for the assistant
function showTypingIndicator() {
  const article = document.createElement("article");
  article.className = "message message-assistant";

  const avatar = createAssistantAvatar();
  avatar.classList.add("is-speaking");

  const bubble = document.createElement("div");
  bubble.className = "message-bubble message-typing";

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const roleLabel = document.createElement("span");
  roleLabel.className = "message-role";
  roleLabel.textContent = "Assistant";

  meta.appendChild(roleLabel);

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.innerHTML = "<span></span><span></span><span></span>";

  bubble.appendChild(meta);
  bubble.appendChild(dots);

  article.appendChild(avatar);
  article.appendChild(bubble);

  chatWindow.appendChild(article);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return article;
}

// Utility: attach copy button to any code blocks inside a message bubble
function enhanceCodeBlocks(container) {
  const codeBlocks = container.querySelectorAll(".message-code");
  codeBlocks.forEach((block) => {
    if (block.querySelector(".message-code-copy")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "message-code-copy";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      const text = block.innerText;
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = original;
        }, 1200);
      } catch (e) {
        console.error("Copy failed", e);
      }
    });
    block.appendChild(btn);
  });
}

// -----------------------------
// Trivia & fun facts
// -----------------------------
const TRIVIA_FACTS = [
  { category: "history", text: "The Great Pyramid of Giza was the tallest man-made structure on Earth for over 3,800 years." },
  { category: "history", text: "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid." },
  { category: "history", text: "Oxford University is older than the Aztec Empire—Oxford has been teaching since around 1096." },
  { category: "history", text: "Ancient Rome had a form of concrete that has lasted over 2,000 years, partly thanks to volcanic ash." },
  { category: "history", text: "The shortest war in recorded history was between Britain and Zanzibar in 1896, lasting under 45 minutes." },
  { category: "history", text: "Vikings reached North America roughly 500 years before Christopher Columbus." },
  { category: "history", text: "Ancient Egyptians used moldy bread as an early form of antibiotic on wounds." },
  { category: "history", text: "The Library of Alexandria is believed to have held hundreds of thousands of scrolls before its decline." },
  { category: "science", text: "A bolt of lightning is roughly five times hotter than the surface of the Sun." },
  { category: "science", text: "Honey never spoils—archaeologists have found edible honey in 3,000-year-old Egyptian tombs." },
  { category: "science", text: "Water can boil and freeze at the same time; it's called the triple point." },
  { category: "science", text: "Octopuses have three hearts and blue, copper-based blood." },
  { category: "science", text: "Bananas are naturally slightly radioactive because of their potassium content." },
  { category: "science", text: "A single teaspoon of a neutron star would weigh about a billion tons." },
  { category: "space", text: "A day on Venus is longer than its year—it rotates slower than it orbits the Sun." },
  { category: "space", text: "There are more stars in the observable universe than grains of sand on every beach on Earth." },
  { category: "space", text: "Neutron stars can spin hundreds of times per second." },
  { category: "space", text: "The footprints left by Apollo astronauts on the Moon should last millions of years since there's no wind or water there." },
  { category: "geography", text: "Russia spans 11 time zones, more than any other country." },
  { category: "geography", text: "Africa is home to the world's largest hot desert (the Sahara) and one of its largest rainforests (the Congo Basin)." },
  { category: "geography", text: "Mount Everest grows a few millimeters taller every year due to tectonic plate movement." },
  { category: "geography", text: "The Pacific Ocean is so large it contains about half of the water on Earth's surface." },
  { category: "animals", text: "A group of flamingos is called a 'flamboyance'." },
  { category: "animals", text: "Elephants are one of the few animals that can recognize themselves in a mirror." },
  { category: "animals", text: "Sea otters hold hands while sleeping so they don't drift apart." },
  { category: "animals", text: "The mantis shrimp can see a much wider range of colors than humans, thanks to up to 16 types of color receptors." },
  { category: "food", text: "Carrots were originally purple before orange varieties became popular in the Netherlands." },
  { category: "food", text: "Chocolate was once used as currency by the Aztecs." },
  { category: "food", text: "Apples float in water because they are about 25% air by volume." },
  { category: "language", text: "The word 'set' has more definitions in English than any other word." },
  { category: "language", text: "Shakespeare is credited with inventing or popularizing hundreds of English words still used today." },
];

let lastTriviaIndex = -1;

function pickTriviaFact(category) {
  const pool = category ? TRIVIA_FACTS.filter((f) => f.category === category) : TRIVIA_FACTS;
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  let index;
  do {
    index = Math.floor(Math.random() * pool.length);
  } while (pool[index] === TRIVIA_FACTS[lastTriviaIndex]);

  const fact = pool[index];
  lastTriviaIndex = TRIVIA_FACTS.indexOf(fact);
  return fact;
}

function handleTriviaIntent(userText) {
  const lower = userText.toLowerCase();
  const categoryMap = [
    { re: /histor|ancient|civiliz/i, category: "history" },
    { re: /space|planet|star|universe|astronom/i, category: "space" },
    { re: /science|scientific|chemistry|physics/i, category: "science" },
    { re: /geograph|country|countries|ocean|mountain/i, category: "geography" },
    { re: /animal|wildlife|creature/i, category: "animals" },
    { re: /food|cook/i, category: "food" },
    { re: /language|word|words/i, category: "language" },
  ];
  const matched = categoryMap.find((c) => c.re.test(lower));

  const fact = pickTriviaFact(matched ? matched.category : null);
  if (!fact) {
    return { text: "I don't have a fact on that topic yet—try history, science, space, geography, animals, food, or language.", tag: "Trivia helper", lang: "en-US" };
  }

  const label = matched ? matched.category : fact.category;
  return {
    text: `Did you know? ${fact.text}\nAsk for "another" fact, or name a topic like history, science, space, or animals.`,
    tag: `Trivia · ${label.charAt(0).toUpperCase() + label.slice(1)}`,
    lang: "en-US",
  };
}

// -----------------------------
// Diet & nutrition logic
// -----------------------------
const MEAL_IDEAS = {
  breakfast: ["Greek yogurt with berries and oats", "Veggie egg scramble with whole-grain toast", "Overnight oats with peanut butter and banana", "Tofu scramble with spinach and avocado"],
  lunch: ["Grilled chicken salad with olive oil dressing", "Lentil soup with a side salad", "Quinoa bowl with roasted vegetables and chickpeas", "Turkey and hummus wrap with veggies"],
  dinner: ["Baked salmon with steamed broccoli and rice", "Stir-fried tofu with mixed vegetables", "Lean beef or bean chili with brown rice", "Grilled fish tacos with cabbage slaw"],
  snack: ["A handful of almonds and an apple", "Carrot sticks with hummus", "Cottage cheese with pineapple", "Protein shake with a banana"],
};

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildMealPlanReply() {
  const plan = [
    `Breakfast: ${pickRandom(MEAL_IDEAS.breakfast)}`,
    `Lunch: ${pickRandom(MEAL_IDEAS.lunch)}`,
    `Dinner: ${pickRandom(MEAL_IDEAS.dinner)}`,
    `Snack: ${pickRandom(MEAL_IDEAS.snack)}`,
  ];
  return `Here's a simple one-day meal idea:\n${plan.join("\n")}\nAdjust portions to your calorie target, and swap ingredients for allergies or preferences.`;
}

// Extracts weight (kg), height (cm), age, and biological sex from free text for BMR/TDEE estimates
function parseBodyStats(text) {
  const lower = text.toLowerCase();

  let weightKg = null;
  const weightLbMatch = lower.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pounds?)\b/);
  const weightKgMatch = lower.match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?)\b/);
  if (weightKgMatch) weightKg = Number(weightKgMatch[1]);
  else if (weightLbMatch) weightKg = Number(weightLbMatch[1]) * 0.453592;

  let heightCm = null;
  const heightCmMatch = lower.match(/(\d+(?:\.\d+)?)\s*(cm|centimeters?)\b/);
  const heightFtInMatch = lower.match(/(\d)\s*(?:ft|feet|')\s*(\d{1,2})?\s*(?:in|inches|")?\b/);
  if (heightCmMatch) heightCm = Number(heightCmMatch[1]);
  else if (heightFtInMatch) {
    const feet = Number(heightFtInMatch[1]);
    const inches = Number(heightFtInMatch[2] || 0);
    heightCm = (feet * 12 + inches) * 2.54;
  }

  const ageMatch = lower.match(/(\d{1,3})\s*(?:years?\s*old|yo|y\/o|years)\b/);
  const age = ageMatch ? Number(ageMatch[1]) : null;

  const isMale = /\bmale\b|\bman\b|\bhombre\b/.test(lower) && !/\bfemale\b|\bwoman\b/.test(lower);
  const isFemale = /\bfemale\b|\bwoman\b|\bmujer\b/.test(lower);

  const activityMap = [
    { re: /sedentary|little to no exercise/, factor: 1.2 },
    { re: /light(ly)? active|1-3 days|light exercise/, factor: 1.375 },
    { re: /moderate(ly)? active|3-5 days|moderate exercise/, factor: 1.55 },
    { re: /very active|6-7 days|hard exercise/, factor: 1.725 },
    { re: /extra active|athlete|physical job/, factor: 1.9 },
  ];
  const activity = activityMap.find((a) => a.re.test(lower));

  return { weightKg, heightCm, age, isMale, isFemale, activityFactor: activity ? activity.factor : 1.375 };
}

function handleDietIntent(userText) {
  const lower = userText.toLowerCase().trim();

  // Calorie / calculator request with enough body stats -> compute BMR + TDEE (Mifflin-St Jeor)
  if (/calorie|calories|bmr|tdee|how many calories|maintenance/i.test(lower)) {
    const stats = parseBodyStats(lower);
    if (stats.weightKg && stats.heightCm && stats.age) {
      const sexOffset = stats.isFemale ? -161 : 5; // defaults to male formula unless female is specified
      const bmr = 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age + sexOffset;
      const tdee = Math.round(bmr * stats.activityFactor);
      const cut = Math.round(tdee - 500);
      const bulk = Math.round(tdee + 300);
      return {
        text: `Estimated maintenance calories: ~${tdee} kcal/day.\nFor gradual fat loss: ~${cut} kcal/day.\nFor lean muscle gain: ~${bulk} kcal/day.\nAim for ~1.6–2.2g of protein per kg of bodyweight, and adjust after 2 weeks based on results.`,
        tag: "Diet helper",
        lang: "en-US",
      };
    }
    return {
      text: "I can estimate your daily calorie needs. Share your weight (kg or lbs), height (cm or ft/in), age, and sex/activity level—e.g. \"I'm a 30 year old male, 80kg, 180cm, moderately active\".",
      tag: "Diet helper",
      lang: "en-US",
    };
  }

  if (/meal plan|meal idea|what should i eat|give me a meal/i.test(lower)) {
    return { text: buildMealPlanReply(), tag: "Diet helper", lang: "en-US" };
  }

  if (/lose weight|fat loss|cut(ting)?\b/i.test(lower)) {
    return {
      text: "For fat loss: eat in a modest calorie deficit (~300–500 kcal below maintenance), prioritize protein (1.6–2.2g/kg) to preserve muscle, keep fiber-rich veggies at most meals, and stay consistent with sleep and light daily movement.",
      tag: "Diet helper",
      lang: "en-US",
    };
  }

  if (/gain muscle|bulk(ing)?|build muscle/i.test(lower)) {
    return {
      text: "For muscle gain: eat in a small calorie surplus (~200–300 kcal above maintenance), get 1.6–2.2g protein per kg bodyweight, spread protein across 3–4 meals, and pair it with progressive resistance training.",
      tag: "Diet helper",
      lang: "en-US",
    };
  }

  if (/vegan/i.test(lower)) {
    return {
      text: "Vegan diet tips: combine legumes, grains, and nuts for complete protein; consider B12, iron, and omega-3 (algae oil) supplementation; and use tofu, tempeh, lentils, or seitan as protein anchors each meal.",
      tag: "Diet helper",
      lang: "en-US",
    };
  }

  if (/vegetarian/i.test(lower)) {
    return {
      text: "Vegetarian diet tips: include eggs and dairy for easy protein and B12, add legumes and whole grains at meals, and watch iron intake by pairing plant iron sources with vitamin C.",
      tag: "Diet helper",
      lang: "en-US",
    };
  }

  if (/\bketo\b/i.test(lower)) {
    return {
      text: "Keto basics: aim for roughly 70% fat, 25% protein, 5% carbs (under ~20–30g net carbs/day). Prioritize electrolytes (sodium, potassium, magnesium) in the first week to avoid the \"keto flu\".",
      tag: "Diet helper",
      lang: "en-US",
    };
  }

  if (/protein/i.test(lower)) {
    return {
      text: "A practical protein target is 1.6–2.2g per kg of bodyweight per day, spread across 3–4 meals. Good sources: chicken, fish, eggs, Greek yogurt, tofu, tempeh, and legumes.",
      tag: "Diet helper",
      lang: "en-US",
    };
  }

  if (/dieta|nutrición/i.test(lower)) {
    return {
      text: "Consejos generales de nutrición: prioriza proteína magra, verduras en cada comida, granos integrales, y mantente hidratado. Ajusta las porciones según tu objetivo (perder grasa, mantener o ganar músculo).",
      tag: "Ayuda de dieta",
      lang: "es-ES",
    };
  }

  return {
    text: "I can help with diet and nutrition: ask me to estimate your daily calories, suggest a meal plan, or give tips for weight loss, muscle gain, keto, vegan, or vegetarian eating.",
    tag: "Diet helper",
    lang: "en-US",
  };
}

function getCurrentDateLabel() {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function getCurrentTimeLabel() {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function getWeatherSummary(city = "your area") {
  const weatherMap = {
    london: { temp: 16, condition: "light rain" },
    newyork: { temp: 24, condition: "sunny" },
    tokyo: { temp: 28, condition: "clear skies" },
    paris: { temp: 20, condition: "cloudy" },
    sydney: { temp: 19, condition: "partly cloudy" },
  };

  const normalized = city.toLowerCase();
  const match = weatherMap[normalized] || weatherMap[normalized.replace(/\s+/g, "")];
  if (match) {
    return `Weather in ${city}: ${match.temp}°C and ${match.condition}.`;
  }

  return `Weather in ${city}: 21°C and mild breeze.`;
}

function handlePlannerIntent(userText) {
  const lower = userText.toLowerCase().trim();

  if (/timer|countdown/i.test(lower)) {
    const timerReply = setTimerFromRequest(userText);
    if (timerReply) return timerReply;
  }

  if (/alarm/i.test(lower)) {
    const alarmReply = setAlarmFromRequest(userText);
    if (alarmReply) return alarmReply;
  }

  if (/(take|add|save|make)\s+(a|an)?\s*note|\bnote\b/i.test(lower)) {
    const noteText = lower
      .replace(/^(take|add|save|make)\s+(a|an)?\s*note\s*/i, "")
      .replace(/^note\s*/i, "")
      .trim();

    if (!noteText) {
      return {
        text: "I can save a note. Try: “note call mom after dinner”.",
        tag: "Planner",
        lang: "en-US",
      };
    }

    notes.push({ text: noteText, createdAt: new Date() });
    renderPlanner();
    return {
      text: `Saved a note: “${noteText}”.`,
      tag: "Planner",
      lang: "en-US",
    };
  }

  if (/remind|reminder/i.test(lower)) {
    const reminderText = lower
      .replace(/^(remind me|add reminder|set reminder)\s*/i, "")
      .replace(/^to\s+/i, "")
      .replace(/reminder\s*/i, "")
      .trim();
    const reminderValue = reminderText || "General reminder";

    reminders.push({ text: reminderValue, createdAt: new Date() });
    renderPlanner();
    return {
      text: `Reminder saved: “${reminderValue}”.`,
      tag: "Reminder",
      lang: "en-US",
    };
  }

  if (/schedule|appointment|meeting|plan/i.test(lower)) {
    const location = lower.match(/(?:at|in|location|venue)\s+([a-z0-9 ,.-]+)/i)?.[1] || "your chosen place";
    const time = lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i)?.[0] || "later today";
    const label = lower.includes("meeting") ? "meeting" : lower.includes("appointment") ? "appointment" : "schedule";

    return {
      text: `I’ve set up a ${label} for later today at ${time}. Location: ${location}.`,
      tag: "Scheduler",
      lang: "en-US",
    };
  }

  if (/what['’]?s? the date|today|date today|what day/i.test(lower)) {
    return {
      text: `Today is ${getCurrentDateLabel()}.`,
      tag: "Date helper",
      lang: "en-US",
    };
  }

  if (/what['’]?s? the time|time now|current time|what time/i.test(lower)) {
    return {
      text: `The current time is ${getCurrentTimeLabel()}.`,
      tag: "Time helper",
      lang: "en-US",
    };
  }

  if (/weather|forecast/i.test(lower)) {
    const cityMatch = lower.match(/(?:in|for|at)\s+([a-zA-Z ]+)/i);
    const city = cityMatch ? cityMatch[1].trim() : "your area";
    return {
      text: getWeatherSummary(city),
      tag: "Weather helper",
      lang: "en-US",
    };
  }

  if (/location|where am i|where is/i.test(lower)) {
    const location = lower.match(/(?:at|in|location|venue)\s+([a-z0-9 ,.-]+)/i)?.[1] || "your saved place";
    return {
      text: `Location note: ${location}. I can keep that for your reminder or schedule.`,
      tag: "Location helper",
      lang: "en-US",
    };
  }

  return null;
}

// Generates a simple mock response and topic tag based on registered handlers.
// Remembers the last handler used so short follow-ups ("more", "another", "otra")
// can continue the same topic instead of falling back to a generic reply.
let lastHandlerName = null;
const FOLLOW_UP_RE = /^(more|another|again|other one|one more|otra|otro|más|de nuevo)\.?!?$/i;

function generateMockReply(userText) {
  const trimmed = userText.trim();
  const isFollowUp = FOLLOW_UP_RE.test(trimmed) && lastHandlerName;
  const followUpHandler = isFollowUp ? handlers.find((h) => h.name === lastHandlerName) : null;

  const res = followUpHandler
    ? { ...(followUpHandler.fn(userText) || {}), handler: lastHandlerName, confidence: 1 }
    : dispatchToHandlers(userText);

  if (res.handler) lastHandlerName = res.handler;

  return {
    text: res.text || res.reply || "",
    tag: res.tag || res.handler || "Multi-domain helper",
    lang: res.lang || "en-US",
    confidence: typeof res.confidence === "number" ? res.confidence : 1,
    handler: res.handler || null,
  };
}



const timerInput = document.getElementById("timer-input");
const timerDisplay = document.getElementById("timer-display");
const timerStartBtn = document.getElementById("timer-start-btn");
const timerPauseBtn = document.getElementById("timer-pause-btn");
const timerResetBtn = document.getElementById("timer-reset-btn");

try {
  const savedTimer = JSON.parse(localStorage.getItem(TIMER_KEY) || "null");
  if (savedTimer && savedTimer.remainingMs > 0) {
    timerState.totalMs = Number(savedTimer.totalMs) || 0;
    timerState.remainingMs = Number(savedTimer.remainingMs) || 0;
  }
} catch {
  // Use the empty timer when saved state is unavailable.
}

window.addEventListener("beforeunload", saveTimerState);

loadPlannerState();
renderPlanner();
updateElevenLabsStatus();
updateTimerDisplay();
updateTimerButtons();

if (timerInput) {
  timerInput.addEventListener("input", () => {
    const parsed = parseTimerDuration(timerInput.value);
    if (!parsed || timerState.isRunning) return;
    timerState.totalMs = parsed.totalMs;
    timerState.remainingMs = parsed.totalMs;
    updateTimerDisplay();
    updateTimerButtons();
    saveTimerState();
  });

  timerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const parsed = setTimerFromInput(timerInput.value);
      if (parsed) {
        const reply = parsed.text;
        appendMessage({ role: "assistant", text: reply, messageTagType: "Timer" });
        speakText(reply, "en-US");
      }
    }
  });
}

if (timerStartBtn) {
  timerStartBtn.addEventListener("click", () => {
    const timerReply = setTimerFromInput(timerInput ? timerInput.value.trim() : "");
    if (timerReply && !timerState.isRunning) {
      appendMessage({ role: "assistant", text: timerReply.text, messageTagType: "Timer" });
      speakText(timerReply.text, "en-US");
    }
    startTimerFromWidget();
  });
}

if (timerPauseBtn) {
  timerPauseBtn.addEventListener("click", () => {
    pauseTimerFromWidget();
  });
}

if (timerResetBtn) {
  timerResetBtn.addEventListener("click", () => {
    resetTimerFromWidget();
  });
}

// SECTION: Event Handlers
if (chatForm && userInput && chatWindow) {
  userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = userInput.value.trim();
    if (!text) {
      const emptyReply = "Your message box is empty. Try typing a question, or press the sample question button to get a random example to start from.";
      appendMessage({ role: "assistant", text: emptyReply, messageTagType: "Input helper" });
      speakText(emptyReply, "en-US");
      return;
    }

    appendMessage({ role: "user", text, messageTagType: "You" });
    saveThread(text);
    userInput.value = "";

    const typingNode = showTypingIndicator();

    // Simulate network / thinking delay
    setTimeout(() => {
      typingNode.querySelector(".message-avatar")?.classList.remove("is-speaking");
      typingNode.remove();
      const res = generateMockReply(text);
      const replyText = res.text || "";
      const tag = res.tag || res.handler || "Multi-domain helper";
      const lang = res.lang || "en-US";
      const confidence = typeof res.confidence === "number" ? res.confidence : 1;

      // Low-confidence clarification flow
      if (confidence < 0.5 && res.handler && !["planner", "fallback", "coding", "translate", "greeting"].includes(res.handler)) {
        const suggestion = `I think you might be asking about ${res.handler}.`;
        const clarification = `${suggestion} Can you clarify or give more detail so I can help better?`;
        appendMessage({ role: "assistant", text: clarification, messageTagType: "Clarification" });
        speakText(clarification, lang);
      } else {
        appendMessage({ role: "assistant", text: replyText, messageTagType: tag });
        speakText(replyText, lang || "en-US");
      }
    }, 700);
  });
}

// Prefill sample question
if (sampleQuestionBtn && exampleList && userInput) {
  sampleQuestionBtn.addEventListener("click", () => {
    const examples = Array.from(exampleList.querySelectorAll("button[data-example]"));
    if (examples.length === 0) return;
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    const exampleText = randomExample.getAttribute("data-example") || "Tell me a good coding question.";
    userInput.value = exampleText;
    userInput.focus();
  });
}

// New chat button - clears chat and restores initial assistant intro
if (newChatBtn && chatWindow) {
  newChatBtn.addEventListener("click", () => {
    const initial = chatWindow.querySelector("[data-initial-message='true']");
    chatWindow.innerHTML = "";
    if (initial) {
      chatWindow.appendChild(initial.cloneNode(true));
    }
    chatWindow.scrollTop = 0;
    lastHandlerName = null;
  });
}

if (clearPlannerBtn) {
  clearPlannerBtn.addEventListener("click", () => {
    clearPlanner();
  });
}

// Speech recognition setup (Web Speech API)
let isRecording = false;
let recognition = null;

if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((r) => r[0].transcript)
      .join(" ")
      .trim();

    if (!transcript) return;

    const current = userInput.value.trim();
    userInput.value = current ? `${current} ${transcript}` : transcript;
    userInput.focus();

    // Optional: auto-submit when speech finishes and we have text
    if (chatForm) {
      chatForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });

  recognition.addEventListener("error", () => {
    isRecording = false;
    if (micBtn) micBtn.classList.remove("is-recording");
  });

  recognition.addEventListener("end", () => {
    isRecording = false;
    if (micBtn) micBtn.classList.remove("is-recording");
  });
}

// Mic button – start/stop speech recognition when available
if (micBtn && userInput) {
  micBtn.addEventListener("click", () => {
    userInput.focus();

    if (!recognition) {
      showToast("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      return;
    }

    try {
      isRecording = true;
      micBtn.classList.add("is-recording");
      recognition.start();
    } catch (e) {
      isRecording = false;
      micBtn.classList.remove("is-recording");
      console.error("Speech recognition start failed", e);
    }
  });
}

function insertPrefix(prefix) {
  if (!userInput) return;
  const current = userInput.value.trim();
  userInput.value = current ? `${prefix}: ${current}` : `${prefix}: `;
  userInput.focus();
}

if (quickHtmlBtn) {
  quickHtmlBtn.addEventListener("click", () => insertPrefix("HTML"));
}

if (quickCssBtn) {
  quickCssBtn.addEventListener("click", () => insertPrefix("CSS"));
}

if (quickJsBtn) {
  quickJsBtn.addEventListener("click", () => insertPrefix("JS"));
}

if (quickHealthBtn) {
  quickHealthBtn.addEventListener("click", () => insertPrefix("Health"));
}

if (quickDietBtn) {
  quickDietBtn.addEventListener("click", () => insertPrefix("Diet"));
}

if (quickFinanceBtn) {
  quickFinanceBtn.addEventListener("click", () => insertPrefix("Finance"));
}

if (quickIdeasBtn) {
  quickIdeasBtn.addEventListener("click", () => insertPrefix("Ideas"));
}

if (quickTriviaBtn) {
  quickTriviaBtn.addEventListener("click", () => insertPrefix("Trivia"));
}

// Voice toggle
if (voiceToggle) {
  voiceToggle.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    isVoiceEnabled = target.checked;
    localStorage.setItem(VOICE_ENABLED_KEY, String(isVoiceEnabled));
    if (!isVoiceEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  });
}

if (elevenLabsStatus) {
  elevenLabsStatus.addEventListener("click", () => {
    const key = prompt("Enter your ElevenLabs API key", elevenLabsApiKey || "");
    if (key === null) return;
    elevenLabsApiKey = key.trim();
    localStorage.setItem(ELEVENLABS_KEY, elevenLabsApiKey);
    updateElevenLabsStatus();
  });
}

if (voiceToggle) {
  voiceToggle.checked = isVoiceEnabled;
}

// Example question chips
if (exampleList && userInput) {
  exampleList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button[data-example]");
    if (!button) return;

    const example = button.getAttribute("data-example");
    if (!example) return;

    userInput.value = example;
    userInput.focus();
  });
}

const clearThreadsButton = document.getElementById("clear-threads");
const threadList = document.getElementById("thread-list");
function renderSavedThreads() {
  if (!threadList) return;
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(THREADS_KEY) || "[]"); } catch { saved = []; }
  if (!saved.length) return;
  threadList.innerHTML = "";
  saved.slice(0, 3).forEach((thread, index) => {
    const item = document.createElement("button");
    item.className = `thread-item${index === 0 ? " is-selected" : ""}`;
    item.type = "button";
    item.innerHTML = '<span class="thread-mark coral">✦</span><span><strong></strong><small>Saved conversation</small></span><span class="thread-arrow">›</span>';
    item.querySelector("strong").textContent = thread.title || "Saved conversation";
    threadList.appendChild(item);
  });
}
renderSavedThreads();
if (clearThreadsButton && threadList) {
  clearThreadsButton.addEventListener("click", () => {
    localStorage.removeItem(THREADS_KEY);
    threadList.innerHTML = '<p class="empty-threads">No saved threads yet.</p>';
  });
}

document.querySelectorAll(".starter[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.example || "";
    userInput.focus();
  });
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    switchView(item.dataset.view || "workspace");
  });
});

function switchView(view) {
  const contentGrid = document.querySelector(".content-grid");
  const libraryView = document.getElementById("library-view");
  const toolsView = document.getElementById("tools-view");
  const plannerView = document.getElementById("planner-view");
  const currentViewLabel = document.getElementById("current-view-label");
  const labels = { workspace: "Workspace", planner: "Planner", library: "Library", tools: "Tools" };
  document.querySelectorAll(".nav-item").forEach((navItem) => navItem.classList.toggle("is-active", navItem.dataset.view === view));
  if (contentGrid) contentGrid.hidden = view === "library" || view === "tools" || view === "planner";
  if (libraryView) libraryView.hidden = view !== "library";
  if (toolsView) toolsView.hidden = view !== "tools";
  if (plannerView) plannerView.hidden = view !== "planner";
  if (currentViewLabel) currentViewLabel.textContent = labels[view] || "Workspace";
  if (view === "planner") renderPlannerView();
  if (view === "workspace" || view === "planner") window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPlannerView() {
  const list = document.getElementById("planner-view-list");
  if (!list) return;
  list.innerHTML = "";
  [...notes.slice(-4), ...reminders.slice(-4)].forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry.text || "Planner item";
    list.appendChild(item);
  });
  if (!list.children.length) {
    const empty = document.createElement("li");
    empty.textContent = "No notes or reminders yet.";
    list.appendChild(empty);
  }
}

document.querySelectorAll("[data-view]").forEach((button) => {
  if (!button.classList.contains("nav-item")) button.addEventListener("click", () => switchView(button.dataset.view));
});

document.getElementById("greeting-label").textContent = `Good morning, Austin`;
const dateLabel = document.querySelector(".intro-block .eyebrow");
if (dateLabel) dateLabel.textContent = getDateLabel();

document.getElementById("notifications-button")?.addEventListener("click", () => showToast("You are all caught up."));
document.getElementById("profile-button")?.addEventListener("click", () => showToast("Personal space: Austin"));
document.querySelector(".icon-button[aria-label='Settings']")?.addEventListener("click", () => showToast("Settings are coming to this prototype.") );

const focusTasks = document.querySelectorAll("#focus-tasks input");
const focusProgressBar = document.querySelector("#progress-bar");
const focusProgressCount = document.querySelector("#progress-count");
const focusTasksKey = "moesha-redesign-focus-tasks-v2";

function updateFocusProgress() {
  const completed = [...focusTasks].filter((task) => task.checked).length;
  focusProgressCount.textContent = `${completed} / ${focusTasks.length}`;
  focusProgressBar.style.width = `${(completed / focusTasks.length) * 100}%`;
  try {
    localStorage.setItem(focusTasksKey, JSON.stringify([...focusTasks].map((task) => task.checked)));
  } catch {
    // Keep the progress in memory when storage is unavailable.
  }
}

try {
  const savedFocusTasks = JSON.parse(localStorage.getItem(focusTasksKey) || "[]");
  focusTasks.forEach((task, index) => { task.checked = savedFocusTasks[index] === true; });
} catch {
  // Keep the default unchecked state when storage is unavailable.
}

focusTasks.forEach((task) => task.addEventListener("change", updateFocusProgress));
updateFocusProgress();
