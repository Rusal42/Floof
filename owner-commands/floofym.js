// floofym.js - Fun owner commands menu with meowlock and silly stuff
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const ownerCommands = require('./owner-commands');

module.exports = {
    name: 'floofym',
    description: 'Fun owner commands menu with meowlock and silly features',
    ownerOnly: true,
    usage: '%floofym [subcommand]',
    aliases: ['fm', 'floofmenu'],

    async execute(message, args) {
        try {
            if (!args.length) {
                return await this.showFloofyMenu(message);
            }

            const subcommand = args[0].toLowerCase();
            const value = args.slice(1).join(' ');

            // This is just the menu command - individual commands are handled separately
            return await this.showFloofyMenu(message);

        } catch (error) {
            console.error('Floofym command error:', error);
            return await sendAsFloofWebhook(message, {
                content: '❌ Something went wrong with the floofym command.'
            });
        }
    },

    async showFloofyMenu(message) {
        const embed = new EmbedBuilder()
            .setTitle('🐱 Floof\'s Fun Commands')
            .setDescription('Silly owner commands and meowlock shenanigans! uwu')
            .setColor(0xFFB6C1)
            .addFields(
                {
                    name: '😸 **Meowlock Commands**',
                    value: [
                        '`%meowlock <@user> [style]` - Meowlock a user with style',
                        '`%meowunlock <@user>` - Remove meowlock from user',
                        '`%meowlockclear` - Clear all meowlocks in server',
                        '`%meowlocked` - List all meowlocked users'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🎨 **Meowlock Styles**',
                    value: [
                        '`default` - Standard meowlock',
                        '`kawaii` - Extra cute uwu style',
                        '`chaos` - Chaotic cat energy',
                        '`sleepy` - Sleepy cat vibes',
                        '`zoomies` - Hyperactive cat mode'
                    ].join('\n'),
                    inline: false
                }
            )
            .setThumbnail(message.client.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Owner only fun commands • Use %floofym <subcommand>' })
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
