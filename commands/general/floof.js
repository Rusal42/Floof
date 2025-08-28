const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'floof',
    description: 'Shows the fun/social commands menu',
    usage: '%floof',
    category: 'fun',
    cooldown: 3,

    async execute(message) {
        const handler = message.client.commandHandler;
        const all = handler?.commands;
        if (!all) {
            return sendAsFloofWebhook(message, { content: '❌ Command handler unavailable.' });
        }

        const isFunCmd = (cmd) => {
            if (cmd.category && cmd.category.toLowerCase() === 'fun') return true;
            if (cmd.filePath && cmd.filePath.includes(`${path.sep}commands${path.sep}fun${path.sep}`)) return true;
            return false;
        };

        const funCmds = Array.from(all.values()).filter(isFunCmd);
        if (!funCmds.length) {
            return sendAsFloofWebhook(message, { content: 'No fun commands found.' });
        }

        const list = funCmds
            .map(cmd => `• %${cmd.name}${cmd.aliases && cmd.aliases.length ? ` (${cmd.aliases.join(', ')})` : ''} — ${cmd.description || ''}`)
            .join('\n');

        const tips = [
            'Try `%8ball <question>`',
            'Use `%joke` or `%cat`',
            'Social: `%hug`, `%kiss`, `%slap`, `%cuddle`, `%wave`'
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🎉 Floof Fun Menu')
            .setColor(0xFFD700)
            .addFields(
                { name: 'Highlights', value: tips },
                { name: 'All fun commands', value: list.slice(0, 4000) }
            )
            .setFooter({ text: 'Tip: %help <command> for usage and examples' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
