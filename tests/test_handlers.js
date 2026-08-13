// Quick unit-like test for handler dispatch (isolated)
const handlers = [];
function registerHandler(name, { keywords = [], fn, priority = 0 } = {}) {
  handlers.push({ name, keywords, fn, priority });
}
function scoreHandler(handler, text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const k of handler.keywords) {
    if (!k) continue;
    if (typeof k === 'string') {
      const kw = k.toLowerCase();
      const esc = kw.replace(/([.*+?^${}()|[\\]\\])/g, "\\$1");
      if (/^\w+$/.test(kw)) {
        const wordRe = new RegExp('\\b' + esc + '\\b');
        if (wordRe.test(lower)) {
          score += 2;
        } else if (lower.includes(kw)) {
          score += 1;
        }
      } else {
        // For keywords with special characters (like c++), fall back to substring match
        if (lower.includes(kw)) score += 2;
      }
    } else if (k instanceof RegExp) {
      if (k.test(lower)) score += 2;
    }
  }
  return score + (handler.priority || 0) * 0.01;
}
function dispatchToHandlers(text) {
  const trimmed = (text || '').toLowerCase().trim();

  // translate command priority
  if (/^(translate|traduce)\b/i.test(trimmed)) {
    const trans = handlers.find(h => h.name === 'translate');
    if (trans) return { ...trans.fn(text), handler: 'translate', confidence: 1 };
  }
  // exact greeting
  const exactGreetingRe = /^(hi|hello|hola|hey|buenos d[ií]as|buenas|buenas tardes|buenas noches)\b[!,.]?$/i;
  if (exactGreetingRe.test(trimmed)) {
    const greet = handlers.find(h => h.name === 'greeting');
    if (greet) return { ...greet.fn(text), handler: 'greeting', confidence: 1 };
  }

  // planner stub
  const plannerHandler = handlers.find(h => h.name === 'planner');
  if (plannerHandler) {
    const plannerRes = plannerHandler.fn(text);
    if (plannerRes) return { ...plannerRes, handler: 'planner', confidence: 1 };
  }

  const scored = handlers.filter(h => h.name !== 'planner' && h.name !== 'greeting').map(h => ({ handler: h, score: scoreHandler(h, text) })).sort((a,b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score <= 0) {
    const fallback = handlers.find(h => h.name === 'fallback');
    if (fallback) return { ...fallback.fn(text), handler: 'fallback', confidence: 0.25 };
    return { text: "I don't understand that yet.", tag: 'Fallback', lang: 'en-US', confidence: 0.2 };
  }
  const result = best.handler.fn(text) || { text: 'No reply', tag: 'Unknown', lang: 'en-US' };
  const maxKeywords = Math.max(1, best.handler.keywords.length);
  const confidence = Math.min(1, best.score / maxKeywords);
  return { ...result, handler: best.handler.name, confidence };
}

// Register handlers like the app
registerHandler('planner', { keywords: ['note','remind','timer','alarm','reminder','schedule','appointment'], fn: (t)=>null, priority:2 });
registerHandler('greeting', { keywords: ['hi','hello','hola','hey','buenos días','buenas'], fn: (t)=> ({ text: /\b(hola|buenas|buenos)/i.test(t) ? 'Hola' : 'Hi', tag: 'Welcome', lang: /\b(hola|buenas|buenos)/i.test(t) ? 'es-ES' : 'en-US' }), priority: 3 });
registerHandler('coding', { keywords: ['html','css','flex','grid','javascript','js','python','c++','java','responsive'], fn: (t)=> ({ text: 'coding', tag:'Coding' }) });
registerHandler('translate', { keywords: [/^translate\b/i, /^traduce\b/i, 'translate', 'traduce'], fn: (t) => {
  if (/^traduce\b/i.test(t)) return { text: 'traduce', tag: 'Translation', lang: 'es-ES' };
  if (/^translate\b/i.test(t)) return { text: 'translate', tag: 'Translation', lang: 'en-US' };
  return null;
} });
registerHandler('fallback', { keywords: [], fn: (t)=> ({ text: 'fallback', tag:'Fallback' }) });

const tests = [
  'hi',
  'hello',
  'hola',
  'hey Moesha',
  'hello, can you help me with css?',
  'good morning',
  'buenas',
  'buenos días',
  'buenas tardes',
  'buenas noches',
  '¿puedes ayudarme con css?',
  'traduce Hola, ¿cómo estás?',
  'traduce ¿Puedes reescribir este párrafo?'
];

for (const t of tests) {
  const r = dispatchToHandlers(t);
  console.log(JSON.stringify({ input: t, handler: r.handler, confidence: r.confidence, tag: r.tag, text: r.text }));
}
