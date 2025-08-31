const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'sticky.json');

// Rate limiting to prevent spam
const lastBumpTimes = new Map();
const BUMP_COOLDOWN = 30000; // 30 seconds between bumps per channel

function loadAll() {
    try {
        if (!fs.existsSync(path.dirname(DATA_PATH))) {
            fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        }
        if (!fs.existsSync(DATA_PATH)) {
            fs.writeFileSync(DATA_PATH, '{}', 'utf8');
        }
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (error) {
        console.error('Error loading sticky data:', error);
        return {};
    }
}

function saveAll(data) {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving sticky data:', error);
    }
}

async function bumpStickyIfNeeded(message) {
    try {
        // Basic validation
        if (!message.guild || !message.channel || message.author.bot) return;
        
        // Don't bump on command messages (messages starting with % or custom prefix)
        const prefixConfig = (() => {
            try {
                const fs = require('fs');
                const prefixPath = path.join(__dirname, '..', '..', 'data', 'prefix-config.json');
                if (fs.existsSync(prefixPath)) {
                    return JSON.parse(fs.readFileSync(prefixPath, 'utf8'));
                }
            } catch (e) {}
            return {};
        })();
        
        const serverPrefix = prefixConfig[message.guild.id] || '%';
        if (message.content.startsWith(serverPrefix)) return;
        
        const guildId = message.guild.id;
        const channelId = message.channel.id;
        
        // Rate limiting per channel
        const now = Date.now();
        const lastBump = lastBumpTimes.get(channelId);
        if (lastBump && (now - lastBump) < BUMP_COOLDOWN) {
            return; // Too soon since last bump
        }
        
        const all = loadAll();
        const cfg = all[guildId]?.[channelId];
        if (!cfg || (!cfg.content && !cfg.title)) return;
        
        // Check bot permissions
        const botMember = message.guild.members.me;
        if (!botMember || !message.channel.permissionsFor(botMember).has(['SendMessages', 'ManageMessages'])) {
            console.warn(`Missing permissions for sticky in ${message.guild.name}#${message.channel.name}`);
            return;
        }
        
        // Delete previous sticky message if it exists
        if (cfg.lastMessageId) {
            try {
                const stickyMessage = await message.channel.messages.fetch(cfg.lastMessageId);
                if (stickyMessage) {
                    await stickyMessage.delete();
                }
            } catch (error) {
                // Message might already be deleted, continue
            }
        }
        
        // Create and send new sticky message
        let payload;
        if (cfg.title || cfg.content) {
            const embed = new EmbedBuilder()
                .setColor(0xFFB347)
                .setFooter({ text: '📌 Sticky Message' });
            
            if (cfg.title) embed.setTitle(cfg.title);
            if (cfg.content) embed.setDescription(cfg.content);
            
            payload = { embeds: [embed] };
        } else {
            return; // No content to send
        }
        
        const sent = await message.channel.send(payload);
        
        // Update tracking
        cfg.lastMessageId = sent.id;
        cfg.lastBumpTime = now;
        all[guildId][channelId] = cfg;
        saveAll(all);
        
        // Update rate limiting
        lastBumpTimes.set(channelId, now);
        
    } catch (error) {
        console.error('Sticky bump error:', error.message);
    }
}

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [channelId, time] of lastBumpTimes.entries()) {
        if (now - time > BUMP_COOLDOWN * 10) { // Clean up after 5 minutes
            lastBumpTimes.delete(channelId);
        }
    }
}, 60000); // Run cleanup every minute

module.exports = { 
    bumpStickyIfNeeded,
    loadAll,
    saveAll
};
