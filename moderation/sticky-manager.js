const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'sticky.json');

function loadAll() {
    try {
        if (!fs.existsSync(path.dirname(DATA_PATH))) fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '{}', 'utf8');
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(raw || '{}');
    } catch {
        return {};
    }
}

function saveAll(data) {
    try { fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8'); } catch {}
}

async function bumpStickyIfNeeded(message) {
    try {
        if (!message.guild || !message.channel) return;
        const guildId = message.guild.id;
        const channelId = message.channel.id;
        const all = loadAll();
        const cfg = all[guildId]?.[channelId];
        if (!cfg || !cfg.content) return;

        // Try delete previous sticky message (ignore errors)
        if (cfg.lastMessageId) {
            try { await message.channel.messages.delete(cfg.lastMessageId).catch(() => {}); } catch {}
        }

        // Re-send sticky
        let payload;
        if (cfg.title) {
            const { EmbedBuilder } = require('discord.js');
            payload = { embeds: [new EmbedBuilder().setTitle(cfg.title).setDescription(cfg.content || '').setColor(0xFFB347)] };
        } else {
            payload = { content: cfg.content };
        }
        const sent = await message.channel.send(payload);
        cfg.lastMessageId = sent.id;
        all[guildId][channelId] = cfg;
        saveAll(all);
    } catch (e) {
        // Swallow errors to avoid breaking messageCreate
        console.error('Sticky bump error:', e.message);
    }
}

module.exports = { bumpStickyIfNeeded };
