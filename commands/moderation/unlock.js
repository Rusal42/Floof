const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms, requireBotPermsInChannel } = require('../../utils/permissions');

module.exports = {
    name: 'unlock',
    aliases: ['unlockdown', 'open'],
    description: 'Unlock a text channel (restore @everyone ability to send messages)',
    usage: '%unlock [#channel] [reason]',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    cooldown: 3,

    async execute(message, args) {
        // Require user perms
        if (!(await requirePerms(message, PermissionFlagsBits.ManageChannels, 'unlock channels'))) return;

        // Parse channel (default: current)
        let target = message.mentions.channels.first();
        if (!target && args[0] && /^(<#\d+>|\d+)$/.test(args[0])) {
            const id = args[0].replace(/[^0-9]/g, '');
            target = message.guild.channels.cache.get(id);
        }
        if (!target) target = message.channel;

        // Validate channel type
        if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(target.type)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please target a text or announcement channel.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Bot perms in target channel
        if (!(await requireBotPermsInChannel(message, target, PermissionFlagsBits.ManageChannels, 'unlock this channel'))) return;

        const everyone = message.guild.roles.everyone;
        const currentOverwrite = target.permissionOverwrites.resolve(everyone.id);
        const isLocked = currentOverwrite?.deny?.has(PermissionFlagsBits.SendMessages);

        const reason = args.slice(target === message.channel ? 0 : 1).join(' ').trim() || 'Channel unlocked by moderator';

        try {
            // Remove explicit deny for SendMessages by setting to null (inherit)
            await target.permissionOverwrites.edit(
                everyone,
                { SendMessages: null },
                { reason: `Unlock by ${message.author.tag}: ${reason}` }
            );

            const embed = new EmbedBuilder()
                .setTitle('🔓 Channel Unlocked')
                .setDescription(`${target} has been unlocked. @everyone can send messages according to channel/server settings.`)
                .addFields({ name: 'Previous State', value: isLocked ? 'Locked' : 'Not locked' })
                .addFields({ name: 'Reason', value: reason })
                .setColor(0x57F287)
                .setFooter({ text: `${message.author.tag} | ${message.author.id}` })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ Failed to unlock ${target}: ${err.message}`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
