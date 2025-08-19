const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'floofmod',
    description: 'Moderation command menu',
    usage: '%floofmod',
    category: 'moderation',
    cooldown: 3,

    async execute(message) {
        const handler = message.client.commandHandler;
        const all = handler?.commands;
        if (!all) {
            return sendAsFloofWebhook(message, { content: '❌ Command handler unavailable.' });
        }
        const mods = all.filter(c => c.category === 'moderation');
        const list = mods.map(cmd => `• %${cmd.name}${cmd.aliases && cmd.aliases.length ? ` (${cmd.aliases.join(', ')})` : ''} — ${cmd.description || ''}`);

        // Highlight lock/unlock, sticky, and automod config at the top
        const highlights = [
            '🔒 %lock — Lock the current channel (deny @everyone SendMessages)',
            '🔓 %unlock — Unlock the current channel (restore SendMessages)',
            '📌 %sticky set <msg> — Keep a sticky message at the bottom (use `--title Title | Message` for an embed)',
            '🛡️ %config automod — Configure anti-spam, similar messages, links, invites, caps, mentions, bad words'
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Floof Moderation Menu')
            .setColor(0xFF0000)
            .addFields(
                { name: 'Highlights', value: highlights },
                { name: 'All moderation commands', value: list.join('\n').slice(0, 4000) }
            )
            .setFooter({ text: 'Tip: %help <command> for details and examples' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
