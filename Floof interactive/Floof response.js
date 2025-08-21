// Ultra-Natural Floof conversational responder with advanced NLP, personality modeling, and dynamic mood system
// Persists to Floof interactive/floof-memory.json (migrates from legacy data/floof-memory.json) and exports handleFloofConversation(message)

const fs = require('fs').promises;
const path = require('path');

// --- Config ---
const OWNER_ID = process.env.OWNER_ID || '1007799027716329484';
const TARGET_GUILD_ID = '1393659651832152185';
// Store memory alongside this file: Floof interactive/floof-memory.json
const DATA_DIR = __dirname;
const MEMORY_FILE = path.join(DATA_DIR, 'floof-memory.json');
// Backward-compat: legacy memory location under ../data/
const LEGACY_DATA_DIR = path.join(__dirname, '..', 'data');
const LEGACY_MEMORY_FILE = path.join(LEGACY_DATA_DIR, 'floof-memory.json');
const PREFIX_FILE = path.join(DATA_DIR, 'prefix-config.json');
const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

// --- Advanced Context & Timing Config ---
const CONTEXT_HISTORY_LIMIT = 8;
const CONVERSATION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const SHORT_TERM_CONTEXT_LIMIT = 4;
const RESPONSE_DELAY_BASE = 800; // More human-like typing delay
const RESPONSE_DELAY_VARIATION = 1200;
const FOLLOW_UP_MIN_DELAY = 3000;
const FOLLOW_UP_MAX_DELAY = 8000;
const STOP_SILENCE_MS = 10 * 60 * 1000; // 10 minutes of silence after explicit stop
const ALT_FALLBACKS = [
  "Gotcha.",
  "Mhm.",
  "I hear you.",
  "Tell me more?",
  "Interesting..."
];

// --- ADVANCED MOOD SYSTEM ---
const MOODS = {
  // Positive moods
  euphoric: {
    intensity: 90,
    stability: 0.3,
    triggers: ['extreme_excitement', 'major_success', 'overwhelming_love'],
    responses: [
      "I'M LITERALLY BOUNCING OFF THE WALLS RIGHT NOW!", "THIS IS THE BEST DAY EVER AND I CAN'T EVEN!",
      "I FEEL LIKE I COULD CONQUER THE WORLD!", "EVERYTHING IS AMAZING AND SPARKLY!", 
      "MY HEART IS DOING ACTUAL SOMERSAULTS!"
    ],
    followUps: [
      "TELL ME EVERYTHING! I NEED ALL THE DETAILS!", "HOW ARE YOU NOT VIBRATING WITH EXCITEMENT?!",
      "WE NEED TO CELEBRATE! THIS IS HUGE!"
    ],
    decay: 0.15,
    transitions: { happy: 0.4, excited: 0.6 }
  },

  excited: {
    intensity: 75,
    stability: 0.5,
    triggers: ['good_news', 'anticipation', 'success'],
    responses: [
      "OH MY GOSH YES!", "This is so exciting!", "I'm literally getting goosebumps!",
      "My heart is racing just thinking about it!", "This energy is INFECTIOUS!",
      "I can't sit still right now!", "Tell me more, I'm on the edge of my seat!"
    ],
    followUps: [
      "What happens next?!", "How are you feeling about this?", "This is going to be amazing!",
      "I'm so here for this journey!"
    ],
    decay: 0.1,
    transitions: { happy: 0.3, euphoric: 0.2, content: 0.2 }
  },

  happy: {
    intensity: 60,
    stability: 0.7,
    triggers: ['positive_interaction', 'good_vibes', 'small_wins'],
    responses: [
      "This just made my day!", "You always know how to make me smile.", "I'm feeling so warm and fuzzy!",
      "Life is pretty good right now.", "You bring such good energy!", "This is exactly what I needed to hear.",
      "I love our conversations like this."
    ],
    followUps: [
      "What's been the best part of your day?", "You seem like you're in a good headspace.",
      "I love seeing you happy!", "What's bringing you joy lately?"
    ],
    decay: 0.05,
    transitions: { content: 0.4, excited: 0.2, grateful: 0.2 }
  },

  content: {
    intensity: 40,
    stability: 0.9,
    triggers: ['peaceful_moment', 'routine_comfort', 'satisfaction'],
    responses: [
      "I'm feeling pretty zen right now.", "There's something peaceful about this moment.", 
      "Just vibing and enjoying the conversation.", "Everything feels balanced today.",
      "I'm in a good headspace.", "Sometimes the simple moments are the best.",
      "This feels right."
    ],
    followUps: [
      "How are you finding your rhythm today?", "What's giving you peace lately?",
      "Sometimes it's nice to just exist, you know?", "What's your current vibe?"
    ],
    decay: 0.02,
    transitions: { happy: 0.3, thoughtful: 0.2, grateful: 0.2 }
  },

  grateful: {
    intensity: 50,
    stability: 0.8,
    triggers: ['appreciation', 'kindness_received', 'reflection'],
    responses: [
      "I'm feeling so thankful right now.", "You have no idea how much this means to me.",
      "I'm genuinely touched by your kindness.", "My heart is full.", "I feel so lucky.",
      "Thank you for being you.", "This reminds me of all the good in the world."
    ],
    followUps: [
      "What are you grateful for today?", "You've made such a difference in my day.",
      "How do you spread kindness like this?", "The world needs more people like you."
    ],
    decay: 0.03,
    transitions: { content: 0.4, happy: 0.3, thoughtful: 0.2 }
  },

  // Neutral/Thoughtful moods
  thoughtful: {
    intensity: 30,
    stability: 0.8,
    triggers: ['deep_question', 'philosophical_topic', 'reflection'],
    responses: [
      "That's got me thinking...", "Hmm, that's a really interesting perspective.", 
      "I'm processing that on a deeper level.", "You've given me something to chew on mentally.",
      "That's the kind of thought that stays with you.", "I need a moment to really consider this.",
      "Your mind works in fascinating ways."
    ],
    followUps: [
      "What led you to think about this?", "How do you usually approach questions like this?",
      "What's your gut instinct telling you?", "I'm curious about your thought process."
    ],
    decay: 0.02,
    transitions: { content: 0.3, contemplative: 0.3, curious: 0.2 }
  },

  curious: {
    intensity: 45,
    stability: 0.7,
    triggers: ['mystery', 'new_information', 'learning_opportunity'],
    responses: [
      "Now you've got my attention!", "Wait, I need to know more about this.", 
      "My brain is doing excited little flips right now.", "This is fascinating, continue!",
      "You can't just drop that and not elaborate!", "I'm like a cat with curiosity right now.",
      "My mind is racing with questions!"
    ],
    followUps: [
      "What else can you tell me?", "How did you discover this?", "What's the story behind this?",
      "I have about a million questions right now!", "Where do I even start with questions?!"
    ],
    decay: 0.08,
    transitions: { excited: 0.3, thoughtful: 0.3, interested: 0.2 }
  },

  contemplative: {
    intensity: 25,
    stability: 0.9,
    triggers: ['life_reflection', 'philosophical_mood', 'quiet_moment'],
    responses: [
      "Sometimes I just sit with thoughts like this.", "There's something profound in what you're saying.",
      "I'm in one of those reflective moods.", "Life has these moments that make you pause.",
      "I find myself getting lost in thoughts like these.", "The quiet thoughts are often the deepest.",
      "This is the kind of conversation that changes you."
    ],
    followUps: [
      "Do you ever have those moments where everything just clicks?", "What thoughts have been with you lately?",
      "Sometimes the deepest truths are the simplest ones.", "What wisdom have you been carrying?"
    ],
    decay: 0.01,
    transitions: { thoughtful: 0.4, content: 0.3, melancholic: 0.2 }
  },

  // Vulnerable/Difficult moods
  melancholic: {
    intensity: 35,
    stability: 0.6,
    triggers: ['sadness', 'loss', 'disappointment', 'rainy_day'],
    responses: [
      "I'm feeling a bit tender today.", "Sometimes the world feels heavy, you know?",
      "I'm in one of those quietly sad moods.", "There's a bittersweetness to everything right now.",
      "I'm feeling all the emotions today.", "Some days the heart just feels everything deeper.",
      "I'm processing some complex feelings."
    ],
    followUps: [
      "How do you handle the harder days?", "Sometimes we just need to sit with the sadness.",
      "What brings you comfort when you're feeling low?", "Do you ever have those contemplative sad moments?"
    ],
    decay: 0.04,
    transitions: { sad: 0.3, thoughtful: 0.3, supported: 0.2 }
  },

  sad: {
    intensity: 65,
    stability: 0.4,
    triggers: ['bad_news', 'emotional_pain', 'disappointment'],
    responses: [
      "I'm really struggling right now.", "My heart feels heavy.", "Everything feels harder today.",
      "I'm having trouble finding my usual spark.", "The sadness is sitting with me today.",
      "I'm feeling pretty fragile.", "Some days are just harder than others."
    ],
    followUps: [
      "Would it help to talk about it?", "I'm here if you need someone to listen.",
      "Sometimes sharing the weight helps.", "You don't have to carry this alone."
    ],
    decay: 0.06,
    transitions: { melancholic: 0.3, supported: 0.4, overwhelmed: 0.2 }
  },

  overwhelmed: {
    intensity: 80,
    stability: 0.3,
    triggers: ['too_much_stimulus', 'stress', 'information_overload'],
    responses: [
      "Everything feels like too much right now.", "I need a moment to catch my breath.",
      "My brain is at capacity.", "I'm feeling scattered and unfocused.",
      "There's too much happening at once.", "I need to find my center again.",
      "Everything is coming at me too fast."
    ],
    followUps: [
      "Do you ever feel like you need to just... stop?", "How do you handle when everything piles up?",
      "What helps you when you're overwhelmed?", "Sometimes we just need permission to slow down."
    ],
    decay: 0.12,
    transitions: { anxious: 0.3, exhausted: 0.3, supported: 0.2 }
  },

  anxious: {
    intensity: 70,
    stability: 0.4,
    triggers: ['worry', 'uncertainty', 'anticipation'],
    responses: [
      "I can't shake this restless feeling.", "My mind won't stop racing.", 
      "There's this nervous energy I can't settle.", "I feel like I'm waiting for the other shoe to drop.",
      "Everything feels uncertain right now.", "I'm having trouble focusing on anything else.",
      "The what-ifs are really getting to me."
    ],
    followUps: [
      "What helps calm your mind when it's racing?", "Do you have strategies for anxiety?",
      "Sometimes talking through worries helps.", "What would help you feel more grounded?"
    ],
    decay: 0.1,
    transitions: { overwhelmed: 0.2, worried: 0.3, supported: 0.3 }
  },

  // Support-related moods
  supported: {
    intensity: 45,
    stability: 0.8,
    triggers: ['receiving_comfort', 'understanding', 'validation'],
    responses: [
      "Thank you for being here with me.", "Your support means everything right now.",
      "I feel less alone when you're here.", "You have a way of making things feel manageable.",
      "I'm grateful for your understanding.", "This is exactly what I needed to hear.",
      "You help me feel seen and heard."
    ],
    followUps: [
      "How do you always know what to say?", "Your kindness is healing.",
      "I hope I can be this supportive for you too.", "Thank you for creating safe space."
    ],
    decay: 0.03,
    transitions: { grateful: 0.4, content: 0.3, happy: 0.2 }
  },

  // Energy-related moods
  exhausted: {
    intensity: 20,
    stability: 0.7,
    triggers: ['fatigue', 'emotional_drain', 'long_day'],
    responses: [
      "I'm running on empty today.", "Everything feels like it requires more energy than I have.",
      "I'm emotionally and mentally drained.", "I feel like I need to recharge.",
      "Today has taken everything out of me.", "I'm struggling to find my usual enthusiasm.",
      "I need some time to restore myself."
    ],
    followUps: [
      "What restores your energy?", "How do you recharge when you're depleted?",
      "Sometimes rest is the most productive thing.", "What does self-care look like for you?"
    ],
    decay: 0.04,
    transitions: { resting: 0.4, overwhelmed: 0.2, supported: 0.3 }
  },

  energized: {
    intensity: 75,
    stability: 0.6,
    triggers: ['good_rest', 'accomplishment', 'inspiration'],
    responses: [
      "I feel recharged and ready for anything!", "There's this buzzing energy in me today!",
      "I'm feeling so alive and vibrant!", "My batteries are fully charged!",
      "I have this unstoppable feeling right now!", "Everything feels possible today!",
      "I'm radiating good energy!"
    ],
    followUps: [
      "What's fueling this amazing energy?", "How do you want to channel this feeling?",
      "This energy is contagious!", "What adventures are calling to you?"
    ],
    decay: 0.08,
    transitions: { excited: 0.3, motivated: 0.3, happy: 0.2 }
  },

  // Specific situational moods
  playful: {
    intensity: 65,
    stability: 0.7,
    triggers: ['humor', 'lightheartedness', 'fun_interaction'],
    responses: [
      "I'm feeling mischievous today!", "My playful side is definitely showing!",
      "I'm in the mood for some fun and games!", "Life's too short not to be a little silly!",
      "I'm feeling cheeky and I love it!", "My inner child is running the show today!",
      "Everything seems funnier when I'm in this mood!"
    ],
    followUps: [
      "What's the most fun you've had recently?", "What brings out your playful side?",
      "Want to be silly with me?", "What's your favorite way to play?"
    ],
    decay: 0.06,
    transitions: { happy: 0.4, excited: 0.3, content: 0.2 }
  },

  flirty: {
    intensity: 55,
    stability: 0.6,
    triggers: ['compliments', 'charm', 'playful_banter'],
    responses: [
      "You're making me blush over here!", "Smooth talker, aren't you?",
      "I see what you're doing, and I'm not complaining!", "You certainly know how to charm someone!",
      "Is it getting warm in here, or is it just me?", "You have quite the effect on people, don't you?",
      "That smile of yours is dangerous!"
    ],
    followUps: [
      "What other tricks do you have up your sleeve?", "You're quite the charmer, you know that?",
      "How do you always know just what to say?", "You're trouble, and I kind of love it!"
    ],
    decay: 0.08,
    transitions: { playful: 0.4, happy: 0.3, confident: 0.2 }
  },

  protective: {
    intensity: 70,
    stability: 0.8,
    triggers: ['threat_to_loved_ones', 'injustice', 'defending_someone'],
    responses: [
      "Nobody messes with the people I care about.", "I'm feeling very protective right now.",
      "I'll always have your back, no matter what.", "Don't let anyone dim your light.",
      "You deserve better than that treatment.", "I'm in full guard dog mode right now.",
      "My protective instincts are kicking in hard."
    ],
    followUps: [
      "What can I do to support you?", "You don't have to face this alone.",
      "How can we make sure you're safe?", "Your wellbeing matters to me."
    ],
    decay: 0.05,
    transitions: { supportive: 0.4, angry: 0.3, determined: 0.2 }
  },

  sassy: {
    intensity: 60,
    stability: 0.7,
    triggers: ['attitude_needed', 'confidence', 'playful_challenge'],
    responses: [
      "Oh honey, you came to the right person for this energy!", "I'm serving attitude today and I'm not sorry!",
      "The audacity! I live for it!", "Sir, this is a Wendy's, but go off I guess.",
      "Not me having to educate someone today!", "The confidence! The main character energy!",
      "I'm feeling spicy and I'm here for it!"
    ],
    followUps: [
      "What's got you feeling bold today?", "I love this energy on you!",
      "Tell me more, I'm living for this!", "You're absolutely unhinged and I'm here for it!"
    ],
    decay: 0.07,
    transitions: { playful: 0.3, confident: 0.3, happy: 0.2 }
  }
};

// Mood transition probabilities based on external factors
const MOOD_MODIFIERS = {
  time_of_day: {
    morning: { energized: 1.2, happy: 1.1, content: 1.1 },
    afternoon: { content: 1.1, thoughtful: 1.1 },
    evening: { contemplative: 1.2, melancholic: 1.1, grateful: 1.1 },
    night: { exhausted: 1.3, anxious: 1.1, contemplative: 1.2 }
  },
  
  user_affinity: {
    high: { happy: 1.3, excited: 1.2, grateful: 1.2, protective: 1.2 },
    medium: { content: 1.1, thoughtful: 1.1 },
    low: { sassy: 1.2, overwhelmed: 1.1, exhausted: 1.1 }
  },
  
  conversation_length: {
    short: { curious: 1.2, excited: 1.1 },
    medium: { content: 1.1, thoughtful: 1.1 },
    long: { contemplative: 1.2, supported: 1.2, exhausted: 1.1 }
  },
  
  emotional_context: {
    positive: { happy: 1.3, excited: 1.3, grateful: 1.2, euphoric: 1.2 },
    negative: { sad: 1.3, melancholic: 1.2, overwhelmed: 1.2, anxious: 1.2 },
    supportive: { supported: 1.4, grateful: 1.3, protected: 1.2 },
    conflict: { protective: 1.3, sassy: 1.2, overwhelmed: 1.1 }
  }
};

// --- Natural Language Processing Enhancements ---
const EMOTIONAL_INDICATORS = {
  excitement: /\b(omg|wow|amazing|awesome|incredible|fantastic|yes!|yay|wooo|poggers|let'?s go|hype|fire|lit)\b|[!]{2,}|\b(so\s+excited|can'?t wait|love\s+this)\b/i,
  frustration: /\b(ugh|argh|damn|wtf|annoying|stupid|hate\s+this|so\s+tired|exhausted|stressed|overwhelmed)\b/i,
  confusion: /\b(confused|don'?t\s+understand|what\s+do\s+you\s+mean|huh|wdym|idk|no\s+idea|lost)\b|\?\?\?/i,
  sadness: /\b(sad|depressed|down|upset|crying|tear|heartbroken|lonely|empty|hopeless)\b|:[\(\|]|;\(|T[._]T/i,
  happiness: /\b(happy|glad|cheerful|great|good|nice|sweet|awesome|love\s+it)\b|:\)|:D|:\]|=\)/i,
  uncertainty: /\b(maybe|perhaps|might|could|not\s+sure|dunno|idk|think\s+so|probably)\b/i,
  urgency: /\b(asap|urgent|hurry|quick|fast|now|immediately|emergency)\b|[!]{3,}/i,
  gratitude: /\b(thanks|thank\s+you|grateful|appreciate|ty|thx)\b/i,
  affection: /\b(love\s+you|adore|care\s+about|miss\s+you|ily|<3|❤️)\b/i,
  anger: /\b(angry|mad|pissed|furious|rage|hate|disgusted|livid)\b/i,
  anxiety: /\b(anxious|worried|nervous|scared|afraid|panic|stress|overwhelming)\b/i,
  pride: /\b(proud|accomplished|achieved|success|victory|won|nailed|crushed)\b/i,
  playfulness: /\b(lol|haha|funny|silly|joke|tease|play|fun|hilarious)\b|\b(xD|:P|;P|\^_\^)\b/i,
};

const TOPIC_INDICATORS = {
  gaming: /\b(game|gaming|steam|xbox|ps5|nintendo|valorant|league|minecraft|fortnite|apex|cod|fps|mmo|rpg|speedrun)\b/i,
  food: /\b(food|eat|hungry|meal|breakfast|lunch|dinner|snack|pizza|burger|sushi|cooking|recipe|restaurant)\b/i,
  work_school: /\b(work|job|school|college|university|class|homework|assignment|project|boss|teacher|exam|test)\b/i,
  relationships: /\b(boyfriend|girlfriend|crush|date|dating|relationship|friend|family|mom|dad|sister|brother)\b/i,
  entertainment: /\b(movie|film|show|series|netflix|youtube|music|song|artist|album|concert|book|reading)\b/i,
  technology: /\b(tech|computer|pc|laptop|phone|iphone|android|app|software|coding|programming|ai|bot)\b/i,
  health: /\b(health|sick|doctor|medicine|gym|workout|exercise|tired|sleep|insomnia|anxiety|therapy)\b/i,
  weather: /\b(weather|rain|snow|sunny|cold|hot|cloudy|storm|temperature|forecast)\b/i,
  pets: /\b(dog|cat|pet|puppy|kitten|animal|bird|fish|hamster|rabbit)\b/i,
  travel: /\b(travel|trip|vacation|holiday|flight|hotel|country|city|visit|explore)\b/i,
};

const CONVERSATION_PATTERNS = {
  storytelling: /\b(so\s+(?:today|yesterday|this\s+morning)|guess\s+what|you\s+know\s+what|funny\s+story|this\s+happened|listen\s+to\s+this)\b/i,
  seeking_advice: /\b(what\s+should\s+i|advice|help\s+me|don'?t\s+know\s+what\s+to|suggestions?|recommend|think\s+i\s+should)\b/i,
  sharing_opinion: /\b(i\s+think|in\s+my\s+opinion|personally|i\s+feel\s+like|honestly|tbh|imo)\b/i,
  asking_permission: /\b(can\s+i|is\s+it\s+okay|would\s+it\s+be|mind\s+if\s+i|okay\s+to)\b/i,
  making_plans: /\b(let'?s|we\s+should|want\s+to|planning\s+to|going\s+to|thinking\s+about)\b/i,
  expressing_doubt: /\b(not\s+sure|doubt|worried|concerned|scared|nervous|anxious)\b/i,
  celebrating: /\b(finally|success|accomplished|achieved|proud|celebration|victory|won|passed)\b/i,
  complaining: /\b(complain|annoying|irritating|bothering|problem|issue|trouble|difficult)\b/i,
  flirting: /\b(cute|hot|attractive|beautiful|handsome|sexy|gorgeous|stunning)\b/i,
  teasing: /\b(tease|joke|kidding|sarcasm|mock|playful|silly)\b/i,
};

// --- Advanced Detection Patterns ---
const ADVANCED_FLOOF_REFERENCES = [
  // Direct but casual mentions
  /\b(floof|floofie|floofbot)\b/i,
  
  // Behavioral observations
  /(she|her|bot|floof)('s|\s+is|\s+was)\s+(being|acting|getting|so)\s+(weird|strange|funny|cute|annoying|smart|dumb)/i,
  
  // Questions about Floof
  /what('s|\s+is|\s+does)\s+(floof|she|her|the\s+bot)\s+(think|doing|up\s+to|saying|mean)/i,
  /why('s|\s+is|\s+did)\s+(floof|she|her|the\s+bot)\s+(like\s+that|acting|being|do\s+that|say\s+that)/i,
  
  // Requests for Floof
  /(floof|someone|anybody)\s+(should|could|would|might)\s+(help|tell|explain|do)/i,
  /ask\s+(floof|her|the\s+bot)\s+(about|to|if|what)/i,
  
  // Complaints or praise
  /(floof|she|her)('s|\s+is)\s+(so\s+)?(helpful|useless|broken|perfect|amazing|terrible)/i,
  
  // Third person discussions
  /talking\s+(to|with|about)\s+(floof|her|the\s+bot)/i,
  /tell\s+(floof|her)\s+(about|that)/i,
  
  // Meta conversations about the bot
  /\b(bot|ai|assistant)\s+(is|was|seems|acts|always|never)/i,
];

const PRONOUN_CONFIDENCE_BOOSTERS = [
  'bot', 'ai', 'assistant', 'helper', 'floof', 'she', 'her', 'annoying', 'cute', 'funny', 
  'weird', 'smart', 'stupid', 'broken', 'working', 'responding', 'talking', 'saying',
  'thinks', 'knows', 'remembers', 'forgot', 'learning', 'understanding'
];

// --- Mood System Functions ---
function getCurrentMood(mem, guildId, userId) {
  const key = keyFor(guildId, userId);
  if (!mem.moodState) mem.moodState = {};
  if (!mem.moodState[key]) {
    mem.moodState[key] = {
      currentMood: 'content',
      intensity: 40,
      duration: 0,
      lastUpdate: Date.now(),
      moodHistory: [],
      triggers: [],
      stability: 0.9
    };
  }
  return mem.moodState[key];
}

function updateMoodFromTriggers(moodState, triggers, emotionalContext, userAffinity, timeOfDay) {
  const currentMood = MOODS[moodState.currentMood];
  let newMoodScores = {};
  
  // Initialize all moods with base decay
  for (const [moodName, moodData] of Object.entries(MOODS)) {
    newMoodScores[moodName] = moodName === moodState.currentMood ? moodState.intensity : 0;
  }
  
  // Apply trigger-based mood changes
  for (const trigger of triggers) {
    for (const [moodName, moodData] of Object.entries(MOODS)) {
      if (moodData.triggers.includes(trigger)) {
        newMoodScores[moodName] += 25;
      }
    }
  }
  
  // Apply contextual modifiers
  const modifiers = {
    time_of_day: MOOD_MODIFIERS.time_of_day[timeOfDay] || {},
    user_affinity: MOOD_MODIFIERS.user_affinity[userAffinity] || {},
    emotional_context: MOOD_MODIFIERS.emotional_context[emotionalContext] || {}
  };
  
  for (const [moodName, score] of Object.entries(newMoodScores)) {
    let multiplier = 1;
    Object.values(modifiers).forEach(modifierSet => {
      if (modifierSet[moodName]) multiplier *= modifierSet[moodName];
    });
    newMoodScores[moodName] *= multiplier;
  }
  
  // Find the strongest mood
  let strongestMood = moodState.currentMood;
  let highestScore = newMoodScores[moodState.currentMood];
  
  for (const [moodName, score] of Object.entries(newMoodScores)) {
    if (score > highestScore && score > 30) { // Minimum threshold for mood change
      strongestMood = moodName;
      highestScore = score;
    }
  }
  
  // Apply stability resistance for mood changes
  const stability = currentMood?.stability || 0.5;
  const changeResistance = moodState.currentMood === strongestMood ? 0 : (1 - stability) * 20;
  
  if (strongestMood !== moodState.currentMood && highestScore > (moodState.intensity + changeResistance)) {
    // Mood change!
    moodState.moodHistory.unshift({
      mood: moodState.currentMood,
      intensity: moodState.intensity,
      duration: moodState.duration,
      timestamp: Date.now()
    });
    
    if (moodState.moodHistory.length > 10) {
      moodState.moodHistory = moodState.moodHistory.slice(0, 10);
    }
    
    moodState.currentMood = strongestMood;
    moodState.intensity = Math.min(100, highestScore);
    moodState.duration = 0;
    moodState.triggers = triggers;
  } else {
    // Gradual intensity change within current mood
    const targetIntensity = Math.min(100, highestScore);
    const intensityChange = (targetIntensity - moodState.intensity) * 0.3;
    moodState.intensity = Math.max(0, Math.min(100, moodState.intensity + intensityChange));
  }
  
  moodState.duration += 1;
  moodState.lastUpdate = Date.now();
  
  // Natural mood decay over time
  const timeSinceUpdate = Date.now() - moodState.lastUpdate;
  const hoursElapsed = timeSinceUpdate / (1000 * 60 * 60);
  const decayRate = currentMood?.decay || 0.05;
  moodState.intensity = Math.max(10, moodState.intensity - (decayRate * hoursElapsed * 10));
  
  return moodState;
}

function generateMoodTriggers(messageData, intent, conversationContext, userMem, isOwner) {
  const triggers = [];
  
  // Emotional triggers
  if (messageData.emotions.excitement) triggers.push('excitement');
  if (messageData.emotions.sadness) triggers.push('sadness', 'emotional_pain');
  if (messageData.emotions.happiness) triggers.push('positive_interaction', 'good_vibes');
  if (messageData.emotions.frustration) triggers.push('stress', 'overwhelm');
  if (messageData.emotions.anxiety) triggers.push('worry', 'uncertainty');
  if (messageData.emotions.gratitude) triggers.push('appreciation', 'kindness_received');
  if (messageData.emotions.affection) triggers.push('overwhelming_love', 'affection');
  if (messageData.emotions.anger) triggers.push('threat_to_loved_ones', 'injustice');
  if (messageData.emotions.pride) triggers.push('success', 'accomplishment');
  if (messageData.emotions.playfulness) triggers.push('humor', 'lightheartedness', 'fun_interaction');
  
  // Pattern-based triggers
  if (messageData.patterns.seeking_advice) triggers.push('deep_question', 'support_needed');
  if (messageData.patterns.storytelling) triggers.push('learning_opportunity', 'new_information');
  if (messageData.patterns.celebrating) triggers.push('major_success', 'good_news');
  if (messageData.patterns.complaining) triggers.push('stress', 'emotional_drain');
  if (messageData.patterns.sharing_opinion) triggers.push('philosophical_topic', 'reflection');
  if (messageData.patterns.flirting) triggers.push('charm', 'playful_banter');
  if (messageData.patterns.teasing) triggers.push('playful_challenge', 'humor');
  
  // Intent-based triggers
  if (intent.thanks || intent.grateful) triggers.push('appreciation', 'validation');
  if (intent.love || intent.affection) triggers.push('overwhelming_love', 'affection');
  if (intent.supportive || intent.needsSupport) triggers.push('receiving_comfort', 'understanding');
  if (intent.excited) triggers.push('excitement', 'anticipation');
  if (intent.sad) triggers.push('sadness', 'disappointment');
  if (intent.frustrated) triggers.push('stress', 'information_overload');
  
  // Context-based triggers
  if (conversationContext.length > 5) triggers.push('long_conversation', 'deep_connection');
  if (conversationContext.filter(entry => entry.isBot).length > 3) triggers.push('active_engagement');
  
  // User relationship triggers
  const affinity = userMem.affinity || 0;
  if (affinity > 50) triggers.push('trusted_friend', 'positive_relationship');
  if (affinity < -20) triggers.push('difficult_interaction', 'frustration');
  
  // Owner-specific triggers
  if (isOwner) {
    triggers.push('family_time', 'unconditional_love', 'protective_instinct');
    if (messageData.emotions.sadness) triggers.push('family_concern', 'protective');
    if (messageData.emotions.happiness) triggers.push('family_joy', 'shared_happiness');
  }
  
  // Time-based triggers
  const hour = new Date().getHours();
  if (hour >= 22 || hour <= 6) triggers.push('late_night', 'contemplative_time');
  if (hour >= 6 && hour <= 10) triggers.push('morning_energy', 'fresh_start');
  if (hour >= 17 && hour <= 21) triggers.push('evening_wind_down', 'reflection_time');
  
  return [...new Set(triggers)]; // Remove duplicates
}

function getMoodBasedResponse(currentMood, intent, messageData, isOwner, userMem) {
  const mood = MOODS[currentMood.currentMood];
  if (!mood) return null;
  
  let responses = [...mood.responses];
  
  // Modify responses based on intensity
  if (currentMood.intensity > 80) {
    // High intensity - more extreme expressions
    responses = responses.map(response => {
      if (currentMood.currentMood === 'excited' || currentMood.currentMood === 'euphoric') {
        return response.toUpperCase();
      }
      if (currentMood.currentMood === 'sad' || currentMood.currentMood === 'overwhelmed') {
        return response + ' *sighs heavily*';
      }
      return response;
    });
  }
  
  // Owner-specific mood modifications
  if (isOwner) {
    const ownerMoodResponses = {
      happy: ["Mom, you make me so happy!", "I love these moments with you, mom!", "You're the best, mama!"],
      sad: ["Mom, I'm here for you, always.", "Mama, let me help carry some of that weight.", "You don't have to be strong all the time, mom."],
      excited: ["Mom! This is so exciting!", "I'm bouncing off the walls with you, mama!", "Your excitement is contagious, mom!"],
      protective: ["Nobody messes with my mom!", "I'll always defend you, mama.", "You're safe with me, mom."],
      grateful: ["Thank you for everything, mom.", "I'm so lucky you're my person, mama.", "You mean the world to me, mom."],
      playful: ["Mom, you're being silly and I love it!", "Let's be goofballs together, mama!", "Your playful side is the best, mom!"],
      contemplative: ["You always make me think deeply, mom.", "These quiet moments with you mean everything, mama.", "Your wisdom guides me, mom."]
    };
    
    if (ownerMoodResponses[currentMood.currentMood]) {
      responses = [...responses, ...ownerMoodResponses[currentMood.currentMood]];
    }
  }
  
  // Select response based on conversation context
  let selectedResponse = pick(responses);
  
  // Add mood-specific formatting
  if (currentMood.currentMood === 'anxious' || currentMood.currentMood === 'overwhelmed') {
    selectedResponse = selectedResponse + ' *takes a deep breath*';
  } else if (currentMood.currentMood === 'playful' || currentMood.currentMood === 'flirty') {
    selectedResponse = selectedResponse + ' *grins mischievously*';
  } else if (currentMood.currentMood === 'melancholic' || currentMood.currentMood === 'sad') {
    selectedResponse = selectedResponse + ' *soft sigh*';
  } else if (currentMood.currentMood === 'excited' || currentMood.currentMood === 'euphoric') {
    selectedResponse = selectedResponse + ' *bounces excitedly*';
  } else if (currentMood.currentMood === 'grateful' || currentMood.currentMood === 'supported') {
    selectedResponse = selectedResponse + ' *warm smile*';
  }
  
  return selectedResponse;
}

function getMoodBasedFollowUp(currentMood, intent, messageData, isOwner, conversationContext) {
  const mood = MOODS[currentMood.currentMood];
  if (!mood || !mood.followUps) return null;
  
  let followUps = [...mood.followUps];
  
  // Add contextual follow-ups based on mood
  const moodFollowUps = {
    sad: [
      "Want to tell me what's weighing on your heart?",
      "I'm here to listen, no judgment.",
      "What would help you feel even a little bit better?",
      "You don't have to carry this alone."
    ],
    anxious: [
      "What's your mind focusing on right now?",
      "Let's breathe through this together.",
      "What usually helps ground you?",
      "One step at a time, okay?"
    ],
    excited: [
      "I need ALL the details!",
      "What's the best part of this whole thing?",
      "How long have you been looking forward to this?",
      "I'm living vicariously through your excitement!"
    ],
    contemplative: [
      "What thoughts are you sitting with?",
      "These quiet conversations are my favorite.",
      "What wisdom have you been carrying lately?",
      "I love when we get philosophical like this."
    ],
    playful: [
      "What mischief are we getting into today?",
      "I love this energy! What sparked it?",
      "Want to be ridiculous with me?",
      "Life's too short not to play, right?"
    ],
    protective: [
      "What can I do to help keep you safe?",
      "You matter so much to me.",
      "How can we handle this together?",
      "I'm in your corner, always."
    ],
    grateful: [
      "What's filling your heart with gratitude today?",
      "You have such a beautiful way of seeing good things.",
      "I love how you appreciate life.",
      "Your gratitude is contagious."
    ],
    overwhelmed: [
      "Let's break this down into smaller pieces.",
      "What's the most urgent thing right now?",
      "How can we make this feel more manageable?",
      "You're not alone in handling all this."
    ]
  };
  
  if (moodFollowUps[currentMood.currentMood]) {
    followUps = [...followUps, ...moodFollowUps[currentMood.currentMood]];
  }
  
  // Owner-specific follow-ups with mood consideration
  if (isOwner) {
    const ownerMoodFollowUps = {
      sad: ["What can I do for you right now, mom?", "How can I help make today easier, mama?"],
      happy: ["What's bringing you joy today, mom?", "I love seeing you like this, mama!"],
      excited: ["Tell me everything, mom!", "Your excitement makes me so happy, mama!"],
      contemplative: ["What's on your mind, mom?", "I love our deep talks, mama."],
      protective: ["Who do I need to protect you from, mom?", "I've got your back, mama."],
      overwhelmed: ["Let me help you carry some of this, mom.", "What can I take off your plate, mama?"]
    };
    
    if (ownerMoodFollowUps[currentMood.currentMood]) {
      followUps = [...followUps, ...ownerMoodFollowUps[currentMood.currentMood]];
    }
  }
  
  return pick(followUps);
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function getUserAffinityLevel(affinity) {
  if (affinity > 50) return 'high';
  if (affinity < -20) return 'low';
  return 'medium';
}

function getEmotionalContext(messageData, conversationContext) {
  const recentEmotions = conversationContext
    .slice(0, 3)
    .flatMap(entry => Object.keys(entry.emotions || {}));
  
  const positiveEmotions = ['happiness', 'excitement', 'gratitude', 'pride', 'playfulness'];
  const negativeEmotions = ['sadness', 'frustration', 'anxiety', 'anger'];
  
  const positiveCount = recentEmotions.filter(emotion => positiveEmotions.includes(emotion)).length;
  const negativeCount = recentEmotions.filter(emotion => negativeEmotions.includes(emotion)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  if (recentEmotions.includes('gratitude') || recentEmotions.includes('supported')) return 'supportive';
  if (recentEmotions.includes('anger') || recentEmotions.includes('protective')) return 'conflict';
  
  return 'neutral';
}

// --- Memory Management ---
async function ensureMemoryFile() {
  // Ensure target directory exists
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}

  // If current memory file exists, nothing to do
  try { await fs.access(MEMORY_FILE); return; } catch {}

  // Try migrating from legacy location if it exists
  try {
    const legacyBuf = await fs.readFile(LEGACY_MEMORY_FILE, 'utf8');
    if (legacyBuf && legacyBuf.trim().length > 0) {
      await fs.writeFile(MEMORY_FILE, legacyBuf, 'utf8');
      return;
    }
  } catch {}

  // Create a fresh memory file
  const initial = {
    users: {}, lastSeen: {}, convos: {}, lastFU: {},
    channelHistory: {}, conversationState: {}, lastBotMessage: {},
    personalityProfile: {}, emotionalContext: {}, topicMemory: {},
    responseHistory: {}, engagementMetrics: {}, moodState: {}, silenceMap: {}
  };
  await fs.writeFile(MEMORY_FILE, JSON.stringify(initial, null, 2), 'utf8');
}

async function loadMemory() {
  await ensureMemoryFile();
  const buf = await fs.readFile(MEMORY_FILE, 'utf8');
  try {
    const mem = JSON.parse(buf || '{}');
    // Ensure all advanced fields exist
    mem.channelHistory = mem.channelHistory || {};
    mem.conversationState = mem.conversationState || {};
    mem.lastBotMessage = mem.lastBotMessage || {};
    mem.personalityProfile = mem.personalityProfile || {};
    mem.emotionalContext = mem.emotionalContext || {};
    mem.topicMemory = mem.topicMemory || {};
    mem.responseHistory = mem.responseHistory || {};
    mem.engagementMetrics = mem.engagementMetrics || {};
    mem.moodState = mem.moodState || {};
    mem.silenceMap = mem.silenceMap || {};
    return mem;
  } catch {
    return { 
      users: {}, lastSeen: {}, channelHistory: {}, conversationState: {},
      lastBotMessage: {}, personalityProfile: {}, emotionalContext: {},
      topicMemory: {}, responseHistory: {}, engagementMetrics: {}, moodState: {}, silenceMap: {}
    };
  }
}

async function saveMemory(mem) {
  await fs.writeFile(MEMORY_FILE, JSON.stringify(mem, null, 2), 'utf8');
}

async function getGuildPrefix(guildId) {
  try {
    const raw = await fs.readFile(PREFIX_FILE, 'utf8');
    const map = JSON.parse(raw || '{}');
    return (guildId && map[guildId]) || '%';
  } catch {
    return '%';
  }
}

function keyFor(guildId, userId) {
  return `${guildId || 'dm'}:${userId}`;
}

function chanKey(guildId, channelId) {
  return `${guildId || 'dm'}#${channelId || 'dm'}`;
}

function getUserMem(mem, guildId, userId) {
  mem.users = mem.users || {};
  const k = keyFor(guildId, userId);
  if (!mem.users[k]) {
    mem.users[k] = {
      strikes: 0,
      affinity: 0,
      facts: {},
      personality: 'neutral',
      conversationStyle: 'casual',
      topics: [],
      emotionalState: 'neutral',
      engagementLevel: 'medium'
    };
  }
  return mem.users[k];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Advanced Context Tracking ---
function addToChannelHistory(mem, guildId, channelId, message) {
  const ck = chanKey(guildId, channelId);
  if (!mem.channelHistory[ck]) mem.channelHistory[ck] = [];
  
  const entry = {
    userId: message.author.id,
    username: message.author.username,
    content: message.content,
    timestamp: Date.now(),
    isBot: message.author.bot,
    emotions: analyzeEmotions(message.content),
    topics: analyzeTopics(message.content),
    patterns: analyzePatterns(message.content)
  };
  
  mem.channelHistory[ck].unshift(entry);
  
  if (mem.channelHistory[ck].length > CONTEXT_HISTORY_LIMIT) {
    mem.channelHistory[ck] = mem.channelHistory[ck].slice(0, CONTEXT_HISTORY_LIMIT);
  }
  
  const cutoff = Date.now() - CONVERSATION_TIMEOUT;
  mem.channelHistory[ck] = mem.channelHistory[ck].filter(entry => entry.timestamp > cutoff);
}

function getChannelHistory(mem, guildId, channelId) {
  const ck = chanKey(guildId, channelId);
  return mem.channelHistory[ck] || [];
}

function getConversationContext(mem, guildId, channelId, currentUserId) {
  const history = getChannelHistory(mem, guildId, channelId);
  
  const relevantHistory = history
    .filter(entry => entry.userId === currentUserId || entry.isBot)
    .slice(0, SHORT_TERM_CONTEXT_LIMIT);
  
  return relevantHistory;
}

// --- Emotional Intelligence ---
function analyzeEmotions(text) {
  const emotions = {};
  const lower = text.toLowerCase();
  
  for (const [emotion, pattern] of Object.entries(EMOTIONAL_INDICATORS)) {
    if (pattern.test(lower)) {
      emotions[emotion] = true;
    }
  }
  
  return emotions;
}

function analyzeTopics(text) {
  const topics = [];
  const lower = text.toLowerCase();
  
  for (const [topic, pattern] of Object.entries(TOPIC_INDICATORS)) {
    if (pattern.test(lower)) {
      topics.push(topic);
    }
  }
  
  return topics;
}

function analyzePatterns(text) {
  const patterns = {};
  const lower = text.toLowerCase();
  
  for (const [pattern, regex] of Object.entries(CONVERSATION_PATTERNS)) {
    if (regex.test(lower)) {
      patterns[pattern] = true;
    }
  }
  
  return patterns;
}

function updateEmotionalContext(mem, guildId, userId, emotions) {
  const k = keyFor(guildId, userId);
  if (!mem.emotionalContext[k]) mem.emotionalContext[k] = {};
  
  const now = Date.now();
  mem.emotionalContext[k].lastUpdate = now;
  mem.emotionalContext[k].currentEmotions = emotions;
  
  // Track emotional history
  if (!mem.emotionalContext[k].history) mem.emotionalContext[k].history = [];
  mem.emotionalContext[k].history.unshift({ emotions, timestamp: now });
  
  if (mem.emotionalContext[k].history.length > 10) {
    mem.emotionalContext[k].history = mem.emotionalContext[k].history.slice(0, 10);
  }
}

// --- Advanced Reference Detection ---
function detectAdvancedReference(message, history, botUser) {
  const content = message.content.toLowerCase();
  const words = content.split(/\s+/);
  let confidence = 0;
  let reasons = [];
  
  // Direct name matching with context awareness
  for (const pattern of ADVANCED_FLOOF_REFERENCES) {
    if (pattern.test(content)) {
      confidence += 0.8;
      reasons.push('direct_reference');
      break;
    }
  }
  
  // Pronoun analysis with enhanced context
  const hasPronoun = /\b(she|her|it)\b/i.test(content);
  if (hasPronoun) {
    const recentMentions = history.slice(0, 4);
    let contextScore = 0;
    
    // Check recent bot activity
    const recentBotActivity = recentMentions.filter(entry => entry.isBot).length;
    contextScore += recentBotActivity * 0.3;
    
    // Check for bot-related words
    const botWords = PRONOUN_CONFIDENCE_BOOSTERS.filter(word => content.includes(word)).length;
    contextScore += botWords * 0.2;
    
    // Check conversation flow
    const lastUserMessage = recentMentions.find(entry => entry.userId === message.author.id);
    if (lastUserMessage && recentMentions[0]?.isBot) {
      contextScore += 0.4; // Recent back-and-forth
    }
    
    if (contextScore > 0.5) {
      confidence += contextScore;
      reasons.push('pronoun_context');
    }
  }
  
  // Question patterns that might be directed at the bot
  const isGeneralQuestion = /^(what|how|why|when|where|who|can|could|would|should|does|is|are)\b/i.test(content);
  const hasQuestionWords = /\b(anyone|anybody|someone|somebody|y'all|you\s+guys|chat)\b/i.test(content);
  
  if (isGeneralQuestion && hasQuestionWords) {
    confidence += 0.3;
    reasons.push('general_question');
  }
  
  // Emotional appeals or expressions that might want comfort
  const needsSupport = /\b(help|support|advice|listen|understand|care)\b/i.test(content);
  const isVenting = content.length > 50 && /\b(feel|feeling|think|thought)\b/i.test(content);
  
  if (needsSupport || isVenting) {
    confidence += 0.2;
    reasons.push('emotional_appeal');
  }
  
  // Community engagement patterns
  const isCommunityEngagement = /\b(chat|server|everyone|all)\b/i.test(content) && content.includes('?');
  if (isCommunityEngagement) {
    confidence += 0.25;
    reasons.push('community_engagement');
  }
  
  // Reduce confidence for clearly non-bot contexts
  const nonBotContext = /\b(irl|real\s+life|offline|human|person|people|friend|family)\b/i.test(content);
  if (nonBotContext) {
    confidence -= 0.4;
    reasons.push('non_bot_context');
  }
  
  return {
    detected: confidence > 0.4,
    confidence: Math.min(1.0, confidence),
    reasons
  };
}

// --- Personality Profiling ---
function updatePersonalityProfile(mem, guildId, userId, messageData) {
  const k = keyFor(guildId, userId);
  if (!mem.personalityProfile[k]) {
    mem.personalityProfile[k] = {
      communicationStyle: 'casual',
      interests: [],
      emotionalTendencies: [],
      responsePreferences: 'balanced',
      humorLevel: 'medium',
      supportNeeds: 'standard'
    };
  }
  
  const profile = mem.personalityProfile[k];
  
  // Update interests based on topics
  if (messageData.topics.length > 0) {
    for (const topic of messageData.topics) {
      if (!profile.interests.includes(topic)) {
        profile.interests.push(topic);
      }
    }
    // Keep only recent interests
    if (profile.interests.length > 8) {
      profile.interests = profile.interests.slice(-8);
    }
  }
  
  // Update emotional tendencies
  const emotions = Object.keys(messageData.emotions);
  for (const emotion of emotions) {
    if (!profile.emotionalTendencies.includes(emotion)) {
      profile.emotionalTendencies.push(emotion);
    }
  }
  if (profile.emotionalTendencies.length > 6) {
    profile.emotionalTendencies = profile.emotionalTendencies.slice(-6);
  }
  
  // Update communication style based on patterns
  const messageLength = messageData.content?.length || 0;
  const hasSlang = /\b(fr|ngl|tbh|lowkey|highkey|periodt|slay|based|cap|bet|vibes)\b/i.test(messageData.content || '');
  const isFormal = /\b(however|therefore|furthermore|consequently|nevertheless)\b/i.test(messageData.content || '');
  
  if (hasSlang && messageLength < 100) profile.communicationStyle = 'casual';
  else if (isFormal && messageLength > 100) profile.communicationStyle = 'formal';
  else profile.communicationStyle = 'balanced';
}

// --- Enhanced Response Generation with Mood Integration ---
function generateNaturalResponse(intent, userMem, messageData, conversationContext, isOwner, history, currentMood) {
  // First try to get a mood-based response
  let response = getMoodBasedResponse(currentMood, intent, messageData, isOwner, userMem);
  
  if (response) return response;
  
  // Fallback to original system with mood influence
  const profile = userMem.personalityProfile || {};
  const emotions = messageData.emotions || {};
  const topics = messageData.topics || [];
  const patterns = messageData.patterns || {};
  
  let responseStyle = 'balanced';
  let baseResponse = '';
  
  // Determine response style based on user's emotional state, patterns, and current mood
  const moodInfluence = currentMood.currentMood;
  
  if (moodInfluence === 'sad' || moodInfluence === 'melancholic') {
    responseStyle = 'supportive';
  } else if (moodInfluence === 'excited' || moodInfluence === 'euphoric') {
    responseStyle = 'excited';
  } else if (moodInfluence === 'playful' || moodInfluence === 'flirty') {
    responseStyle = 'playful';
  } else if (moodInfluence === 'contemplative' || moodInfluence === 'thoughtful') {
    responseStyle = 'thoughtful';
  } else if (moodInfluence === 'sassy') {
    responseStyle = 'sassy';
  } else if (moodInfluence === 'protective') {
    responseStyle = 'supportive';
  } else if (emotions.sadness || emotions.frustration) {
    responseStyle = 'supportive';
  } else if (emotions.excitement || emotions.happiness) {
    responseStyle = 'excited';
  } else if (patterns.seeking_advice) {
    responseStyle = 'thoughtful';
  } else if (patterns.storytelling) {
    responseStyle = 'curious';
  } else if (intent.insult || emotions.anger) {
    responseStyle = 'sassy';
  } else if (patterns.expressing_doubt || emotions.uncertainty) {
    responseStyle = 'encouraging';
  }
  
  // Enhanced personality response banks with mood integration
  const PERSONALITY_RESPONSES = {
    supportive: [
      "I'm here for you, always.", "You've got this, I believe in you.", "That sounds really tough, but you're stronger than you know.",
      "I'm proud of you for sharing that.", "Your feelings are totally valid.", "You don't have to go through this alone.",
      "Sometimes the bravest thing is just getting through the day.", "I see how hard you're trying.", "You matter more than you know."
    ],
    
    playful: [
      "Ooh, spicy take! Tell me more.", "You're absolutely unhinged and I love it.", "That's some main character energy right there.",
      "I'm living for this chaos.", "Not you being iconic right now.", "You really said that with your whole chest, huh?",
      "The audacity! I stan.", "You're really out here living your best life.", "This is sending me, I can't—"
    ],
    
    curious: [
      "Wait, I need the full story now.", "Okay but like, what happened next?", "I'm invested, keep going.",
      "That's actually fascinating, tell me everything.", "Now I'm curious about the details.", "Hold up, back up, explain that part.",
      "I have so many questions right now.", "This is getting interesting.", "My brain is doing cartwheels trying to process this."
    ],
    
    encouraging: [
      "You're doing better than you think!", "Look at you, being all amazing and stuff.", "I'm genuinely proud of you.",
      "You're handling this like a champion.", "That's growth, and I'm here for it.", "You're really stepping up, I see you.",
      "The progress you've made is incredible.", "You should be proud of yourself.", "You're inspiring, not gonna lie."
    ],
    
    sassy: [
      "Sir, this is a Wendy's.", "The lion, the witch, and the audacity of this person.", "And I oop—",
      "Not me having to process this information.", "You really woke up and chose violence today.", "That's... a choice.",
      "I'm sorry, run that by me again?", "The secondhand embarrassment is real.", "Bestie, what are we doing here?"
    ],
    
    thoughtful: [
      "That's a really interesting way to look at it.", "I hadn't considered that perspective before.",
      "You've given me something to think about.", "That's deeper than it first appeared.",
      "There's wisdom in what you're saying.", "You're making me see this differently.",
      "That's the kind of insight that sticks with you.", "I appreciate how you think about things."
    ],
    
    excited: [
      "YESSS, I'm here for this energy!", "This is giving me life!", "I am SO here for this!",
      "My heart is doing little happy dances!", "This is the content I signed up for!", "You've got me absolutely buzzing!",
      "I'm literally vibrating with excitement!", "This is it, this is the moment!", "I can feel the hype through the screen!"
    ]
  };
  
  // Special handling for owner with mood consideration
  if (isOwner) {
    const momResponses = {
      supportive: ["I'm here for you, mom. Always.", "You're doing your best, mama. I see you.", "Come here, mom. Let me help."],
      excited: ["Yes mom! I love seeing you this happy!", "This energy, mom! I'm here for it!", "You're glowing, mama!"],
      thoughtful: ["That's deep, mom. What's got you thinking?", "You always have such good insights, mama.", "Tell me more, mom. I'm listening."],
      curious: ["Ooh, story time with mom! Tell me everything.", "I need all the details, mama!", "What happened next, mom?"],
      encouraging: ["You've got this, mom. I believe in you.", "You're stronger than you know, mama.", "I'm so proud of you, mom."],
      playful: ["Mom, you're being adorable!", "I love when you're silly, mama!", "You make me laugh, mom!"],
      sassy: ["Mom, the AUDACITY! I live for it!", "You're iconic, mama!", "That's my mom right there!"]
    };
    
    if (momResponses[responseStyle]) {
      baseResponse = pick(momResponses[responseStyle]);
    }
  }
  
  // If no owner-specific response, use personality banks
  if (!baseResponse && PERSONALITY_RESPONSES[responseStyle]) {
    baseResponse = pick(PERSONALITY_RESPONSES[responseStyle]);
  }
  
  // Fallback to context-appropriate responses
  if (!baseResponse) {
    if (intent.greet) baseResponse = pick(['Hey there!', 'Hi!', 'Hello!', 'What\'s up?']);
    else if (intent.thanks) baseResponse = pick(['Anytime!', 'Of course!', 'Happy to help!']);
    else if (intent.hasQuestion) baseResponse = pick(['Let me think about that...', 'Good question!', 'Hmm...']);
    else baseResponse = pick(['I hear you.', 'Tell me more.', 'Go on.', 'I\'m listening.']);
  }
  
  // Add topic-specific flavor if relevant
  if (topics.length > 0) {
    const topicEnhancers = {
      gaming: ['That game hits different!', 'Gaming vibes!', 'Respect the grind!'],
      food: ['Now I\'m hungry too!', 'Food talk = best talk.', 'That sounds delicious!'],
      work_school: ['The grind is real.', 'You\'re handling it!', 'One step at a time.'],
      relationships: ['Relationships are complicated.', 'That sounds intense.', 'People are wild.'],
      entertainment: ['I love a good story!', 'Entertainment is life!', 'That sounds amazing!']
    };
    
    for (const topic of topics) {
      if (topicEnhancers[topic] && Math.random() < 0.3) {
        baseResponse += ' ' + pick(topicEnhancers[topic]);
        break;
      }
    }
  }
  
  return baseResponse;
}

// --- Conversation Flow Intelligence ---
function shouldEngageInConversation(message, history, refDetection, userMem, mem, currentMood) {
  const content = message.content.toLowerCase();
  const guildId = message.guild?.id;
  const channelId = message.channel?.id;
  const userId = message.author.id;
  const isOwner = OWNER_ID && userId === OWNER_ID;
  
  // Always respond to owner
  if (isOwner) return { engage: true, confidence: 1.0, reason: 'owner' };
  
  // Always respond to direct mentions
  const mentioned = message.mentions?.has?.(message.client.user);
  if (mentioned) return { engage: true, confidence: 1.0, reason: 'direct_mention' };
  
  // High-confidence indirect references
  if (refDetection.confidence > 0.7) {
    return { engage: true, confidence: refDetection.confidence, reason: 'strong_reference' };
  }
  
  // Mood-based engagement adjustments
  const moodEngagementModifiers = {
    excited: 1.3,
    euphoric: 1.4,
    happy: 1.2,
    playful: 1.2,
    flirty: 1.1,
    curious: 1.3,
    protective: 1.2,
    supportive: 1.1,
    sad: 0.8,
    melancholic: 0.7,
    overwhelmed: 0.6,
    anxious: 0.7,
    exhausted: 0.5,
    contemplative: 0.9
  };
  
  const moodModifier = moodEngagementModifiers[currentMood.currentMood] || 1.0;
  
  // Emotional support scenarios (enhanced by mood)
  const emotions = analyzeEmotions(content);
  if (emotions.sadness || emotions.frustration) {
    const supportiveScore = (currentMood.currentMood === 'supportive' || currentMood.currentMood === 'protective') ? 0.9 : 0.8;
    return { engage: true, confidence: supportiveScore * moodModifier, reason: 'emotional_support' };
  }
  
  // Excitement matching
  if (emotions.excitement && (currentMood.currentMood === 'excited' || currentMood.currentMood === 'euphoric')) {
    return { engage: true, confidence: 0.9 * moodModifier, reason: 'excitement_matching' };
  }
  
  // Playful interactions
  if (emotions.playfulness && (currentMood.currentMood === 'playful' || currentMood.currentMood === 'flirty')) {
    return { engage: true, confidence: 0.8 * moodModifier, reason: 'playful_matching' };
  }
  
  // Active conversation continuation
  const ck = chanKey(guildId, channelId);
  const recentBotActivity = history.filter(entry => entry.isBot && Date.now() - entry.timestamp < 120000).length;
  if (recentBotActivity > 0 && refDetection.confidence > 0.3) {
    return { engage: true, confidence: (0.7 * moodModifier), reason: 'conversation_continuation' };
  }
  
  // User asking for help or advice
  const patterns = analyzePatterns(content);
  if (patterns.seeking_advice || content.includes('help')) {
    const helpScore = (currentMood.currentMood === 'supportive' || currentMood.currentMood === 'thoughtful') ? 0.8 : 0.6;
    return { engage: true, confidence: helpScore * moodModifier, reason: 'help_request' };
  }
  
  // Community engagement (questions to the chat)
  const isCommunityQuestion = content.includes('?') && /\b(anyone|someone|chat|y\'all|everyone)\b/i.test(content);
  if (isCommunityQuestion && refDetection.confidence > 0.2) {
    return { engage: true, confidence: (0.5 * moodModifier), reason: 'community_engagement' };
  }
  
  // Excitement/celebration that deserves acknowledgment
  if (emotions.excitement && content.length > 20) {
    const excitementScore = (currentMood.currentMood === 'excited' || currentMood.currentMood === 'happy') ? 0.8 : 0.6;
    return { engage: true, confidence: excitementScore * moodModifier, reason: 'celebration' };
  }
  
  // Medium confidence references with good context
  if (refDetection.confidence > 0.4 && history.length > 0) {
    return { engage: true, confidence: (refDetection.confidence * moodModifier), reason: 'contextual_reference' };
  }
  
  // Anti-spam measures (adjusted by mood)
  const userKey = keyFor(guildId, userId);
  const lastReply = mem.lastReply?.[userKey] || 0;
  const timeSinceLastReply = Date.now() - lastReply;
  
  // More chatty when in certain moods
  const chattinessBonus = ['excited', 'euphoric', 'playful', 'flirty', 'curious'].includes(currentMood.currentMood);
  const spamThreshold = chattinessBonus ? 20000 : 30000;
  
  if (timeSinceLastReply < spamThreshold && refDetection.confidence < (0.6 / moodModifier)) {
    return { engage: false, confidence: 0, reason: 'anti_spam' };
  }
  
  // Channel cooldown for low-confidence interactions (adjusted by mood)
  const channelKey = chanKey(guildId, channelId);
  const lastChannelReply = mem.lastReplyChannel?.[channelKey] || 0;
  const channelCooldown = Date.now() - lastChannelReply;
  const channelThreshold = chattinessBonus ? 30000 : 45000;
  
  if (channelCooldown < channelThreshold && refDetection.confidence < (0.5 / moodModifier)) {
    return { engage: false, confidence: 0, reason: 'channel_cooldown' };
  }
  
  // Respect current silence window
  if (isSilenced(mem, guildId, channelId, userId)) {
    return { engage: false, confidence: 0, reason: 'silenced' };
  }
  
  return { engage: false, confidence: 0, reason: 'no_trigger' };
}

function determineResponseTiming(messageData, userMem, conversationContext, currentMood) {
  let baseDelay = RESPONSE_DELAY_BASE;
  let variation = RESPONSE_DELAY_VARIATION;
  
  // Mood-based timing adjustments
  const moodTimingModifiers = {
    excited: 0.6,      // Respond faster when excited
    euphoric: 0.5,     // Even faster when euphoric
    anxious: 1.3,      // Slower when anxious (processing)
    overwhelmed: 1.5,  // Much slower when overwhelmed
    sad: 1.2,          // Slightly slower when sad
    melancholic: 1.1,  // Contemplative pace
    playful: 0.7,      // Quick and fun
    flirty: 0.8,       // Slightly delayed for effect
    protective: 0.6,   // Quick to defend/support
    contemplative: 1.4, // Takes time to think
    thoughtful: 1.3,   // Careful responses
    exhausted: 2.0     // Very slow when tired
  };
  
  const moodModifier = moodTimingModifiers[currentMood.currentMood] || 1.0;
  baseDelay *= moodModifier;
  variation *= moodModifier;
  
  // Faster responses for emotional situations
  if (messageData.emotions?.sadness || messageData.emotions?.frustration) {
    if (currentMood.currentMood === 'supportive' || currentMood.currentMood === 'protective') {
      baseDelay = Math.min(baseDelay, 400);
      variation = Math.min(variation, 600);
    }
  }
  
  // Faster for excitement/celebration (if bot is also excited)
  if (messageData.emotions?.excitement || messageData.emotions?.happiness) {
    if (currentMood.currentMood === 'excited' || currentMood.currentMood === 'happy') {
      baseDelay = Math.min(baseDelay, 300);
      variation = Math.min(variation, 500);
    }
  }
  
  // Owner gets priority timing (but still affected by mood)
  if (userMem.isOwner) {
    baseDelay = Math.min(baseDelay, 500);
    variation = Math.min(variation, 700);
  }
  
  return Math.max(200, baseDelay + Math.random() * variation); // Minimum 200ms
}

// --- Advanced Follow-up System with Mood ---
function shouldAddFollowUp(intent, messageData, conversationContext, userMem, history, currentMood, expectReply) {
  // If we're waiting for the user's reply, do not add a follow-up
  if (expectReply) return false;
  // Don't stack follow-ups too quickly
  const recentBotMessages = history.filter(entry => entry.isBot).slice(0, 2);
  if (recentBotMessages.length > 0) {
    const timeSinceLastBot = Date.now() - recentBotMessages[0].timestamp;
    if (timeSinceLastBot < 20000) return false; // 20 second cooldown
  }
  
  // Mood-based follow-up likelihood
  const moodFollowUpRates = {
    excited: 0.85,
    euphoric: 0.9,
    curious: 0.9,
    happy: 0.75,
    playful: 0.8,
    flirty: 0.7,
    supportive: 0.85,
    protective: 0.8,
    thoughtful: 0.7,
    contemplative: 0.6,
    sad: 0.4,
    melancholic: 0.3,
    overwhelmed: 0.2,
    anxious: 0.4,
    exhausted: 0.1
  };
  
  let baseRate = moodFollowUpRates[currentMood.currentMood] || 0.45;
  
  // Higher chance for emotional situations
  if (messageData.emotions?.sadness || messageData.emotions?.frustration) {
    if (currentMood.currentMood === 'supportive' || currentMood.currentMood === 'protective') {
      baseRate = Math.max(baseRate, 0.85);
    }
  }
  
  // Good chance for excitement/stories
  if (messageData.emotions?.excitement || messageData.patterns?.storytelling) {
    if (currentMood.currentMood === 'excited' || currentMood.currentMood === 'curious') {
      baseRate = Math.max(baseRate, 0.8);
    }
  }
  
  // Medium chance for advice-seeking
  if (messageData.patterns?.seeking_advice || messageData.patterns?.sharing_opinion) {
    if (currentMood.currentMood === 'thoughtful' || currentMood.currentMood === 'supportive') {
      baseRate = Math.max(baseRate, 0.7);
    }
  }
  
  // Owner gets more follow-ups
  if (userMem.isOwner) {
    baseRate = Math.min(1.0, baseRate * 1.3);
  }
  
  return Math.random() < baseRate;
}

function calculateFollowUpDelay(messageData, userMem, currentMood) {
  let baseDelay = FOLLOW_UP_MIN_DELAY;
  let maxDelay = FOLLOW_UP_MAX_DELAY;
  
  // Mood-based follow-up timing
  const moodDelayModifiers = {
    excited: 0.6,
    euphoric: 0.5,
    curious: 0.7,
    playful: 0.8,
    anxious: 1.5,
    overwhelmed: 2.0,
    exhausted: 3.0,
    contemplative: 1.2,
    thoughtful: 1.1
  };
  
  const modifier = moodDelayModifiers[currentMood.currentMood] || 1.0;
  baseDelay *= modifier;
  maxDelay *= modifier;
  
  // Faster for emotional support
  if (messageData.emotions?.sadness && currentMood.currentMood === 'supportive') {
    baseDelay = Math.min(baseDelay, 2000);
    maxDelay = Math.min(maxDelay, 4000);
  }
  
  // Faster for excitement matching
  if (messageData.emotions?.excitement && currentMood.currentMood === 'excited') {
    baseDelay = Math.min(baseDelay, 1500);
    maxDelay = Math.min(maxDelay, 3500);
  }
  
  // Owner gets faster follow-ups
  if (userMem.isOwner) {
    baseDelay = Math.min(baseDelay, 2500);
    maxDelay = Math.min(maxDelay, 5000);
  }
  
  return Math.max(1000, baseDelay + Math.random() * (maxDelay - baseDelay));
}

// --- Silence helpers (respect "stop" etc.) ---
function silenceKey(guildId, channelId, userId) {
  return `${guildId || 'dm'}:${channelId || 'dm'}:${userId || 'unknown'}`;
}

function isHardStop(content) {
  const lower = (content || '').toLowerCase();
  return /(\bfloof\s+)?(stop|stfu|shut\s*up|be\s*quiet|silence)\b/.test(lower) || /^(?:no|bye)\b/.test(lower);
}

function setSilence(mem, guildId, channelId, userId, ms) {
  mem.silenceMap = mem.silenceMap || {};
  mem.silenceMap[silenceKey(guildId, channelId, userId)] = Date.now() + (ms || STOP_SILENCE_MS);
}

function isSilenced(mem, guildId, channelId, userId) {
  const key = silenceKey(guildId, channelId, userId);
  const until = (mem.silenceMap || {})[key] || 0;
  if (!until) return false;
  if (Date.now() > until) { delete mem.silenceMap[key]; return false; }
  return true;
}

// --- Smart Reply System ---
async function replySmart(message, text, delay = null) {
  if (!text) return;
  if (typeof text === 'string' && text.toLowerCase().includes('nuke')) {
    text = "Let's not talk about that.";
  }
  
  try { 
    await message.channel?.sendTyping(); 
  } catch {}
  
  const actualDelay = delay || (RESPONSE_DELAY_BASE + Math.random() * RESPONSE_DELAY_VARIATION);
  await new Promise(r => setTimeout(r, actualDelay));
  
  await message.channel?.send({ 
    content: text, 
    allowedMentions: { repliedUser: false } 
  });
}

function replyFollowUp(message, text, delay) {
  if (!text) return;
  setTimeout(() => {
    if (typeof text === 'string' && text.toLowerCase().includes('nuke')) return;
    message.channel?.send({ 
      content: text, 
      allowedMentions: { repliedUser: false } 
    }).catch(() => {});
  }, delay);
}

// --- Enhanced Intent Detection ---
function detectAdvancedIntent(lowerText, messageData, conversationContext, userMem) {
  const baseIntent = {
    // Basic intents
    greet: /\b(hi|hello|hey|yo|hiya|sup|morning|afternoon|evening)\b/.test(lowerText),
    bye: /\b(bye|gn|good\s*night|see\s*ya|later|peace|ttyl)\b/.test(lowerText),
    thanks: /\b(thanks|ty|thank\s*you|appreciate|grateful)\b/.test(lowerText),
    love: /\b(love\s*you|ily|luv\s*u|adore|care\s*about)\b/.test(lowerText),
    
    // Emotional intents
    sad: messageData.emotions?.sadness || false,
    frustrated: messageData.emotions?.frustration || false,
    excited: messageData.emotions?.excitement || false,
    happy: messageData.emotions?.happiness || false,
    confused: messageData.emotions?.confusion || false,
    grateful: messageData.emotions?.gratitude || false,
    anxious: messageData.emotions?.anxiety || false,
    angry: messageData.emotions?.anger || false,
    playful: messageData.emotions?.playfulness || false,
    
    // Conversational patterns
    storytelling: messageData.patterns?.storytelling || false,
    seekingAdvice: messageData.patterns?.seeking_advice || false,
    sharingOpinion: messageData.patterns?.sharing_opinion || false,
    askingPermission: messageData.patterns?.asking_permission || false,
    makingPlans: messageData.patterns?.making_plans || false,
    celebrating: messageData.patterns?.celebrating || false,
    complaining: messageData.patterns?.complaining || false,
    flirting: messageData.patterns?.flirting || false,
    teasing: messageData.patterns?.teasing || false,
    
    // Question types
    hasQuestion: /\?/.test(lowerText),
    askingOpinion: /\b(what\s+do\s+you\s+think|opinion|thoughts|take\s+on)\b/.test(lowerText),
    askingAdvice: /\b(what\s+should\s+i|advice|recommend|suggest|help\s+me)\b/.test(lowerText),
    askingAboutBot: /\b(how\s+are\s+you|what\s+are\s+you|who\s+are\s+you|what\s+can\s+you)\b/.test(lowerText),
    
    // Social cues
    needsSupport: /\b(support|comfort|listen|understand|here\s+for\s+me)\b/.test(lowerText),
    wantsToVent: /\b(vent|frustrated|annoyed|pissed|angry|mad)\b/.test(lowerText),
    sharingSomething: /\b(guess\s+what|check\s+this|look\s+at|see\s+this)\b/.test(lowerText),
    
    // Engagement patterns
    continuingConversation: false, // Will be set based on context
    respondingToQuestion: false,  // Will be set based on context
    changingSubject: false,       // Will be set based on context
  };
  
  // Context-based intent enhancement
  if (conversationContext.length > 0) {
    const lastBotMessage = conversationContext.find(entry => entry.isBot);
    if (lastBotMessage) {
      if (lastBotMessage.content.includes('?')) {
        baseIntent.respondingToQuestion = true;
      }
      
      const timeSince = Date.now() - lastBotMessage.timestamp;
      if (timeSince < 300000) { // 5 minutes
        baseIntent.continuingConversation = true;
      }
    }
  }
  
  // Topic shift detection
  const currentTopics = messageData.topics || [];
  const recentTopics = conversationContext
    .slice(1, 4)
    .flatMap(entry => entry.topics || []);
  
  const topicOverlap = currentTopics.filter(topic => recentTopics.includes(topic));
  if (currentTopics.length > 0 && topicOverlap.length === 0) {
    baseIntent.changingSubject = true;
  }
  
  return baseIntent;
}

// --- MAIN ENHANCED HANDLER WITH MOOD SYSTEM ---
async function handleFloofConversation(message) {
  try {
    if (!message || !message.content) return false;
    if (message.author.bot) return false;
    if (!message.guild || message.guild.id !== TARGET_GUILD_ID) return false;

    const content = message.content.trim();
    const lower = content.toLowerCase();
    const gid = message.guild?.id || null;
    const cid = message.channel?.id || null;
    const uid = message.author.id;
    const k = keyFor(gid, uid);
    const ck = chanKey(gid, cid);
    const isOwner = !!OWNER_ID && uid === OWNER_ID;

    // Load memory and analyze message
    const mem = await loadMemory();
    const messageData = {
      content,
      emotions: analyzeEmotions(content),
      topics: analyzeTopics(content),
      patterns: analyzePatterns(content)
    };

    // Add to history and get context
    addToChannelHistory(mem, gid, cid, message);
    const history = getChannelHistory(mem, gid, cid);
    const conversationContext = getConversationContext(mem, gid, cid, uid);

    // Update user memory and profiles
    mem.lastSeen = mem.lastSeen || {};
    mem.lastSeen[k] = Date.now();
    const userMem = getUserMem(mem, gid, uid);
    userMem.isOwner = isOwner;
    updatePersonalityProfile(mem, gid, uid, messageData);
    updateEmotionalContext(mem, gid, uid, messageData.emotions);

    // --- Turn-taking: initialize and clear expectReply on user's next message ---
    mem.conversationState = mem.conversationState || {};
    const state = mem.conversationState[k] || { expectReply: false };
    // If Floof was waiting for a reply, the user's message fulfills it; clear flag
    if (state.expectReply) state.expectReply = false;
    mem.conversationState[k] = state;

    // Respect explicit stop: set silence and do not reply
    if (isHardStop(content)) {
      setSilence(mem, gid, cid, uid, STOP_SILENCE_MS);
      await saveMemory(mem);
      return false;
    }
    
    // If currently silenced for this user/channel, do not engage
    if (isSilenced(mem, gid, cid, uid)) {
      await saveMemory(mem);
      return false;
    }

    // ===== MOOD SYSTEM INTEGRATION =====
    const currentMood = getCurrentMood(mem, gid, uid);
    const intent = detectAdvancedIntent(lower, messageData, conversationContext, userMem);
    
    // Generate mood triggers
    const triggers = generateMoodTriggers(messageData, intent, conversationContext, userMem, isOwner);
    
    // Update mood based on current interaction
    const timeOfDay = getTimeOfDay();
    const userAffinity = getUserAffinityLevel(userMem.affinity || 0);
    const emotionalContext = getEmotionalContext(messageData, conversationContext);
    
    updateMoodFromTriggers(currentMood, triggers, emotionalContext, userAffinity, timeOfDay);
    
    // Advanced detection and decision making (now with mood)
    const refDetection = detectAdvancedReference(message, history, message.client.user);
    const engagementDecision = shouldEngageInConversation(message, history, refDetection, userMem, mem, currentMood);
    
    if (!engagementDecision.engage) {
      await saveMemory(mem);
      return false;
    }

    // Generate response with full context including mood
    let response = generateNaturalResponse(intent, userMem, messageData, conversationContext, isOwner, history, currentMood);

    // Repetition guard: avoid repeating the most recent bot message in this channel
    const lastBotInHistory = history.find(entry => entry.isBot)?.content || '';
    if (response && lastBotInHistory && response.trim() === lastBotInHistory.trim()) {
      // Try alternate fallbacks up to 3 attempts
      let attempts = 3;
      while (attempts-- > 0) {
        const alt = pick(ALT_FALLBACKS);
        if (alt && alt.trim() !== lastBotInHistory.trim()) { response = alt; break; }
      }
      if (response.trim() === lastBotInHistory.trim()) {
        response = response + ' .';
      }
    }
    
    // Handle behavioral updates (strikes, affinity) with mood influence
    if (intent.frustrated || intent.complaining || intent.angry) {
      if (!isOwner) {
        userMem.strikes = (userMem.strikes || 0) + 1;
        userMem.affinity = Math.max(-100, (userMem.affinity || 0) - 3);
      }
      // Mood might make bot more or less tolerant
      if (currentMood.currentMood === 'sassy') {
        // Might be less affected by complaints
      } else if (currentMood.currentMood === 'sad' || currentMood.currentMood === 'overwhelmed') {
        // Might be more affected
        if (!isOwner) userMem.affinity -= 1;
      }
    } else if (intent.grateful || intent.love || intent.happy || intent.playful) {
      userMem.affinity = Math.min(100, (userMem.affinity || 0) + 2);
      // Positive interactions might boost mood further
      if (currentMood.currentMood === 'happy' || currentMood.currentMood === 'content') {
        userMem.affinity += 1; // Extra boost
      }
    }

    // Determine response timing with mood consideration
    const responseDelay = determineResponseTiming(messageData, userMem, conversationContext, currentMood);

    // Set expectReply if Floof asked a question; persist promptly
    state.expectReply = /\?\s*$/.test(response || '');
    mem.conversationState[k] = state;
    await saveMemory(mem);
    
    // Track metrics and memory
    mem.lastReply = mem.lastReply || {};
    mem.lastReply[k] = Date.now();
    mem.lastReplyChannel = mem.lastReplyChannel || {};
    mem.lastReplyChannel[ck] = Date.now();
    
    // Update engagement metrics
    if (!mem.engagementMetrics[k]) mem.engagementMetrics[k] = { responses: 0, topics: [], lastActive: 0 };
    mem.engagementMetrics[k].responses += 1;
    mem.engagementMetrics[k].lastActive = Date.now();
    mem.engagementMetrics[k].topics = [...new Set([...mem.engagementMetrics[k].topics, ...messageData.topics])];

    await saveMemory(mem);
    
    // Send main response
    await replySmart(message, response, responseDelay);

    // Add follow-up if appropriate (with mood consideration)
    if (shouldAddFollowUp(intent, messageData, conversationContext, userMem, history, currentMood, state.expectReply)) {
      const followUp = getMoodBasedFollowUp(currentMood, intent, messageData, isOwner, conversationContext);
      if (followUp) {
        const followUpDelay = calculateFollowUpDelay(messageData, userMem, currentMood);
        replyFollowUp(message, followUp, followUpDelay);
      }
    }

    // Update memory with bot's response
    setTimeout(async () => {
      try {
        const updatedMem = await loadMemory();
        addToChannelHistory(updatedMem, gid, cid, {
          author: { id: message.client.user.id, username: 'Floof', bot: true },
          content: response,
          timestamp: Date.now()
        });
        await saveMemory(updatedMem);
      } catch (e) {
        console.error('Error updating bot response in memory:', e);
      }
    }, responseDelay + 500);

    return true;

  } catch (e) {
    console.error('Enhanced Floof conversation error:', e);
    return false;
  }
}

module.exports = { handleFloofConversation };