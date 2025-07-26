const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Auto moderation configuration
const AUTOMOD_CONFIG = {
    // Spam detection
    spam: {
        enabled: true,
        maxMessages: 5,        // Max messages in timeframe
        timeWindow: 10000,     // Time window in ms (10 seconds)
        muteTime: 300000,      // Mute duration in ms (5 minutes)
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
    
    // Link spam protection
    links: {
        enabled: true,
        maxLinks: 3,           // Max links per message
        action: 'delete',      // 'delete', 'warn', or 'mute'
    },
    
    // Mention spam protection
    mentions: {
        enabled: true,
        maxMentions: 5,        // Max mentions per message
        action: 'delete',      // 'delete', 'warn', or 'mute'
    }
};

// Store user message history for spam detection
const userMessageHistory = new Map();

// Store user warnings
const userWarnings = new Map();

// Moderation log channel ID (set this to your mod log channel)
const MOD_LOG_CHANNEL_ID = '1398716134508855488'; // Mod log channel

/**
 * Main auto moderation handler
 */
async function handleAutoModeration(message) {
    // Don't moderate bots or admins
    if (message.author.bot) return;
    if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    
    const violations = [];
    
    // Check for spam
    if (AUTOMOD_CONFIG.spam.enabled) {
        const spamResult = checkSpam(message);
        if (spamResult.isSpam) violations.push(spamResult);
    }
    
    // Check for bad words
    if (AUTOMOD_CONFIG.badWords.enabled) {
        const badWordResult = checkBadWords(message);
        if (badWordResult.violation) violations.push(badWordResult);
    }
    
    // Check for excessive caps
    if (AUTOMOD_CONFIG.caps.enabled) {
        const capsResult = checkExcessiveCaps(message);
        if (capsResult.violation) violations.push(capsResult);
    }
    
    // Check for Discord invite links
    if (AUTOMOD_CONFIG.invites.enabled) {
        const inviteResult = checkDiscordInvites(message);
        if (inviteResult.violation) violations.push(inviteResult);
    }
    
    // Check for link spam
    if (AUTOMOD_CONFIG.links.enabled) {
        const linkResult = checkLinkSpam(message);
        if (linkResult.violation) violations.push(linkResult);
    }
    
    // Check for mention spam
    if (AUTOMOD_CONFIG.mentions.enabled) {
        const mentionResult = checkMentionSpam(message);
        if (mentionResult.violation) violations.push(mentionResult);
    }
    
    // Process violations
    if (violations.length > 0) {
        await processViolations(message, violations);
    }
}

/**
 * Check for spam (rapid message sending)
 */
function checkSpam(message) {
    const userId = message.author.id;
    const now = Date.now();
    
    if (!userMessageHistory.has(userId)) {
        userMessageHistory.set(userId, []);
    }
    
    const userHistory = userMessageHistory.get(userId);
    
    // Add current message
    userHistory.push(now);
    
    // Remove old messages outside time window
    const cutoff = now - AUTOMOD_CONFIG.spam.timeWindow;
    const recentMessages = userHistory.filter(timestamp => timestamp > cutoff);
    userMessageHistory.set(userId, recentMessages);
    
    // Check if spam threshold exceeded
    if (recentMessages.length > AUTOMOD_CONFIG.spam.maxMessages) {
        return {
            type: 'spam',
            violation: true,
            isSpam: true,
            reason: `Sent ${recentMessages.length} messages in ${AUTOMOD_CONFIG.spam.timeWindow / 1000} seconds`,
            action: 'mute',
            duration: AUTOMOD_CONFIG.spam.muteTime
        };
    }
    
    return { isSpam: false };
}

/**
 * Check for bad words
 */
function checkBadWords(message) {
    const content = message.content.toLowerCase();
    const foundWords = AUTOMOD_CONFIG.badWords.words.filter(word => 
        content.includes(word.toLowerCase())
    );
    
    if (foundWords.length > 0) {
        return {
            type: 'badWords',
            violation: true,
            reason: `Used prohibited words: ${foundWords.join(', ')}`,
            action: AUTOMOD_CONFIG.badWords.action,
            foundWords
        };
    }
    
    return { violation: false };
}

/**
 * Check for excessive caps
 */
function checkExcessiveCaps(message) {
    const content = message.content;
    
    if (content.length < AUTOMOD_CONFIG.caps.minLength) {
        return { violation: false };
    }
    
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return { violation: false };
    
    const caps = content.replace(/[^A-Z]/g, '');
    const capsRatio = caps.length / letters.length;
    
    if (capsRatio > AUTOMOD_CONFIG.caps.threshold) {
        return {
            type: 'caps',
            violation: true,
            reason: `Message is ${Math.round(capsRatio * 100)}% caps (limit: ${Math.round(AUTOMOD_CONFIG.caps.threshold * 100)}%)`,
            action: AUTOMOD_CONFIG.caps.action,
            capsRatio
        };
    }
    
    return { violation: false };
}

/**
 * Check for link spam
 */
function checkLinkSpam(message) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const links = message.content.match(urlRegex) || [];
    
    if (links.length > AUTOMOD_CONFIG.links.maxLinks) {
        return {
            type: 'linkSpam',
            violation: true,
            reason: `Posted ${links.length} links (limit: ${AUTOMOD_CONFIG.links.maxLinks})`,
            action: AUTOMOD_CONFIG.links.action,
            linkCount: links.length
        };
    }
    
    return { violation: false };
}

/**
 * Check for Discord invite links
 */
function checkDiscordInvites(message) {
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
            action: AUTOMOD_CONFIG.invites.action,
            invites: foundInvites
        };
    }
    
    return { violation: false };
}

/**
 * Check for mention spam
 */
function checkMentionSpam(message) {
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    
    if (totalMentions > AUTOMOD_CONFIG.mentions.maxMentions) {
        return {
            type: 'mentionSpam',
            violation: true,
            reason: `Posted ${totalMentions} mentions (limit: ${AUTOMOD_CONFIG.mentions.maxMentions})`,
            action: AUTOMOD_CONFIG.mentions.action,
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
    
    // Log to moderation channel
    await logViolation(message, violations);
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
    const infractionsPath = path.join(__dirname, '..', 'infractions.json');
    
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
        
        // Write back to file
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
    
    const modChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
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
    AUTOMOD_CONFIG
};
