const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms, requireBotPermsInChannel } = require('../../utils/permissions');

module.exports = {
    name: 'lock',
    aliases: ['lockdown'],
    description: 'Lock a text channel (prevent @everyone from sending messages)',
    usage: '%lock [#channel] [reason]',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    cooldown: 3,

    async execute(message, args) {
        // Require user perms
        if (!(await requirePerms(message, PermissionFlagsBits.ManageChannels, 'lock channels'))) return;

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
        if (!(await requireBotPermsInChannel(message, target, PermissionFlagsBits.ManageChannels, 'lock this channel'))) return;

        const everyone = message.guild.roles.everyone;
        const currentOverwrite = target.permissionOverwrites.resolve(everyone.id);
        const alreadyLocked = currentOverwrite?.deny?.has(PermissionFlagsBits.SendMessages);

        if (alreadyLocked) {
            const embed = new EmbedBuilder()
                .setDescription(`ℹ️ ${target} is already locked.`)
                .setColor(0xFFD166);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reason = args.slice(target === message.channel ? 0 : 1).join(' ').trim() || 'Channel locked by moderator';

        try {
            await target.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason: `Lock by ${message.author.tag}: ${reason}` });

            // Construct confirmation embed
            const embed = new EmbedBuilder()
                .setTitle('🔒 Channel Locked')
                .setDescription(`${target} has been locked. @everyone cannot send messages.`)
                .addFields({ name: 'Reason', value: reason })
                .setColor(0xff6961)
                .setFooter({ text: `${message.author.tag} | ${message.author.id}` })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ Failed to lock ${target}: ${err.message}`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
