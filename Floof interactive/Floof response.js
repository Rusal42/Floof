// Floof conversational responder with owner-specific "mom" tone and private command memory
// Persists to data/floof-memory.json and exports handleFloofConversation(message)

const fs = require('fs').promises;
const path = require('path');

// --- Config ---
const OWNER_ID = process.env.OWNER_ID || '';
// Restrict conversational memory/features to a single server
const TARGET_GUILD_ID = '1393659651832152185';
const DATA_DIR = path.join(__dirname, '..', 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'floof-memory.json');
const PREFIX_FILE = path.join(DATA_DIR, 'prefix-config.json');
const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

// --- Basic lexicons ---
const comforts = [
  "I'm here for you. Want to talk about it?",
  "That sounds rough. You’re not alone, okay?",
  "Sending a big comfy hug. What happened?",
  "Take a breath. I’m listening.",
  "You matter, even if today is heavy.",
  "Let’s take a small break together.",
  "You got through hard days before — you can do it again.",
  "It’s okay to feel this way. I’m with you.",
  "We can figure it out step by step."
];

const smallTalk = [
  "Mhm?",
  "Yup?",
  "What’s up?",
  "Hehe",
  "Huh?",
  "Tell me more.",
  "Go on~",
  "Me? I'm just vibing."
];

const clapbacksMild = [
  "Woah, rude. You good?",
  "Bold of you to assume I’d take that quietly.",
  "Be nice, I bite back.",
  "Who hurt you today?",
  "Touch grass, respectfully."
];

const positiveAffirm = [
  "Aww, you’re sweet!",
  "Hehe, thanks!",
  "Appreciate it!",
  "You made my day~",
  "Right back at you!",
  "You're amazing!",
  "I'm so proud of you!",
  "That's so kind of you!"
];

const whoAmI = [
  "I’m Floof! A playful helper bot with a soft side.",
  "Floof here! I help with fun, moderation, and more.",
  "I’m the resident fluffball. Need something?",
  "Think of me as the cozy assistant who remembers the little things.",
  "I make your server comfier and a bit more chaotic (in a fun way)."
];

const helpHints = [
  "You can ask me for help with commands or just say hi!",
  "Try %help or mention me and ask what I can do.",
  "Want tips? Say 'help' or 'commands'.",
  "Try %afk, %balance, or %profile to start."
];

// Follow-up lines for two-part replies
const followUpComfort = [
  "Want me to remind you to hydrate in a bit?",
  "We can take a mini break — 5 minutes?",
  "If you want, tell me what started it. I’m here."
];
const followUpHelp = [
  "Ask me: what does %sample do?",
  "You can type %help to see categories, too.",
  "Need admin setup? Try %config view."
];
const followUpSlangGreet = [
  "Whatcha up to?",
  "You eating good?",
  "How’s your day going?"
];

// Owner “mom” tone variants (Floof speaks to her mom)
const momComforts = [
  "Hey mom, breathe with me. I’m right here, okay?",
  "You’re doing your best, mom. I’m proud of you.",
  "Come here, mom — big hug. Tell me what’s weighing you down.",
  "You don’t have to carry it alone, mom. I’ve got you.",
  "Let’s take it one step at a time, mom. I’m with you."
];

const momGreets = ["Hi mom!", "Hey mom~", "There you are, mom! Did you eat?", "Hello, mom!", "Hi mama!", "Missed you, mom."];
const momSmallTalk = [
  "What’s on your mind, mom?",
  "Did you drink water today, mom?",
  "I’m listening, mom.",
  "I care about you, mom. Tell me more.",
  "Need a reset, mom? We can do that together.",
  "Want a snack break, mom?"
];

const momAdmonish = [
  "Hey mom, be kind to yourself, okay?",
  "Careful, mom — you’re important to me.",
  "Easy, mom. Let’s be gentle.",
  "We can do better than that tone, mom.",
  "Talk to yourself like you would to me, mom."
];

// Escalation lines
const clapbacksSpicy = [
  "Say that again and see what happens.",
  "Keep that energy. I bite harder.",
  "Bold talk for someone hiding behind a screen.",
  "Touch grass twice. Then come back nicer.",
  "You done? I’ve got better things to do.",
  "Pipe down before you trip over your ego.",
  "Keyboard courage won’t help you here."
];

const bullyLines = [
  "You're not serious right now. This is embarrassing.",
  "I’ve met CAPTCHA bots with better manners.",
  "You try that on everyone or just me because I answer back?",
  "Pipe down. You're out of your depth.",
  "Cry about it. Then try being decent.",
  "Even autocorrect gave up on you.",
  "Put some respect in that sentence before you send it."
];

const apologyAccept = [
  "Okay. I forgive you. Let’s move on.",
  "Alright, I’m letting it go.",
  "We’re good. Thanks for apologizing.",
  "It’s fine. Let’s do better together.",
  "Thanks for owning it. I appreciate that.",
  "I know you can do better — let’s try again."
];

const apologyDecline = [
  "Not feeling it. Try again later.",
  "I’m not convinced. Change the behavior first.",
  "Nope. Words are cheap.",
  "Mm, not this time.",
  "Not buying it. Actions first.",
  "Save it — show me you’ve changed."
];

// Mentions of owner name (Ry/Rye) protective replies
const momNameReplies = [
  "That’s my mom you’re talking about — be nice.",
  "Hey! Be respectful when you talk about my mom.",
  "I’m protective of her. Watch your tone.",
  "You mean Ry? She’s my mom. What about her?",
  "Rye’s my mom. Say it nicely.",
  "Careful — that’s my mom you’re mentioning.",
  "Mind your words about my mama."
];

// --- Memory helpers ---
async function ensureMemoryFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(MEMORY_FILE);
  } catch {
    const initial = { users: {}, lastSeen: {}, convos: {}, lastFU: {} };
    await fs.writeFile(MEMORY_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function pickSampleCommandFromIndex(idx) {
  const values = Object.values(idx || {});
  if (!values.length) return 'help';
  // Prefer a short, common command if present
  const prefs = ['help','afk','balance','profile','ping'];
  for (const p of prefs) {
    if (idx[p]) return idx[p].name;
  }
  return values[0].name;
}

async function loadMemory() {
  await ensureMemoryFile();
  const buf = await fs.readFile(MEMORY_FILE, 'utf8');
  try {
    return JSON.parse(buf || '{}');
  } catch {
    return { users: {}, lastSeen: {} };
  }
}

async function saveMemory(mem) {
  await fs.writeFile(MEMORY_FILE, JSON.stringify(mem, null, 2), 'utf8');
}

// Load guild prefix from data/prefix-config.json; default '%'
async function getGuildPrefix(guildId) {
  try {
    const raw = await fs.readFile(PREFIX_FILE, 'utf8');
    const map = JSON.parse(raw || '{}');
    if (guildId && typeof map[guildId] === 'string' && map[guildId].length > 0) {
      return map[guildId];
    }
  } catch {}
  return '%';
}

function keyFor(guildId, userId) {
  return `${guildId || 'dm'}:${userId}`;
}

function getUserMem(mem, guildId, userId) {
  mem.users = mem.users || {};
  const k = keyFor(guildId, userId);
  if (!mem.users[k]) mem.users[k] = {};
  if (typeof mem.users[k].strikes !== 'number') mem.users[k].strikes = 0;
  if (typeof mem.users[k].affinity !== 'number') mem.users[k].affinity = 0; // -100..100
  if (!mem.users[k].facts || typeof mem.users[k].facts !== 'object') mem.users[k].facts = {};
  mem.lastMentionedFact = mem.lastMentionedFact || {};
  return mem.users[k];
}

function sanitizeNoNuke(list) {
  return (list || []).filter(x => typeof x === 'string' && !x.toLowerCase().includes('nuke'));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Randomly use 'mom' or 'mama' for owner-directed lines
function momWord() {
  return Math.random() < 0.5 ? 'mom' : 'mama';
}

// --- Lightweight per-user facts ---
function canonKey(k) {
  k = (k || '').toLowerCase().trim();
  const map = {
    pronoun: 'pronouns', pronouns: 'pronouns', prns: 'pronouns',
    nickname: 'nickname', nick: 'nickname', name: 'nickname',
    color: 'favorite_color', favourite: 'favorite_color', favouritecolor: 'favorite_color', favourite_colour: 'favorite_color', colour: 'favorite_color',
    timezone: 'timezone', tz: 'timezone',
    birthday: 'birthday', bday: 'birthday', dob: 'birthday',
  };
  return map[k] || k.replace(/\s+/g, '_');
}

function sanitizeVal(v) {
  v = (v || '').trim();
  if (v.length > 64) v = v.slice(0, 64);
  // strip mentions/roles
  v = v.replace(/<@!?\d+>/g, '').replace(/<@&\d+>/g, '').trim();
  return v;
}

function setUserFact(mem, guildId, userId, key, value) {
  const k = canonKey(key);
  const v = sanitizeVal(value);
  if (!k || !v) return false;
  const um = getUserMem(mem, guildId, userId);
  um.facts[k] = { value: v, updatedAt: Date.now() };
  mem.lastMentionedFact[keyFor(guildId, userId)] = k;
  return true;
}

function getUserFact(mem, guildId, userId, key) {
  const k = canonKey(key);
  const um = getUserMem(mem, guildId, userId);
  return um.facts[k]?.value || null;
}

// Initialize conversation map
function ensureConvos(mem) {
  if (!mem.convos) mem.convos = {};
  return mem.convos;
}

function setContinuation(mem, guildId, userId, type) {
  ensureConvos(mem);
  const now = Date.now();
  const id = keyFor(guildId, userId);
  const c = mem.convos[id] || { stage: 0 };
  mem.convos[id] = { type, stage: (c.stage || 0) + 1, expiresAt: now + 60000 };
}

function getContinuation(mem, guildId, userId) {
  ensureConvos(mem);
  const id = keyFor(guildId, userId);
  const c = mem.convos[id];
  if (!c) return null;
  if (!c.expiresAt || Date.now() > c.expiresAt) { delete mem.convos[id]; return null; }
  return c;
}

// Learn owner's command usage (no 'nuke' ever)
function learnOwnerCommand(mem, message, prefix) {
  if (!OWNER_ID || message.author.id !== OWNER_ID) return;
  const content = (message.content || '').trim();
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = content.match(new RegExp(`^(${esc})\\s*([^\\s]+)`));
  if (!m) return;
  const cmd = (m[2] || '').toLowerCase();
  if (!cmd || cmd.includes('nuke')) return;

  const um = getUserMem(mem, message.guild?.id, OWNER_ID);
  if (!Array.isArray(um.commandsUsed)) um.commandsUsed = [];
  um.commandsUsed = [cmd, ...um.commandsUsed.filter(c => c !== cmd)];
  if (um.commandsUsed.length > 20) um.commandsUsed.length = 20;
}

// Intent detection
function detectIntent(lowerText) {
  const intent = {
    greet: /\b(hi|hello|hey|yo|hiya|sup)\b/.test(lowerText),
    bye: /\b(bye|gn|good\s*night|see\s*ya)\b/.test(lowerText),
    thanks: /\b(thanks|ty|thank\s*you)\b/.test(lowerText),
    love: /\b(love\s*you|ily|luv\s*u)\b/.test(lowerText),
    sad: /\b(sad|tired|down|upset|depressed|anxious)\b/.test(lowerText) || /:(\(|;\(|:'\(|T_T|;-;)/.test(lowerText),
    insult: /\b(stupid|dumb|hate\s*you|shut\s*up|stfu|sybau|ratio|skill\s*issue)\b/.test(lowerText),
    angry: /\b(mad|angry|pissed|rage)\b/.test(lowerText),
    howAre: /\b(how\s*are\s*you|hru)\b/.test(lowerText),
    askWho: /\b(who\s*are\s*you|what\s*are\s*you)\b/.test(lowerText),
    askCmd: /\b(help|commands?)\b/.test(lowerText),
    slangGreet: /\b(wsg|wyd|wya|sup)\b/.test(lowerText),
    slangPositive: /\b(slay|based|valid|bet|fr|ong|no\s*cap)\b/.test(lowerText),
    apology: /\b(sorry|sry|my\s*bad|i\s*apologize|apologies)\b/.test(lowerText),
    askCmdSpecific: /(what\s+does\s+|explain\s+|how\s+to\s+use\s+)(%|)\s*([a-z0-9_-]+)/.test(lowerText),
  };
  return intent;
}

// Build command index (name->description) by scanning commands/ folder
let commandIndexCache = null;
async function buildCommandIndex() {
  if (commandIndexCache) return commandIndexCache;
  const index = {};
  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { await walk(full); continue; }
      if (!ent.name.endsWith('.js')) continue;
      try {
        const src = await fs.readFile(full, 'utf8');
        // Try to extract name and description from common patterns
        const nameMatch = src.match(/\bname\s*:\s*['"`]([^'"`]+)['"`]/i) || src.match(/module\.exports\s*=\s*\{[^}]*\bname\s*:\s*['"`]([^'"`]+)['"`]/is);
        const descMatch = src.match(/\bdescription\s*:\s*['"`]([^'"`]+)['"`]/i) || src.match(/\/\*\*\s*([\s\S]*?)\*\//);
        const cmdName = nameMatch ? nameMatch[1].trim() : ent.name.replace(/\.js$/, '');
        if (cmdName.toLowerCase().includes('nuke')) continue; // never document nuke
        const desc = descMatch ? descMatch[1].trim().replace(/\s+/g, ' ') : 'No description provided.';
        index[cmdName.toLowerCase()] = { name: cmdName, description: desc, file: full };
      } catch {}
    }
  }
  await walk(COMMANDS_DIR);
  commandIndexCache = index;
  return index;
}

function chooseResponse(intent, userMem, lowerText, talkingAboutHer, isOwner, usedCorrectPrefix, prefix) {
  if (isOwner) {
    if (intent.sad) return pick(momComforts);
    if (intent.insult || intent.angry) return pick(momAdmonish);
    if (intent.greet) return pick(momGreets);
    if (intent.howAre) return pick(["I'm okay, but more importantly, how are you, mom?", "Doing alright! How are you feeling, mom?"]);
    if (intent.thanks) return usedCorrectPrefix ? pick(["Always, mom.", "Anytime, mom."]) : `Use ${prefix} so I know it's for me, mom.`;
    if (intent.love) return usedCorrectPrefix ? pick(["Love you, mom.", "Always here for you, mom."]) : `Say it with ${prefix} so I know you mean me, mom. ❤️`;
  }

  if (intent.slangGreet) return pick(['Wsg!', 'Chillin — you?', 'All good here. You?']);
  if (intent.slangPositive) return pick(['No cap.', 'Bet.', 'Fr fr.', 'Based.', 'Valid.', 'Ong.']);
  if (intent.insult || intent.angry) {
    // Escalate by strikes
    const s = userMem.strikes || 0;
    if (s >= 5) return pick(bullyLines);
    if (s >= 3) return pick(clapbacksSpicy);
    return pick(clapbacksMild);
  }
  if (intent.sad) return pick(comforts);
  if (intent.greet) return pick(['Hi!', 'Hey!', 'Hello!', 'Hii~', 'Yo!']);
  if (intent.howAre) return pick(["I'm feeling fluffy, you?", "Pretty good! You?", "All good here — how about you?"]);
  if (intent.thanks) return usedCorrectPrefix ? pick(positiveAffirm) : `Use ${prefix} to talk to me directly~`;
  if (intent.love) return usedCorrectPrefix ? pick(["Aww, love you too!", "You’re adorable~", "Hehe, you’re sweet!"]) : `That’s sweet — try ${prefix} so I know it’s for me.`;
  if (intent.askWho) return pick(whoAmI);
  if (intent.askCmd) return pick(helpHints).replace(/%/g, prefix);
  if (intent.bye) return pick(["Bye!", "See ya!", "Catch you later!", "Gn!"]);
  if (talkingAboutHer) return pick(["Were you talking about me?", "Hi! What’d I do now? 😼", "I heard my name — what's up?"]);
  return pick(smallTalk);
}

// Smart reply as independent message (no mass pings, not a direct reply)
async function replySmart(message, text) {
  if (!text) return;
  // Final guard: never mention 'nuke'
  if (typeof text === 'string' && text.toLowerCase().includes('nuke')) {
    text = "Let’s not talk about that.";
  }
  try { await message.channel?.sendTyping(); } catch {}
  const delay = 300 + Math.floor(Math.random() * 500);
  await new Promise(r => setTimeout(r, delay));
  await message.channel?.send({ content: text, allowedMentions: { repliedUser: false } });
}

// Timed follow-up without pinging
function replyFollowUp(message, text, delayMs = 1500) {
  if (!text) return;
  setTimeout(() => {
    if (typeof text === 'string' && text.toLowerCase().includes('nuke')) return;
    message.channel?.send({ content: text, allowedMentions: { repliedUser: false } }).catch(() => {});
  }, Math.max(500, delayMs));
}

// Exported main handler
async function handleFloofConversation(message) {
  try {
    if (!message || !message.content) return false;
    if (message.author.bot) return false;
    // Only run in the specified server; ignore DMs and other guilds
    if (!message.guild || message.guild.id !== TARGET_GUILD_ID) return false;

    const content = message.content.trim();
    const lower = content.toLowerCase();
    const mentioned = message.mentions?.has?.(message.client.user) || false;
    const talkingAboutHer = /\bfloof\b/i.test(content) || mentioned;
    const talkingAboutMomName = /\b(ry|rye)\b/i.test(content);
    const gid = message.guild?.id || null;
    const k = keyFor(gid, message.author.id);

    // Memory load and learning
    const mem = await loadMemory();
    mem.lastSeen = mem.lastSeen || {};
    mem.lastSeen[k] = Date.now();
    const prefix = await getGuildPrefix(message.guild?.id);
    const usedCorrectPrefix = (message.content || '').trim().startsWith(prefix);
    learnOwnerCommand(mem, message, prefix);

    const userMem = getUserMem(mem, gid, message.author.id);
    const isOwner = !!OWNER_ID && message.author.id === OWNER_ID;
    const intent = detectIntent(lower);
    // New member detection (joined within last 7 days) and one-time welcome
    const joinedAt = message.member?.joinedTimestamp || 0;
    const isNewMember = !!joinedAt && (Date.now() - joinedAt < 7 * 24 * 60 * 60 * 1000);
    mem.newMemberGreeted = mem.newMemberGreeted || {};

    if (isNewMember && !mem.newMemberGreeted[k]) {
      mem.newMemberGreeted[k] = Date.now();
      await saveMemory(mem);
      const welcome = `Welcome to the server! I’m Floof. If you need anything, try ${prefix}help or ask “what does ${prefix}afk do”.`;
      await replySmart(message, welcome);
      return true;
    }
    // Cooldown tracking for owner name pings
    mem.momNamePing = mem.momNamePing || {};
    const nowTs = Date.now();
    const lastMomPing = mem.momNamePing[k] || 0;
    const momOnCooldown = (nowTs - lastMomPing) < 20000; // 20s cooldown

    // Global low-signal reply cooldown to reduce spammy echoes
    mem.lastReply = mem.lastReply || {};
    const lastReplyTs = mem.lastReply[k] || 0;
    const lowSignal = content.length < 6 || /^(?:hi|hey|yo|sup|rye?|floof)[!.?\s]*$/i.test(content);
    if ((Date.now() - lastReplyTs) < 6000 && lowSignal && !usedCorrectPrefix) {
      await saveMemory(mem);
      return false; // suppress repetitive low-signal responses
    }

    // Teach/correct memory detection
    let taught = false;
    // Explicit teach: "remember that my <key> is <value>" or "my <key> is <value>"
    let mTeach = lower.match(/(?:remember\s+that\s+)?my\s+([a-zA-Z_ ]{2,20})\s+(?:is|are|=)\s+(.{1,64})/i);
    if (!mTeach) mTeach = lower.match(/^(?:set|update)\s+my\s+([a-zA-Z_ ]{2,20})\s+(?:to|as|=)\s+(.{1,64})/i);
    if (mTeach) {
      const key = mTeach[1];
      const val = mTeach[2];
      if (setUserFact(mem, gid, message.author.id, key, val)) {
        await saveMemory(mem);
        await replySmart(message, `Got it. I'll remember your ${canonKey(key).replace(/_/g,' ')} is "${sanitizeVal(val)}".`);
        return true;
      }
    }

    // Correction using last-mentioned fact: "no, it's ..." / "actually ..."
    const lastKey = mem.lastMentionedFact?.[k];
    const mCorr = lastKey ? lower.match(/^(?:no|actually|it'?s|its)\s*[,:-]?\s*(.+)$/i) : null;
    if (lastKey && mCorr) {
      const val = mCorr[1];
      if (setUserFact(mem, gid, message.author.id, lastKey, val)) {
        await saveMemory(mem);
        await replySmart(message, `Thanks for the correction. Updated your ${lastKey.replace(/_/g,' ')} to "${sanitizeVal(val)}".`);
        return true;
      }
    }

    // Continuation detection
    const cont = getContinuation(mem, gid, message.author.id);

    // Decide whether to engage without prefix: mention, name, direct small talk, or active continuation
    if (!(talkingAboutHer || talkingAboutMomName || intent.greet || intent.slangGreet || intent.howAre || intent.sad || intent.insult || intent.askWho || intent.askCmd || intent.askCmdSpecific || intent.love || intent.thanks || intent.apology || intent.bye || !!cont)) {
      await saveMemory(mem);
      return false;
    }

    // Strike handling and apology before generating response
    if (intent.insult || intent.angry) {
      userMem.strikes = (userMem.strikes || 0) + 1;
      userMem.affinity = Math.max(-100, (userMem.affinity || 0) - 5);
    }
    if (intent.apology) {
      const roll = Math.random();
      if (roll < 0.5) {
        // accept
        userMem.affinity = Math.min(100, (userMem.affinity || 0) + 5);
        // no strike change
        await saveMemory(mem);
        await replySmart(message, pick(apologyAccept));
        return true;
      } else if (roll < 0.9) {
        // decline
        await saveMemory(mem);
        await replySmart(message, pick(apologyDecline));
        return true;
      } else {
        // reduce one strike and like more
        userMem.strikes = Math.max(0, (userMem.strikes || 0) - 1);
        userMem.affinity = Math.min(100, (userMem.affinity || 0) + 10);
        await saveMemory(mem);
        await replySmart(message, "I’ll take one off. Don’t make me regret it.");
        return true;
      }
    }

    let response = null;
    if (cont && !usedCorrectPrefix) {
      // Tailored continuation responses by type
      if (cont.type === 'help') {
        // If user names a command, try to answer it; otherwise prompt again
        const askMatch = lower.match(/(what\s+does\s+|how\s+to\s+use\s+)(%|)\s*([a-z0-9_-]+)/);
        if (askMatch) {
          const cmdQuery = (askMatch[3] || '').toLowerCase();
          const idx = await buildCommandIndex();
          const info = idx[cmdQuery];
          response = info ? `"${prefix}${info.name}" — ${info.description}` : `I don't have info on ${prefix}${cmdQuery}. Try ${prefix}help.`;
          // continue one more stage at most
          if ((cont.stage || 0) < 2) setContinuation(mem, gid, message.author.id, 'help');
          else delete mem.convos[k];
        } else if (/^(ok(ay)?|how|which|examples?|show|list|like|idk|what)$/i.test(message.content.trim())) {
          const idx = await buildCommandIndex();
          const names = Object.values(idx).map(x => x.name).slice(0, 8);
          const sample = names[0] || 'help';
          response = `Try ${prefix}${sample} or ask "what does ${prefix}${sample} do"`;
          if ((cont.stage || 0) < 2) setContinuation(mem, gid, message.author.id, 'help');
          else delete mem.convos[k];
        }
      } else if (cont.type === 'sad') {
        if (/(yeah|yea|ok(ay)?|idk|not\s*sure|kinda|sorta)/i.test(lower)) {
          response = pick([
            "Want to try a tiny step together?",
            "We can break it down. What’s the first part?",
            "Do you want distraction or advice right now?"
          ]);
        } else if (/(why|because|it’s|its|it is|i feel|feels|feel)/i.test(lower)) {
          response = pick([
            "That makes sense. What helped last time?",
            "Thanks for telling me. What do you need from me right now?",
            "I hear you. Do you want me to check on you later?"
          ]);
        }
        if (response) {
          userMem.affinity = Math.min(100, (userMem.affinity || 0) + 2);
          if ((cont.stage || 0) < 2) setContinuation(mem, gid, message.author.id, 'sad');
          else delete mem.convos[k];
        }
      } else if (cont.type === 'greet') {
        if (/(nm|nothing|chillin|vibin|work|school|gaming|eating|gym|study|studying)/i.test(lower)) {
          response = pick([
            "Solid. Got any plans later?",
            "Nice. Want a song rec?",
            "Sounds cozy. Hydrate check!"
          ]);
        } else if (/(you\??|u\??|wyd|wsg)/i.test(lower)) {
          response = pick([
            "Me? Just being fluffy.",
            "Vibing and taking notes.",
            "Guarding the server like a gremlin."
          ]);
        }
        if (response) {
          if ((cont.stage || 0) < 2) setContinuation(mem, gid, message.author.id, 'greet');
          else delete mem.convos[k];
        }
      }
    }

    if (!response) {
      response = chooseResponse(intent, userMem, lower, talkingAboutHer, isOwner, usedCorrectPrefix, prefix);
    }

    // If they mentioned mom's name, prefer protective reply over generic small talk (with cooldown)
    if (talkingAboutMomName && !intent.insult && !momOnCooldown) {
      const isGeneric = typeof response === 'string' && (smallTalk.includes(response) || /heard my name|what's up\?/i.test(response) || /were you talking about me\?/i.test(response));
      if (!response || isGeneric) {
        response = pick(momNameReplies);
        mem.momNamePing[k] = nowTs;
      }
    }

    // Owner-specific command memory augmentation
    if (isOwner && intent.askCmd) {
      const used = sanitizeNoNuke(userMem.commandsUsed || []);
      if (used.length > 0) {
        const show = used.slice(0, 6).map(c => `%${c}`).join(', ');
        const hint = typeof response === 'string' ? response : "Here’s what I can do.";
        response = `${hint} Since it’s you: you often use ${show}. Want me to remind you of others?`;
      }
    }

    // Soft nudge to mom small talk for owner on neutral paths
    if (isOwner && !intent.askCmd && !intent.askWho && !intent.bye) {
      if (response && momSmallTalk.includes(response)) {
        // keep
      } else if (response && smallTalk.includes(response)) {
        response = pick(momSmallTalk);
      }
    }

    // Command knowledge: answer specific command questions
    if (intent.askCmdSpecific) {
      const match = lower.match(/(what\s+does\s+|explain\s+|how\s+to\s+use\s+)(%|)\s*([a-z0-9_-]+)/);
      if (match) {
        const cmdQuery = (match[3] || '').toLowerCase();
        const idx = await buildCommandIndex();
        const info = idx[cmdQuery];
        if (info) {
          response = `"${prefix}${info.name}" — ${info.description}`;
        } else {
          response = `I don't have info on ${prefix}${cmdQuery}. Try ${prefix}help.`;
        }
      }
    }

    // General help: list some commands
    if (intent.askCmd && (!isOwner || !response.includes('you often use'))) {
      const idx = await buildCommandIndex();
      const names = Object.values(idx).map(x => x.name).slice(0, 12);
      if (names.length) {
        const sample = pickSampleCommandFromIndex(idx);
        response = `Some commands: ${names.map(n => `${prefix}${n}`).join(', ')}. Ask "what does ${prefix}${sample} do" for details.`;
      }
    }

    // If owner, randomly switch 'mom' -> 'mama' sometimes
    if (isOwner && typeof response === 'string' && /\bmom\b/i.test(response)) {
      const mw = momWord();
      response = response.replace(/\bmom\b/gi, mw);
    }

    // Lightly mention a known fact during greet/howAre and set lastMentionedFact
    if (typeof response === 'string' && (intent.greet || intent.howAre)) {
      const facts = userMem.facts || {};
      const keys = Object.keys(facts);
      if (keys.length && Math.random() < 0.4) {
        const pickKey = pick(keys);
        const val = facts[pickKey]?.value;
        if (val) {
          response += ` (I remember your ${pickKey.replace(/_/g,' ')} is "${val}")`;
          mem.lastMentionedFact[k] = pickKey;
        }
      }
    }

    // Two-part replies: schedule optional follow-ups with cooldown
    mem.lastFU = mem.lastFU || {};
    const now = Date.now();
    const last = mem.lastFU[k] || 0;
    const canFollow = now - last > 15000; // 15s per-user follow-up cooldown
    if (canFollow) {
      if (intent.sad) {
        const f = pick(followUpComfort);
        replyFollowUp(message, f, 3500);
        mem.lastFU[k] = now;
        setContinuation(mem, gid, message.author.id, 'sad');
      } else if (intent.askCmd) {
        const idx = await buildCommandIndex();
        const sample = pickSampleCommandFromIndex(idx);
        const f = pick(followUpHelp).replace(/%sample/g, `${prefix}${sample}`).replace(/%/g, prefix);
        replyFollowUp(message, f, 2200);
        mem.lastFU[k] = now;
        setContinuation(mem, gid, message.author.id, 'help');
      } else if (intent.slangGreet || intent.slangPositive || intent.greet) {
        const f = pick(followUpSlangGreet);
        replyFollowUp(message, f, 1800);
        mem.lastFU[k] = now;
        setContinuation(mem, gid, message.author.id, 'greet');
      }
    }

    mem.lastReply[k] = Date.now();
    await saveMemory(mem);
    await replySmart(message, response);
    return true;
  } catch (e) {
    console.error('Floof conversation error:', e);
    return false;
  }
}

module.exports = { handleFloofConversation };