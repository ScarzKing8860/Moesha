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
const quickFinanceBtn = document.getElementById("quick-finance");
const quickIdeasBtn = document.getElementById("quick-ideas");
const micBtn = document.getElementById("mic-btn");
const exampleList = document.getElementById("example-list");
const plannerList = document.getElementById("planner-list");
const clearPlannerBtn = document.getElementById("clear-planner-btn");
const assistantAvatarSrc = "img/Moesha.png";
const STORAGE_KEY = "moesha-planner";
const ELEVENLABS_KEY = "moesha-elevenlabs-key";
const ELEVENLABS_VOICE_ID = "moesha-elevenlabs-voice";
const VOICE_ENABLED_KEY = "moesha-voice-enabled";
const notes = [];
const reminders = [];
let elevenLabsApiKey = localStorage.getItem(ELEVENLABS_KEY) || "";
let elevenLabsVoiceId = localStorage.getItem(ELEVENLABS_VOICE_ID) || "";
let isVoiceEnabled = localStorage.getItem(VOICE_ENABLED_KEY) === "true";
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

function createAssistantAvatar() {
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";

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

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find((voice) =>
    voice.lang.startsWith("en") && /female|samantha|victoria|zira|ava|jenny|susan|en-us|premium/i.test(voice.name)
  ) || voices.find((voice) => voice.lang.startsWith("en") && voice.localService);

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

function setTimerFromRequest(userText) {
  const lower = userText.toLowerCase();
  const minuteMatch = lower.match(/(\d+)\s*(minute|minutes|min|m)\b/);
  const hourMatch = lower.match(/(\d+)\s*(hour|hours|hr|h)\b/);
  const secondMatch = lower.match(/(\d+)\s*(second|seconds|sec|s)\b/);

  if (minuteMatch || hourMatch || secondMatch) {
    let totalMs = 0;
    if (hourMatch) totalMs += Number(hourMatch[1]) * 3600 * 1000;
    if (minuteMatch) totalMs += Number(minuteMatch[1]) * 60 * 1000;
    if (secondMatch) totalMs += Number(secondMatch[1]) * 1000;

    if (totalMs > 0) {
      const durationText = `${hourMatch ? hourMatch[1] + "h " : ""}${minuteMatch ? minuteMatch[1] + "m " : ""}${secondMatch ? secondMatch[1] + "s" : ""}`.trim();
      const timerLabel = durationText || "timer";
      reminders.push({ text: `Timer: ${timerLabel}`, createdAt: new Date() });
      renderPlanner();

      setTimeout(() => {
        showBrowserNotification("Moesha timer", `Your ${timerLabel} timer is done.`);
      }, totalMs);

      return {
        text: `Timer set for ${timerLabel}. I’ll notify you when it’s done.`,
        tag: "Timer",
        lang: "en-US",
      };
    }
  }

  return null;
}

// -----------------------------
// Handler registry & dispatch
// -----------------------------
const handlers = [];

function registerHandler(name, { keywords = [], fn, priority = 0 } = {}) {
  handlers.push({ name, keywords, fn, priority });
}

function scoreHandler(handler, text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const k of handler.keywords) {
    if (!k) continue;
    if (typeof k === "string") {
      const kw = k.toLowerCase();
      // exact word boundary match gets a higher boost
      const wordRe = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "\\b");
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
  const maxKeywords = Math.max(1, best.handler.keywords.length);
  const confidence = Math.min(1, best.score / maxKeywords);
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
registerHandler("health", { keywords: ["health", "diet", "exercise", "workout", "sleep", "salud", "ejercicio"], fn: (text) => {
  return { text: "General wellness tips: consistent sleep, balanced meals, movement, and stress management. For personalized advice, consult a professional.", tag: "Health helper", lang: /\b(es|spanish|esp)\b/i.test(text.toLowerCase()) ? "es-ES" : "en-US" };
} });
registerHandler("finance", { keywords: ["finance", "budget", "money", "saving", "debt", "dinero", "ahorro", "ahorrar", "presupuesto"], fn: (text) => ({ text: "Track income/expenses for a month, set a simple budget, and prioritize essentials.", tag: "Finance helper", lang: /\b(dinero|ahorro|presupuesto|guardar)\b/i.test(text.toLowerCase()) ? "es-ES" : "en-US" }) });
registerHandler("ideas", { keywords: ["idea", "brainstorm", "project"], fn: (text) => ({ text: "Write ideas quickly without judging, group similar ones, pick 1–2, and break into tiny next steps.", tag: "Ideas helper", lang: "en-US" }) });
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
    tag.textContent = messageTagType || "Code · Health · History · Weather · Ideas · Writing · Finance · Trading";
    meta.appendChild(tag);
  }

  const body = document.createElement("p");
  body.className = "message-text";
  body.textContent = text;

  bubble.appendChild(meta);
  bubble.appendChild(body);

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

// Generates a simple mock response and topic tag based on registered handlers
function generateMockReply(userText) {
  const res = dispatchToHandlers(userText);
  return {
    text: res.text || res.reply || "",
    tag: res.tag || res.handler || "Multi-domain helper",
    lang: res.lang || "en-US",
    confidence: typeof res.confidence === "number" ? res.confidence : res.confidence ? res.confidence : 1,
    handler: res.handler || null,
  };
}



loadPlannerState();
renderPlanner();
updateElevenLabsStatus();

// SECTION: Event Handlers
if (chatForm && userInput && chatWindow) {
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
      if (confidence < 0.5 && res.handler && res.handler !== "planner" && res.handler !== "fallback") {
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
      // Browser does not support speech recognition
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

if (quickFinanceBtn) {
  quickFinanceBtn.addEventListener("click", () => insertPrefix("Finance"));
}

if (quickIdeasBtn) {
  quickIdeasBtn.addEventListener("click", () => insertPrefix("Ideas"));
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
