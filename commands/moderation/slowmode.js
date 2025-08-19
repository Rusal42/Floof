const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms, requireBotPermsInChannel } = require('../../utils/permissions');

module.exports = {
    name: 'slowmode',
    aliases: ['slow'],
    description: 'Set slowmode for the current channel',
    usage: '%slowmode <seconds> or %slowmode off',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    cooldown: 3,

    async execute(message, args) {
        // Standardized permission checks
        if (!(await requirePerms(message, PermissionFlagsBits.ManageChannels, 'set slowmode'))) return;
        if (!(await requireBotPermsInChannel(message, message.channel, PermissionFlagsBits.ManageChannels, 'set slowmode'))) return;

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please specify a time in seconds (0-21600) or "off".\n**Usage:** `%slowmode <seconds>` or `%slowmode off`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const input = args[0].toLowerCase();
        let seconds;

        if (input === 'off' || input === '0') {
            seconds = 0;
        } else {
            seconds = parseInt(input);
            if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ Please provide a valid number between 0 and 21600 seconds (6 hours).')
                    .setColor(0xFF0000);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }

        try {
            await message.channel.setRateLimitPerUser(seconds);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00);

            if (seconds === 0) {
                embed.setDescription('✅ Slowmode has been **disabled** for this channel.');
            } else {
                const timeString = seconds >= 60 
                    ? `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) !== 1 ? 's' : ''} ${seconds % 60 > 0 ? `${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}` : ''}`.trim()
                    : `${seconds} second${seconds !== 1 ? 's' : ''}`;
                
                embed.setDescription(`✅ Slowmode set to **${timeString}** for this channel.`);
            }

            embed.setFooter({ text: `Set by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });

        } catch (error) {
            console.error('Error setting slowmode:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while trying to set slowmode.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
