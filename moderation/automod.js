const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Default auto moderation configuration (per-guild overrides will be merged)
const DEFAULT_AUTOMOD_CONFIG = {
    // Spam detection
    spam: {
        enabled: true,
        maxMessages: 5,        // Max messages in timeframe
        timeWindow: 10000,     // Time window in ms (10 seconds)
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
        action: 'delete',      // 'delete', 'warn', or 'mute'
        allowedDomains: [],    // Whitelist specific servers if needed
    },
    
    // Link protection (simple on/off with whitelist)
    links: {
        enabled: true,
        action: 'delete',      // 'delete', 'warn', or 'mute'
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
            reason: `Sent ${keep + 1} very similar messages in a row`,
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
            duration
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
            invites: foundInvites
        };
    }
    
    return { violation: false };
}

/**
 * Check for mention spam
 */
function checkMentionSpam(message, config) {
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    
    if (totalMentions > config.mentions.maxMentions) {
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

/**
 * Process violations and take appropriate action
 */
async function processViolations(message, violations) {
    const userId = message.author.id;
    
    // Delete message if any violation requires it
    const shouldDelete = violations.some(v => v.action === 'delete');
    if (shouldDelete) {
        try {
            await message.delete();
        } catch (error) {
            console.log('Could not delete message:', error.message);
        }
    }
    
    // Handle muting
    const muteViolation = violations.find(v => v.action === 'mute');
    if (muteViolation) {
        await muteUser(message.member, muteViolation.duration || 300000, muteViolation.reason);
    }
    
    // Handle warnings
    const warnViolations = violations.filter(v => v.action === 'warn');
    if (warnViolations.length > 0) {
        await warnUser(message, warnViolations);
    }
    
    // Public notification in channel about the action taken (styled embed)
    try {
        const primary = getPrimaryAction(violations);
        if (primary) {
            const mins = primary.action === 'mute' && (primary.duration || 0) > 0
                ? Math.max(1, Math.round((primary.duration || 0) / 60000))
                : null;
            let title;
            if (primary.action === 'mute') {
                title = `${message.author.tag} has been timed out for ${mins}m`;
            } else if (primary.action === 'warn') {
                title = `${message.author.tag} has been warned`;
            } else if (primary.action === 'delete') {
                title = `${message.author.tag}'s message was removed`;
            } else {
                title = `${message.author.tag} actioned`;
            }

            const reason = primary.reason || violations.map(v => v.reason).filter(Boolean).join('; ');

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(0xff6961)
                .addFields({ name: 'Reason', value: reason || 'No reason provided' })
                .setFooter({ text: `${message.author.tag} | ${message.author.id}` });

            await message.channel.send({ embeds: [embed] });
        }
    } catch (_) {}

    // Log to moderation channel
    await logViolation(message, violations);
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
    // Log to infractions.json first
    logToInfractions(message, violations);
    // Resolve per-guild mod log channel
    const guildCfg = getGuildConfig(message.guild.id);
    const modLogId = guildCfg.modLogChannel;
    if (!modLogId) return;
    const modChannel = message.guild.channels.cache.get(modLogId);
    if (!modChannel) return;
    
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Auto-Moderation Action')
        .setDescription(`**User:** ${message.author} (${message.author.tag})\n**Channel:** ${message.channel}\n**Action:** ${violations.map(v => v.action).join(', ')}\n\n**Violations:**\n${violations.map(v => `• **${v.type}**: ${v.reason}`).join('\n')}`)
        .setColor(0xff6961)
        .setTimestamp()
        .setFooter({ text: 'Floof Auto-Moderation' });
    
    if (message.content && message.content.length > 0) {
        embed.addFields({
            name: 'Original Message',
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
