const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms, requireBotPermsInChannel } = require('../../utils/permissions');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'sticky.json');

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
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save sticky data:', e);
    }
}

module.exports = {
    name: 'sticky',
    description: 'Create or manage a sticky message that stays at the bottom of a channel',
    usage: '%sticky set <message> | %sticky set --title Title | Message | %sticky off | %sticky show | %sticky edit <message|--title Title | Message>',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    cooldown: 3,

    async execute(message, args) {
        if (!(await requirePerms(message, PermissionFlagsBits.ManageChannels, 'manage sticky messages'))) return;
        if (!(await requireBotPermsInChannel(message, message.channel, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks], 'post and manage sticky messages'))) return;

        const sub = (args.shift() || '').toLowerCase();
        const all = loadAll();
        const guildId = message.guild.id;
        if (!all[guildId]) all[guildId] = {};
        if (!all[guildId][message.channel.id]) all[guildId][message.channel.id] = null;

        if (sub === 'set' || sub === 'create') {
            const full = args.join(' ').trim();
            let content = full;
            let title = null;
            if (full.toLowerCase().includes('--title')) {
                const after = full.split(/--title\s*/i)[1] || '';
                if (after.includes('|')) {
                    const parts = after.split('|');
                    title = parts.shift().trim();
                    content = parts.join('|').trim();
                } else {
                    // If no pipe provided, treat everything after as title and leave content empty
                    title = after.trim();
                    content = '';
                }
            }
            if (!content) {
                return sendAsFloofWebhook(message, { content: '❌ Provide the sticky message content. Usage: `%sticky set <message>` or `%sticky set --title Title | Message`' });
            }

            // Delete previous sticky message if present
            const prev = all[guildId][message.channel.id];
            if (prev?.lastMessageId) {
                try { await message.channel.messages.delete(prev.lastMessageId).catch(() => {}); } catch {}
            }

            // Send new sticky as an embed by default
            const stickyEmbed = new EmbedBuilder();
            if (title) stickyEmbed.setTitle(title);
            if (content) stickyEmbed.setDescription(content);
            stickyEmbed.setColor(0xFFB347);
            const sent = await message.channel.send({ embeds: [stickyEmbed] });
            all[guildId][message.channel.id] = { content, title: title || null, lastMessageId: sent.id };
            saveAll(all);

            const embed = new EmbedBuilder()
                .setTitle('📌 Sticky Set')
                .setDescription('This channel now has a sticky message that will stay at the bottom.')
                .addFields(
                    { name: 'Preview', value: content.slice(0, 1024) }
                )
                .setColor(0x57F287);
            const confirmation = await sendAsFloofWebhook(message, { embeds: [embed] });
            setTimeout(() => confirmation.delete().catch(() => {}), 3000);
            return;
        }

        if (sub === 'off' || sub === 'remove' || sub === 'clear' || sub === 'delete') {
            const prev = all[guildId][message.channel.id];
            if (!prev) {
                return sendAsFloofWebhook(message, { content: 'ℹ️ No sticky set in this channel.' });
            }
            if (prev.lastMessageId) {
                try { await message.channel.messages.delete(prev.lastMessageId).catch(() => {}); } catch {}
            }
            all[guildId][message.channel.id] = null;
            saveAll(all);
            const confirmation = await sendAsFloofWebhook(message, { content: '✅ Sticky removed for this channel.' });
            setTimeout(() => confirmation.delete().catch(() => {}), 3000);
            return;
        }

        if (sub === 'show' || sub === 'view') {
            const prev = all[guildId][message.channel.id];
            if (!prev) return sendAsFloofWebhook(message, { content: 'ℹ️ No sticky set in this channel.' });
            const embed = new EmbedBuilder()
                .setTitle('📌 Current Sticky')
                .setDescription((prev.title ? `Title: ${prev.title}\n\n` : '') + (prev.content ? prev.content.slice(0, 4096) : '(empty)'))
                .setColor(0x5865F2);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (sub === 'edit' || sub === 'update') {
            const full = args.join(' ').trim();
            let content = full;
            let title = null;
            if (full.toLowerCase().includes('--title')) {
                const after = full.split(/--title\s*/i)[1] || '';
                if (after.includes('|')) {
                    const parts = after.split('|');
                    title = parts.shift().trim();
                    content = parts.join('|').trim();
                } else {
                    title = after.trim();
                    content = '';
                }
            }
            if (!content) return sendAsFloofWebhook(message, { content: '❌ Provide new content. Usage: `%sticky edit <message>` or `%sticky edit --title Title | Message`' });
            const prev = all[guildId][message.channel.id];
            if (!prev) return sendAsFloofWebhook(message, { content: 'ℹ️ No sticky set in this channel. Use `%sticky set <message>`.' });
            // Try editing if message exists, else re-send
            let success = false;
            if (prev.lastMessageId) {
                try {
                    const msg = await message.channel.messages.fetch(prev.lastMessageId).catch(() => null);
                    if (msg) {
                        // Always edit as an embed
                        await msg.edit({ embeds: [new EmbedBuilder().setTitle((title ?? prev.title) || null).setDescription(content).setColor(0xFFB347)] });
                        success = true;
                    }
                } catch {}
            }
            if (!success) {
                const payload = { embeds: [new EmbedBuilder().setTitle((title || prev.title) || null).setDescription(content).setColor(0xFFB347)] };
                const sent = await message.channel.send(payload);
                prev.lastMessageId = sent.id;
            }
            prev.content = content;
            if (title !== null) prev.title = title; // allow updating/adding title
            all[guildId][message.channel.id] = prev;
            saveAll(all);
            const confirmation = await sendAsFloofWebhook(message, { content: '✅ Sticky updated.' });
            setTimeout(() => confirmation.delete().catch(() => {}), 3000);
            return;
        }

        // Default: show usage
        const embed = new EmbedBuilder()
            .setTitle('📌 Sticky Command')
            .setDescription('Keep an important message at the bottom of a channel by re-posting it after new messages.')
            .addFields(
                { name: 'Set', value: '`%sticky set <message>` or `\n%sticky set --title Title | Message`' },
                { name: 'Edit', value: '`%sticky edit <message>` or `\n%sticky edit --title Title | Message`' },
                { name: 'Show', value: '`%sticky show`' },
                { name: 'Remove', value: '`%sticky off`' }
            )
            .setColor(0xFFB347);
        return sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
