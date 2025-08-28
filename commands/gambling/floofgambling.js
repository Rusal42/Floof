const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'floofgambling',
    description: 'Shows the gambling/casino commands menu',
    usage: '%floofgambling',
    category: 'gambling',
    cooldown: 3,

    async execute(message) {
        const handler = message.client.commandHandler;
        const all = handler?.commands;
        if (!all) {
            return sendAsFloofWebhook(message, { content: '❌ Command handler unavailable.' });
        }

        const isGambleCmd = (cmd) => {
            if (cmd.category && cmd.category.toLowerCase() === 'gambling') return true;
            if (cmd.filePath && cmd.filePath.includes(`${path.sep}commands${path.sep}gambling${path.sep}`)) return true;
            return false;
        };

        const gambleCmds = Array.from(all.values()).filter(isGambleCmd);
        if (!gambleCmds.length) {
            return sendAsFloofWebhook(message, { content: 'No gambling commands found.' });
        }

        const list = gambleCmds
            .map(cmd => `• %${cmd.name}${cmd.aliases && cmd.aliases.length ? ` (${cmd.aliases.join(', ')})` : ''} — ${cmd.description || ''}`)
            .join('\n');

        const tips = [
            'Start with `%balance` and `%work`',
            'Try `%slots 50`, `%blackjack 100`, or `%coinflip heads 25`',
            'Check `%leaderboard` to see the top players'
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🎰 Floof Gambling Menu')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Getting Started', value: tips },
                { name: 'All gambling commands', value: list.slice(0, 4000) }
            )
            .setFooter({ text: 'Tip: %help <command> for usage and examples' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
