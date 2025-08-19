const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Default auto moderation configuration (per-guild overrides will be merged)
const DEFAULT_AUTOMOD_CONFIG = {
    // Spam detection
    spam: {
        enabled: true,
        maxMessages: 5,        // Max messages in timeframe
        timeWindow: 5000,      // Time window in ms (5 seconds)
        // Dynamic mute settings
        muteTime: 300000,      // Backward-compat base mute (ms)
        muteBase: 300000,      // Base mute duration (ms) when threshold exceeded (default 5m)
        muteStep: 120000,      // Extra per message over the threshold (ms) (default +2m each)
        muteMax: 900000,       // Maximum mute duration cap (ms) (default 15m)
    },
    
    // Bad words filter (disabled)
    badWords: {
        enabled: false,
        words: [],
        action: 'delete',
    },
    
    // Excessive caps detection (disabled)
    caps: {
        enabled: false,
        threshold: 0.7,
        minLength: 10,
        action: 'warn',
    },
    
    // Discord invite link detection
    invites: {
        enabled: true,
        action: 'mute',        // default: 10m timeout
        muteTime: 600000,      // 10 minutes (ms)
        allowedDomains: [],    // Whitelist specific servers if needed
    },
    
    // Link protection (simple on/off with whitelist)
    links: {
        enabled: true,
        action: 'mute',        // default: 10m timeout
        muteTime: 600000,      // 10 minutes (ms)
        whitelist: []          // Array of user IDs allowed to send links
    },
    
    // Mention spam protection
    mentions: {
        enabled: true,
        maxMentions: 5,        // Max mentions per message
        action: 'delete',      // 'delete', 'warn', or 'mute'
    },
    
    // Similar message spam (4 similar messages in a row)
    similarSpam: {
        enabled: true,
        minRepeats: 4,        // Number of similar messages in a row to trigger
        action: 'warn'        // Action on detection
    },

    // Wall of text detection
    wallText: {
        enabled: true,
        maxLength: 1500,      // Characters threshold
        maxLines: 25,         // Lines threshold
        action: 'mute',
        muteTime: 300000      // 5 minutes (ms)
    }
};

// Helpers to load per-guild config from server-configs.json
const SERVER_CONFIG_PATH = path.join(process.cwd(), 'data', 'server-configs.json');

function readServerConfig() {
    try {
        if (!fs.existsSync(SERVER_CONFIG_PATH)) return {};
        const raw = fs.readFileSync(SERVER_CONFIG_PATH, 'utf8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/**
 * Check for wall of text (too many characters or lines)
 */
function checkWallText(message, config) {
    try {
        const content = message.content || '';
        const maxLen = config.wallText?.maxLength ?? 1500;
        const maxLines = config.wallText?.maxLines ?? 25;
        const lineCount = content.split('\n').length;

        if (content.length > maxLen || lineCount > maxLines) {
            return {
                type: 'wallText',
                violation: true,
                reason: content.length > maxLen
                    ? `Message too long (${content.length} > ${maxLen} chars)`
                    : `Too many lines (${lineCount} > ${maxLines})`,
                action: config.wallText.action || 'mute',
                duration: (config.wallText.action === 'mute') ? (config.wallText.muteTime || 300000) : undefined
            };
        }
        return { violation: false };
    } catch (_) {
        return { violation: false };
    }
}

function getGuildConfig(guildId) {
    const all = readServerConfig();
    return all[guildId] || {};
}

function deepMerge(defaults, overrides) {
    const out = { ...defaults };
    for (const key of Object.keys(overrides || {})) {
        const dv = defaults[key];
        const ov = overrides[key];
        if (dv && typeof dv === 'object' && !Array.isArray(dv) && ov && typeof ov === 'object' && !Array.isArray(ov)) {
            out[key] = deepMerge(dv, ov);
        } else {
            out[key] = ov;
        }
    }
    return out;
}

function getGuildAutomodConfig(guildId) {
    const cfg = getGuildConfig(guildId);
    const overrides = cfg.automod || {};
    return deepMerge(DEFAULT_AUTOMOD_CONFIG, overrides);
}

// Store user message history for spam detection
const userMessageHistory = new Map();

// Store user warnings
const userWarnings = new Map();

// Store last few normalized messages per user to detect similar-message spam
const userContentHistory = new Map(); // userId -> string[] (last 3 normalized messages)

// Moderation log channel is now per-guild via %config modlog

/**
 * Main auto moderation handler
 */
async function handleAutoModeration(message) {
    // Don't moderate bots or admins
    if (message.author.bot) return;
    if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    
    const guildConfig = getGuildAutomodConfig(message.guild.id);
    const violations = [];
    
    // Check for spam
    if (guildConfig.spam.enabled) {
        const spamResult = checkSpam(message, guildConfig);
        if (spamResult.isSpam) violations.push(spamResult);
    }

    // Check for similar message spam (4 in a row)
    if (guildConfig.similarSpam.enabled) {
        const similarResult = checkSimilarSpam(message, guildConfig);
        if (similarResult.violation) violations.push(similarResult);
    }
    
    // Check for bad words
    if (guildConfig.badWords.enabled) {
        const badWordResult = checkBadWords(message, guildConfig);
        if (badWordResult.violation) violations.push(badWordResult);
    }
    
    // Check for excessive caps
    if (guildConfig.caps.enabled) {
        const capsResult = checkExcessiveCaps(message, guildConfig);
        if (capsResult.violation) violations.push(capsResult);
    }
    
    // Check for Discord invite links
    if (guildConfig.invites.enabled) {
        const inviteResult = checkDiscordInvites(message, guildConfig);
        if (inviteResult.violation) violations.push(inviteResult);
    }
    
    // Check for link spam
    if (guildConfig.links.enabled) {
        const linkResult = checkLinkSpam(message, guildConfig);
        if (linkResult.violation) violations.push(linkResult);
    }

    // Check for mention spam
    if (guildConfig.mentions.enabled) {
        const mentionResult = checkMentionSpam(message, guildConfig);
        if (mentionResult.violation) violations.push(mentionResult);
    }

    // Check for wall of text
    if (guildConfig.wallText?.enabled) {
        const wallResult = checkWallText(message, guildConfig);
        if (wallResult.violation) violations.push(wallResult);
    }
    
    // Process violations
    if (violations.length > 0) {
        await processViolations(message, violations);
    }
}

/**
 * Check for similar message spam: if user sends N very similar messages in a row
 */
function checkSimilarSpam(message, config) {
    const userId = message.author.id;
    const normalize = (s) => (s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[`~!@#$%^&*()_+\-={}\[\]\\|;:'",.<>/?]/g, '')
        .trim();

    const current = normalize(message.content);
    if (!current) return { violation: false };

    const history = userContentHistory.get(userId) || [];
    // Track last (minRepeats-1) messages
    const keep = Math.max(1, (config.similarSpam.minRepeats || 4) - 1);
    const newHistory = [...history, current].slice(-keep);
    userContentHistory.set(userId, newHistory);

    // If all entries in newHistory equal current and we have reached keep length, it's a violation
    if (newHistory.length === keep && newHistory.every(x => x === current)) {
        return {
            type: 'similarSpam',
            violation: true,
            reason: `Similar message spam`,
            action: config.similarSpam.action || 'warn',
            duration: (config.similarSpam.action === 'mute')
                ? (config.similarSpam.muteTime || 300000)
                : undefined
        };
    }

    return { violation: false };
}

/**
 * Check for spam (rapid message sending)
 */
function checkSpam(message, config) {
    const userId = message.author.id;
    const now = Date.now();
    
    if (!userMessageHistory.has(userId)) {
        userMessageHistory.set(userId, []);
    }
    
    const userHistory = userMessageHistory.get(userId);
    
    // Add current message
    userHistory.push(now);
    
    // Remove old messages outside time window
    const cutoff = now - config.spam.timeWindow;
    const recentMessages = userHistory.filter(timestamp => timestamp > cutoff);
    userMessageHistory.set(userId, recentMessages);
    
    // Check if spam threshold exceeded
    if (recentMessages.length > config.spam.maxMessages) {
        const over = recentMessages.length - config.spam.maxMessages;
        const base = (config.spam.muteBase ?? config.spam.muteTime ?? 300000);
        const step = (config.spam.muteStep ?? 120000);
        const maxCap = (config.spam.muteMax ?? Math.max(base, 900000));
        let duration = base + Math.max(0, over) * step;
        if (duration > maxCap) duration = maxCap;
        return {
            type: 'spam',
            violation: true,
            isSpam: true,
            reason: `Sent ${recentMessages.length} messages in ${config.spam.timeWindow / 1000} seconds`,
            action: 'mute',
            duration,
            windowMs: config.spam.timeWindow
        };
    }
    
    return { isSpam: false };
}

/**
 * Check for bad words
 */
function checkBadWords(message, config) {
    const content = message.content.toLowerCase();
    const foundWords = (config.badWords.words || []).filter(word => 
        content.includes(word.toLowerCase())
    );
    
    if (foundWords.length > 0) {
        return {
            type: 'badWords',
            violation: true,
            reason: `Used prohibited words: ${foundWords.join(', ')}`,
            action: config.badWords.action,
            foundWords
        };
    }
    
    return { violation: false };
}

/**
 * Check for excessive caps
 */
function checkExcessiveCaps(message, config) {
    const content = message.content;
    
    if (content.length < config.caps.minLength) {
        return { violation: false };
    }
    
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return { violation: false };
    
    const caps = content.replace(/[^A-Z]/g, '');
    const capsRatio = caps.length / letters.length;
    
    if (capsRatio > config.caps.threshold) {
        return {
            type: 'caps',
            violation: true,
            reason: `Message is ${Math.round(capsRatio * 100)}% caps (limit: ${Math.round(config.caps.threshold * 100)}%)`,
            action: config.caps.action,
            capsRatio
        };
    }
    
    return { violation: false };
}

/**
 * Check for link spam
 */
function checkLinkSpam(message, config) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const links = message.content.match(urlRegex) || [];
    
    // Allow whitelisted users to post links when links module is enabled
    const wl = Array.isArray(config.links.whitelist) ? config.links.whitelist : [];
    if (wl.includes(message.author.id)) {
        return { violation: false };
    }

    // If links module is enabled and any links are present from non-whitelisted user -> violation
    if (config.links.enabled && links.length > 0) {
        return {
            type: 'linkSpam',
            violation: true,
            reason: `Posted ${links.length} link(s) (links are disabled for non-whitelisted users)`,
            action: config.links.action,
            duration: (config.links.action === 'mute') ? (config.links.muteTime || 600000) : undefined,
            linkCount: links.length
        };
    }
    
    return { violation: false };
}

/**
 * Check for Discord invite links
 */
function checkDiscordInvites(message, config) {
    // Discord invite patterns
    const invitePatterns = [
        /discord\.gg\/[a-zA-Z0-9]+/gi,
        /discordapp\.com\/invite\/[a-zA-Z0-9]+/gi,
        /discord\.com\/invite\/[a-zA-Z0-9]+/gi,
        /dsc\.gg\/[a-zA-Z0-9]+/gi
    ];
    
    const content = message.content;
    const foundInvites = [];
    
    // Check for invite patterns
    for (const pattern of invitePatterns) {
        const matches = content.match(pattern);
        if (matches) {
            foundInvites.push(...matches);
        }
    }
    
    if (foundInvites.length > 0) {
        return {
            type: 'discordInvites',
            violation: true,
            reason: `Posted Discord server invite links: ${foundInvites.join(', ')}`,
            action: config.invites.action,
            duration: (config.invites.action === 'mute') ? (config.invites.muteTime || 600000) : undefined,
            invites: foundInvites
        };
    }
    
    return { violation: false };
}

/**
 * Check for mention spam
 */
function checkMentionSpam(message, config) {
    const userMentions = message.mentions.users?.size || 0;
    const roleMentions = message.mentions.roles?.size || 0;
    const everyoneHere = message.mentions.everyone ? 1 : 0; // counts @everyone/@here
    const totalMentions = userMentions + roleMentions + everyoneHere;

    if (totalMentions >= config.mentions.maxMentions) {
        return {
            type: 'mentionSpam',
            violation: true,
            reason: `Posted ${totalMentions} mentions (limit: ${config.mentions.maxMentions})`,
            action: config.mentions.action,
            mentionCount: totalMentions
        };
    }
    
    return { violation: false };
}

// Delete prior spam messages from the same user within the spam window
async function cleanupSpamMessages(message, windowMs) {
    try {
        const now = Date.now();
        // Fetch recent messages (cap at 50 to limit API calls)
        const fetched = await message.channel.messages.fetch({ limit: 50 });
        const toDelete = fetched.filter(m =>
            m.author?.id === message.author.id &&
            (now - (m.createdTimestamp || 0)) <= windowMs &&
            m.id !== message.id
        );
        for (const [, msg] of toDelete) {
            try { await msg.delete(); } catch (_) {}
        }
    } catch (e) {
        console.log('Spam cleanup failed:', e.message);
    }
}

/**
 * Process violations and take appropriate action
 */
async function processViolations(message, violations) {
    const userId = message.author.id;
    
    // If spam detected, clean up prior messages within the spam window
    try {
        const spamV = violations.find(v => v.type === 'spam' && v.windowMs);
        if (spamV && spamV.windowMs) {
            await cleanupSpamMessages(message, spamV.windowMs);
        }
    } catch (_) {}
    
    // Always escalate: convert all violations to a timeout (mute) action
    const DEFAULT_TIMEOUT = 300000; // 5 minutes
    const escalated = violations.map(v => ({
        ...v,
        action: 'mute',
        duration: v.duration || DEFAULT_TIMEOUT
    }));

    // Delete message since we are timing out
    try {
        await message.delete();
    } catch (error) {
        console.log('Could not delete message:', error.message);
    }

    // Apply timeout (use the strongest/first violation for duration/reason)
    const primary = getPrimaryAction(escalated) || escalated[0];
    if (primary) {
        await muteUser(message.member, primary.duration || DEFAULT_TIMEOUT, primary.reason);
        // Clear tracked histories so future detection starts fresh post-timeout
        try {
            userMessageHistory.delete(userId);
            userContentHistory.delete(userId);
            userWarnings.delete(userId);
        } catch (_) {}
    }

    // Public notification in channel: only show timeout message
    try {
        if (primary) {
            const mins = Math.max(1, Math.round((primary.duration || DEFAULT_TIMEOUT) / 60000));
            const title = `${message.author.tag} has been timed out for ${mins}m`;
            const hasInvite = escalated.some(v => v.type === 'discordInvites');
            const reason = hasInvite
                ? 'Sending server invite links'
                : (primary.reason || escalated.map(v => v.reason).filter(Boolean).join('; '));

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(0xff6961)
                .addFields({ name: 'Reason', value: reason || 'No reason provided' });

            await message.channel.send({ embeds: [embed] });
        }
    } catch (_) {}

    // Log to moderation channel
    await logViolation(message, escalated);
}

// Determine the strongest action among violations for public notification
function getPrimaryAction(violations) {
    if (!violations || !violations.length) return null;
    const priority = { mute: 3, delete: 2, warn: 1 };
    let best = null;
    for (const v of violations) {
        if (!v.action) continue;
        if (!best || (priority[v.action] || 0) > (priority[best.action] || 0)) {
            best = v;
        }
    }
    return best;
}

/**
 * Mute a user
 */
async function muteUser(member, duration, reason) {
    try {
        // Try to timeout the user (Discord's built-in timeout)
        await member.timeout(duration, `Auto-mod: ${reason}`);
        
        // Send DM to user
        try {
            const embed = new EmbedBuilder()
                .setTitle('🔇 You\'ve been temporarily muted')
                .setDescription(`**Reason:** ${reason}\n**Duration:** ${Math.round(duration / 60000)} minutes\n\nPlease follow the server rules to avoid further action.`)
                .setColor(0xff6961)
                .setFooter({ text: 'Floof Auto-Moderation' });
            
            await member.send({ embeds: [embed] });
        } catch (dmError) {
            console.log('Could not send DM to muted user:', dmError.message);
        }
        
    } catch (error) {
        console.log('Could not mute user:', error.message);
    }
}

/**
 * Warn a user
 */
async function warnUser(message, violations) {
    const userId = message.author.id;
    
    // Track warnings
    if (!userWarnings.has(userId)) {
        userWarnings.set(userId, []);
    }
    
    const warnings = userWarnings.get(userId);
    warnings.push({
        timestamp: Date.now(),
        violations: violations.map(v => v.type),
        reason: violations.map(v => v.reason).join('; ')
    });
    
    // Send warning message
    const embed = new EmbedBuilder()
        .setTitle('⚠️ Auto-Moderation Warning')
        .setDescription(`${message.author}, please mind your language and behavior!\n\n**Violations:**\n${violations.map(v => `• ${v.reason}`).join('\n')}\n\n**Warning Count:** ${warnings.length}`)
        .setColor(0xffa500)
        .setFooter({ text: 'Floof keeps the den cozy!' });
    
    await message.channel.send({ embeds: [embed] });
    
    // Auto-escalate after multiple warnings
    if (warnings.length >= 3) {
        await muteUser(message.member, 600000, `Auto-escalation: ${warnings.length} warnings`);
    }
}

/**
 * Log violation to infractions.json
 */
function logToInfractions(message, violations) {
    const infractionsPath = path.join(__dirname, '..', 'data', 'infractions.json');
    
    try {
        // Read existing infractions
        let infractions = {};
        if (fs.existsSync(infractionsPath)) {
            const data = fs.readFileSync(infractionsPath, 'utf8');
            infractions = JSON.parse(data);
        }
        
        const guildId = message.guild.id;
        const userId = message.author.id;
        
        // Initialize guild and user if they don't exist
        if (!infractions[guildId]) infractions[guildId] = {};
        if (!infractions[guildId][userId]) infractions[guildId][userId] = [];
        
        // Create infraction entry
        const infraction = {
            id: Date.now().toString(), // Unique ID based on timestamp
            type: 'automod',
            violations: violations.map(v => ({
                type: v.type,
                reason: v.reason,
                action: v.action
            })),
            moderator: 'Auto-Moderation',
            timestamp: new Date().toISOString(),
            channel: message.channel.name,
            channelId: message.channel.id,
            messageContent: message.content ? (message.content.length > 500 ? message.content.substring(0, 500) + '...' : message.content) : null,
            actions: violations.map(v => v.action),
            severity: violations.length > 1 ? 'high' : violations.some(v => v.action === 'mute') ? 'medium' : 'low'
        };
        
        // Add to user's infractions
        infractions[guildId][userId].push(infraction);
        
        // Write back to file (ensure directory exists)
        fs.mkdirSync(path.dirname(infractionsPath), { recursive: true });
        fs.writeFileSync(infractionsPath, JSON.stringify(infractions, null, 2));
        
    } catch (error) {
        console.error('Failed to log infraction to file:', error);
    }
}

/**
 * Log violation to moderation channel
 */
async function logViolation(message, violations) {
    // Do not write automod actions to infractions.json; only human-issued warnings should be recorded
    // Resolve per-guild mod log channel
    const guildCfg = getGuildConfig(message.guild.id);
    const modLogId = guildCfg.modLogChannel;
    if (!modLogId) return;
    const modChannel = message.guild.channels.cache.get(modLogId);
    if (!modChannel) return;
    
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Auto-Moderation')
        .setDescription(`**User:** ${message.author} (${message.author.tag})\n**Channel:** ${message.channel}\n**Action:** ${violations.map(v => v.action).join(', ')}`)
        .setColor(0xff6961)
        .setTimestamp()
        .addFields(
            { name: 'Reason', value: violations.map(v => v.reason).filter(Boolean).join('; ') || 'No reason provided' }
        );
    // If link-related violation, include the exact message content for moderator review
    const hasLinkViolation = violations.some(v => v.type === 'linkSpam' || v.type === 'discordInvites');
    if (hasLinkViolation && message.content && message.content.length > 0) {
        embed.addFields({
            name: 'Message',
            value: message.content.length > 1000 ? message.content.substring(0, 1000) + '...' : message.content
        });
    }

    await modChannel.send({ embeds: [embed] });
}

/**
 * Get user warning count
 */
function getUserWarningCount(userId) {
    return userWarnings.get(userId)?.length || 0;
}

/**
 * Clear user warnings (for moderator commands)
 */
function clearUserWarnings(userId) {
    userWarnings.delete(userId);
}

module.exports = {
    handleAutoModeration,
    getUserWarningCount,
    clearUserWarnings,
    // Export defaults for reference; per-guild overrides are loaded at runtime
    AUTOMOD_CONFIG: DEFAULT_AUTOMOD_CONFIG
};
