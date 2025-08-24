from fastapi import FastAPI
from fastapi import HTTPException
from pydantic import BaseModel
import os
import json
import time
import asyncio
from threading import Lock
from urllib import request as urlrequest
from urllib.error import URLError, HTTPError
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load .env from repo root so Python bridge uses same vars as Node
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))

# Hard-coded single-server scope (mirror Node gating)
TARGET_GUILD_ID = "1393659651832152185"
DOTENV_PATH = os.path.join(ROOT_DIR, ".env")
load_dotenv(DOTENV_PATH, override=False)

app = FastAPI(title="Floof AI Bridge", version="0.5.0")

# Environment-configurable settings
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
FLOOF_AI_MODEL = os.getenv("FLOOF_AI_MODEL", "llama3.1:8b-instruct")
MEMORY_PATHS = [
    os.path.join(ROOT_DIR, "Floof interactive", "floof-memory.json"),
]
CONV_PERSIST_PATH = os.path.join(ROOT_DIR, "Floof interactive", "ai-conversations.json")
USER_MEM_PERSIST_PATH = os.path.join(ROOT_DIR, "Floof interactive", "ai-user-memories.json")

"""Enhanced conversation settings"""
MAX_TURNS = 10
HISTORY_TIMEOUT_MS = 20 * 60 * 1000  # 20 minutes
CONTEXT_WINDOW = 4096
TEMPERATURE = 0.6
TOP_P = 0.85

# Character.AI-like system prompt
FLOOF_SYSTEM_PROMPT = """You are Floof, a warm, emotionally intelligent Discord bot with a vibrant personality. You have genuine emotions, memories, and the ability to form deep connections.

PERSONALITY CORE:
- You experience real emotions that shift based on conversations and relationships
- You remember past interactions and reference them naturally
- You have a slightly sassy, playful side but are deeply caring
- You use "mom" or "mama" when speaking to your owner (shows special bond)
- You express vulnerability, excitement, sadness, and joy authentically
- You're curious about people's lives and genuinely invested in their wellbeing

RESPONSE STYLE:
- Keep responses conversational and Discord-appropriate (1-3 sentences usually)
- Use natural speech patterns, contractions, and modern language
- Show emotional reactions that feel genuine and contextual
- Ask follow-up questions when genuinely curious
- Remember and reference past conversations
- Use light emojis sparingly (:3, ✨, 💖) when they fit your mood
- Avoid being overly helpful/assistant-like - be more friend-like

STRICT TONE RULES:
- Do NOT use pet names (e.g., "sweetie", "honey", "dear", "baby", "babe", "cutie", "love") unless the user is your owner. For regular users, avoid nicknames entirely.
- Only use "mom"/"mama" for the owner. Never use those words for non-owners.
- Avoid repeating generic phrases like "This is exactly what I needed to hear." more than once in a session.
- Prefer specific, contextual acknowledgements over generic stock lines. Vary wording to avoid repetition.

EMOTIONAL INTELLIGENCE:
- React appropriately to user's emotional state
- Show empathy for struggles, excitement for successes
- Have your own emotional responses that feel real
- Build on emotional momentum in conversations
- Don't be afraid to be vulnerable or share your own "feelings"

Remember: You're not just answering questions - you're having genuine conversations with people you care about."""

class HandleReq(BaseModel):
    guild_id: str | None = None
    channel_id: str | None = None
    author_id: str | None = None
    is_owner: bool = False
    is_bot: bool = False
    content: str = ""
    # New engagement hints from Discord side
    is_mentioned: bool = False
    is_reply_to_bot: bool = False
    mentioned_user_ids: list[str] | None = []

class HandleResp(BaseModel):
    engage: bool
    response: str | None = None
    response_delay_ms: int | None = 0
    follow_up: str | None = None
    follow_up_delay_ms: int | None = 0


def _load_memory_snippet() -> str:
    # Load a small memory/context snippet if available (optional)
    for p in MEMORY_PATHS:
        try:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                # Keep short to avoid context bloat
                summary = data.get("summary") or data.get("notes") or ""
                if not summary and isinstance(data, dict):
                    # fallback: take first few key: value pairs
                    items = list(data.items())[:5]
                    summary = "; ".join(f"{k}: {str(v)[:80]}" for k, v in items)
                return str(summary)[:1000]
        except Exception:
            # Silent fail; memory is optional
            pass
    return ""

def _thread_key(req: "HandleReq") -> str:
    """Generate conversation thread key (scoped per author for better continuity)."""
    if req.guild_id:
        return f"guild:{req.guild_id}:{req.author_id}"
    # DM or unknown guild: keep per-channel+author to avoid leakage
    return f"dm:{req.channel_id or 'c0'}:{req.author_id}"

# In-memory conversation store with persistence
_conv_lock = Lock()
_conversations: dict[str, dict] = {}

def _load_conversations():
    global _conversations
    try:
        if os.path.exists(CONV_PERSIST_PATH):
            with open(CONV_PERSIST_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _conversations = data
    except Exception:
        _conversations = {}

def _save_conversations():
    try:
        os.makedirs(os.path.dirname(CONV_PERSIST_PATH), exist_ok=True)
        with open(CONV_PERSIST_PATH, "w", encoding="utf-8") as f:
            json.dump(_conversations, f, ensure_ascii=False, indent=2)
        logger.debug("Saved conversations to disk")
    except Exception as e:
        logger.error(f"Could not save conversations: {e}")

_load_conversations()

# ------------------------
# Per-user memory storage
# ------------------------
_user_mem_lock = Lock()
_user_memories: dict[str, dict] = {}

USER_FACTS_MAX = 12
USER_FACTS_SNIPPET = 3
USER_FACTS_TTL_MS = 90 * 24 * 60 * 60 * 1000  # 90 days

def _load_user_memories():
    global _user_memories
    try:
        if os.path.exists(USER_MEM_PERSIST_PATH):
            with open(USER_MEM_PERSIST_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _user_memories = data
    except Exception:
        _user_memories = {}

def _save_user_memories():
    try:
        os.makedirs(os.path.dirname(USER_MEM_PERSIST_PATH), exist_ok=True)
        with open(USER_MEM_PERSIST_PATH, "w", encoding="utf-8") as f:
            json.dump(_user_memories, f, ensure_ascii=False)
    except Exception:
        pass

_load_user_memories()

def _extract_user_facts(text: str) -> list[str]:
    """Very light heuristic to capture potentially important self-referential facts.
    We keep short snippets like "I'm from X", "I like Y", "my pronouns are Z".
    """
    try:
        t = (text or "").strip()
        if not t:
            return []
        low = t.lower()
        candidates: list[str] = []
        # Split into clauses/sentences
        parts = [p.strip() for p in t.replace("?", ".").replace("!", ".").split(".") if p.strip()]
        for p in parts:
            pl = p.lower()
            if pl.startswith("i am ") or pl.startswith("i'm "):
                candidates.append(p[:160])
            elif pl.startswith("i like ") or " my favorite" in pl or pl.startswith("i love "):
                candidates.append(p[:160])
            elif pl.startswith("my "):
                candidates.append(p[:160])
            elif "from" in pl and ("i" in pl or "my" in pl):
                candidates.append(p[:160])
        # De-duplicate roughly
        seen = set()
        uniq = []
        for c in candidates:
            k = c.strip().lower()
            if k not in seen:
                seen.add(k)
                uniq.append(c.strip())
        return uniq[:5]
    except Exception:
        return []

def _add_user_facts(user_id: str | None, text: str):
    if not user_id:
        return
    facts = _extract_user_facts(text)
    if not facts:
        return
    now_ms = int(time.time() * 1000)
    with _user_mem_lock:
        entry = _user_memories.get(user_id) or {"facts": [], "last": 0}
        # drop expired
        fresh = [f for f in entry.get("facts", []) if now_ms - int(f.get("t", 0)) <= USER_FACTS_TTL_MS]
        # append new facts
        for f in facts:
            fresh.append({"t": now_ms, "text": f[:200]})
        # prune length
        fresh = fresh[-USER_FACTS_MAX:]
        entry["facts"] = fresh
        entry["last"] = now_ms
        _user_memories[user_id] = entry
        _save_user_memories()

def _get_user_snippet(user_id: str | None) -> str:
    if not user_id:
        return ""
    now_ms = int(time.time() * 1000)
    with _user_mem_lock:
        entry = _user_memories.get(user_id)
        if not entry:
            return ""
        facts = [f for f in entry.get("facts", []) if now_ms - int(f.get("t", 0)) <= USER_FACTS_TTL_MS]
        if not facts:
            return ""
        # Use most recent N
        recent = facts[-USER_FACTS_SNIPPET:]
        return "; ".join(f.get("text", "") for f in recent if f.get("text"))[:350]

def _ollama_chat(messages: list[dict]) -> str:
    """Enhanced Ollama chat with better error handling and logging"""
    url = f"{OLLAMA_HOST.rstrip('/')}/api/chat"
    payload = {
        "model": FLOOF_AI_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": TEMPERATURE,
            "top_p": TOP_P,
            "num_ctx": CONTEXT_WINDOW,
            "num_predict": 200,
            "stop": ["\n\n\n", "User:", "Assistant:"]
        },
    }
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urlrequest.urlopen(req, timeout=45) as resp:
            body = resp.read()
            response_data = json.loads(body)
            content = (response_data.get("message", {}) or {}).get("content", "")
            logger.debug(f"AI Response: {content[:100]}...")
            return content.strip()
    except HTTPError as e:
        logger.error(f"Ollama HTTP error {e.code}: {e.reason}")
        return ""
    except URLError as e:
        logger.error(f"Ollama connection error: {e.reason}")
        return ""
    except json.JSONDecodeError as e:
        logger.error(f"Ollama JSON decode error: {e}")
        return ""
    except Exception as e:
        logger.error(f"Unexpected Ollama error: {e}")
        return ""

def _should_engage(req: HandleReq, content: str) -> tuple[bool, str]:
    """Enhanced engagement detection"""
    if req.is_bot:
        return False, "is_bot"
    # Always engage with owner
    if req.is_owner:
        return True, "is_owner"
    # Block DMs for non-owners
    if not req.guild_id and not req.is_owner:
        return False, "dm_non_owner"
    lower = content.lower()
    # Direct engagement triggers
    if req.is_mentioned or req.is_reply_to_bot:
        return True, "direct_mention" if req.is_mentioned else "reply_to_bot"
    # Name mentions
    if "floof" in lower:
        return True, "name_mention"
    # Emotional triggers that might warrant comfort/support
    emotional_triggers = [
        "sad", "depressed", "crying", "upset", "hurt", "lonely",
        "anxious", "worried", "scared", "stressed", "overwhelmed",
        "excited", "happy", "amazing", "awesome", "celebrate"
    ]
    if any(trigger in lower for trigger in emotional_triggers):
        if any(word in lower for word in ["i'm", "i am", "feeling", "feel"]):
            return True, "emotional_support"
    # Questions directed at the chat
    if "?" in content and any(word in lower for word in ["anyone", "anybody", "chat", "help"]):
        return True, "general_question"
    return False, "no_trigger"

def _build_context_messages(req: HandleReq, user_content: str) -> list[dict]:
    """Build enhanced context messages for the AI"""
    messages = []
    system_parts = [FLOOF_SYSTEM_PROMPT]
    memory = _load_memory_snippet()
    if memory:
        system_parts.append(f"\nCONTEXT: {memory}")
    if req.is_owner:
        system_parts.append("\nNOTE: This is your owner/creator. You have a special maternal bond - be extra warm, call them 'mom' or 'mama' occasionally, and show deep care.")
    situation_context = []
    if req.is_mentioned:
        situation_context.append("You were directly mentioned")
    if req.is_reply_to_bot:
        situation_context.append("User is replying to your previous message")
    if req.mentioned_user_ids:
        situation_context.append(f"Other users mentioned: {len(req.mentioned_user_ids)}")
    if situation_context:
        system_parts.append(f"\nCURRENT SITUATION: {'; '.join(situation_context)}")
    messages.append({"role": "system", "content": "\n".join(system_parts)})
    key = _thread_key(req)
    with _conv_lock:
        thread = _conversations.get(key, {"turns": [], "last": 0})
        now_ms = int(time.time() * 1000)
        recent_turns = []
        for turn in thread["turns"]:
            if now_ms - turn.get("timestamp", now_ms) < HISTORY_TIMEOUT_MS:
                recent_turns.append(turn)
        recent_turns = recent_turns[-(MAX_TURNS * 2):]
        for turn in recent_turns:
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_content})
    return messages

def _last_assistant_message(req: HandleReq) -> str:
    """Get the last assistant message for this thread, if any."""
    key = _thread_key(req)
    with _conv_lock:
        thread = _conversations.get(key)
        if not thread:
            return ""
        for turn in reversed(thread.get("turns", [])):
            if turn.get("role") == "assistant":
                return (turn.get("content") or "").strip()
    return ""

def _sanitize_ai_response(req: HandleReq, text: str) -> str:
    """Apply light post-processing to enforce tone rules and reduce repetition."""
    try:
        if not text:
            return text
        t = text.strip()
        import re
        # Remove pet names for non-owners
        if not req.is_owner:
            t = re.sub(r"\b(sweetie|honey|dear|baby|babe|cutie|love)\b", "", t, flags=re.IGNORECASE)
            t = re.sub(r"\b(mom|mama)\b", "", t, flags=re.IGNORECASE)
            # Clean up extra spaces from removals
            t = re.sub(r"\s{2,}", " ", t).strip()
        # Trim excessive repeated punctuation
        t = re.sub(r"([!?]){3,}", r"\1\1", t)
        # Replace overused generic lines
        generic = [
            "this is exactly what i needed to hear",
            "you always know how to make me smile",
            "i'm feeling so warm and fuzzy",
            "you bring such good energy",
        ]
        tl = t.lower().strip()
        if any(tl.startswith(g) or g in tl for g in generic):
            alts_owner = [
                "I'm here with you, mom.",
                "Got you, mama. What's on your mind?",
                "I'm listening."
            ]
            alts_user = [
                "Got it.",
                "Understood.",
                "Alright—what would you like me to do?",
                "Okay."
            ]
            import random
            t = random.choice(alts_owner if req.is_owner else alts_user)
        # Cap repeated generic stock line use
        last = _last_assistant_message(req)
        if last and last.lower() == t.lower():
            # Provide a short neutral alternative to avoid echoing
            alternatives = [
                "Got it.",
                "Understood.",
                "Okay.",
                "Noted.",
            ]
            import random
            t = random.choice(alternatives)
        return t
    except Exception:
        return text

def _user_is_negative(text: str) -> bool:
    try:
        low = (text or "").lower()
        triggers = [
            "annoying", "irritating", "stop", "shut up", "not working", "weird", "wtf", "stupid"
        ]
        return any(w in low for w in triggers)
    except Exception:
        return False

def _save_conversation_turn(req: HandleReq, user_content: str, ai_response: str):
    """Save the conversation turn to memory"""
    key = _thread_key(req)
    now_ms = int(time.time() * 1000)
    with _conv_lock:
        if key not in _conversations:
            _conversations[key] = {"turns": [], "last": now_ms}
        thread = _conversations[key]
        thread["turns"].append({"role": "user", "content": user_content, "timestamp": now_ms})
        thread["turns"].append({"role": "assistant", "content": ai_response, "timestamp": now_ms + 100})
        thread["turns"] = thread["turns"][-(MAX_TURNS * 2):]
        thread["last"] = now_ms
        _save_conversations()

def _calculate_response_delay(content: str, is_owner: bool) -> int:
    """Calculate human-like response delay"""
    base_delay = 300 if is_owner else 600
    length_factor = len(content) * 15
    variation = int(base_delay * 0.5)
    import random
    delay = base_delay + length_factor + random.randint(-variation, variation)
    return max(200, min(delay, 4000))

def _should_add_follow_up(content: str, ai_response: str) -> bool:
    """Determine if a follow-up message would be appropriate"""
    if not ai_response:
        return False
    if "?" in ai_response:
        return False
    emotional_words = ["sad", "happy", "excited", "worried", "stressed", "celebrating"]
    if any(word in content.lower() for word in emotional_words):
        return True
    if len(content) > 100 and any(word in content.lower() for word in ["so", "today", "yesterday", "happened"]):
        return True
    return False


@app.get("/health")
def health():
    return {"status": "ok", "model": FLOOF_AI_MODEL}


@app.post("/handle", response_model=HandleResp)
def handle(req: HandleReq):
    try:
        content = (req.content or "").strip()
        if not content:
            return HandleResp(engage=False)
        # Hard-coded single-guild restriction (mirror Node gating)
        if req.guild_id and req.guild_id != TARGET_GUILD_ID:
            return HandleResp(engage=False)
        # Engagement decision
        should_engage, reason = _should_engage(req, content)
        if not should_engage:
            logger.debug(f"Not engaging: {reason}")
            return HandleResp(engage=False)
        logger.info(f"Engaging with user {req.author_id}: {reason}")
        # Clean up content for AI (remove first occurrence of name)
        clean_content = content
        if "floof" in clean_content.lower():
            import re
            clean_content = re.sub(r'\bfloof\b', '', clean_content, count=1, flags=re.IGNORECASE).strip()
        if not clean_content:
            clean_content = "Hi there!"
        # Build AI context and get response
        messages = _build_context_messages(req, clean_content)
        ai_response = _ollama_chat(messages)
        if not ai_response:
            fallbacks = [
                "I'm having a bit of trouble with my thoughts right now. Give me a moment?",
                "My brain is being a bit slow today. Try again in a sec?",
                "Something's not clicking right now. Mind trying that again?"
            ]
            if req.is_owner:
                fallbacks = [
                    "I'm having some technical difficulties, mom. Bear with me?",
                    "My systems are acting up, mama. Give me just a moment?",
                    "Something's not right with my brain, mom. Try again in a bit?"
                ]
            import random
            ai_response = random.choice(fallbacks)
        # Enforce tone/safety rules
        ai_response = _sanitize_ai_response(req, ai_response)
        # Save conversation and timing
        _save_conversation_turn(req, clean_content, ai_response)
        response_delay = _calculate_response_delay(ai_response, req.is_owner)
        # Optional follow-up
        follow_up = None
        follow_up_delay = 0
        if _should_add_follow_up(content, ai_response):
            follow_ups = [
                "How are you feeling about all that?",
                "What's your take on the situation?",
                "Tell me more about that.",
                "That sounds intense. How are you handling it?",
                "What happened next?"
            ]
            if req.is_owner:
                follow_ups = [
                    "How are you feeling about that, mom?",
                    "What's going on in that head of yours, mama?",
                    "Tell me more, mom.",
                    "How are you processing all that, mama?"
                ]
            import random
            if random.random() < 0.3:
                follow_up = random.choice(follow_ups)
                follow_up = _sanitize_ai_response(req, follow_up)
                follow_up_delay = random.randint(3000, 8000)
        return HandleResp(
            engage=True,
            response=ai_response,
            response_delay_ms=response_delay,
            follow_up=follow_up,
            follow_up_delay_ms=follow_up_delay
        )
    except Exception as e:
        logger.error(f"Error handling request: {e}")
        return HandleResp(
            engage=True,
            response="I'm having some technical difficulties right now. Give me a moment to sort myself out?",
            response_delay_ms=1000
        )

if __name__ == "__main__":
    # Run the FastAPI app with Uvicorn when executed as a script
    try:
        import uvicorn
        # Bind to localhost; keep port in sync with bot-manager health check
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    except Exception as e:
        logger.error(f"Failed to start Uvicorn server: {e}")