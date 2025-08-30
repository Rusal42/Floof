const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');

module.exports = {
    name: 'unban',
    description: 'Unban a user by their ID',
    usage: '%unban <userID> [reason]',
    category: 'moderation',
    aliases: ['pardon'],
    permissions: [PermissionsBitField.Flags.BanMembers],
    cooldown: 3,

    async execute(message, args) {
        // Permission check (user)
        if (!(await requirePerms(message, PermissionsBitField.Flags.BanMembers, 'unban members'))) return;

        if (!args[0]) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%unban <userID> [reason]`\nExample: `%unban 123456789012345678 Resolved after appeal`')
                .setColor(0xff0000);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const userId = args[0].replace(/[^0-9]/g, '');
        if (!/^[0-9]{15,20}$/.test(userId)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please provide a valid user ID.')
                .setColor(0xff0000);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            // Try to fetch ban info first to confirm the user is banned and get user tag
            let banInfo = null;
            try {
                banInfo = await message.guild.bans.fetch(userId);
            } catch (_) {
                // Not found in bans
            }

            if (!banInfo) {
                const embed = new EmbedBuilder()
                    .setDescription('ℹ️ That user is not currently banned in this server.')
                    .setColor(0x5865F2);
                return await sendAsFloofWebhook(message, { embeds: [embed] });
            }

            await message.guild.members.unban(userId, reason);

            const userTag = banInfo?.user?.tag || userId;
            const embed = new EmbedBuilder()
                .setTitle('✅ User Unbanned')
                .setDescription(`**${userTag}** has been unbanned.`)
                .addFields({ name: 'Reason', value: reason })
                .setColor(0x57F287)
                .setFooter({ text: "Floof's Moderation System" })
                .setTimestamp();

            return await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Unban error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ Failed to unban the user. Please check my permissions and try again.')
                .setColor(0xff0000);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
