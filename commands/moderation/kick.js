const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');

module.exports = {
    name: 'kick',
    description: 'Kick a user from the server',
    usage: '%kick <@user|userID> [reason]',
    category: 'moderation',
    aliases: ['boot', 'yeet'],
    permissions: [PermissionsBitField.Flags.KickMembers],
    cooldown: 3,

    async execute(message, args) {
        // Standardized permission check
        if (!(await requirePerms(message, PermissionsBitField.Flags.KickMembers, 'kick members'))) return;

        if (args.length < 1) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%kick <@user|userID> [reason]`\nExample: `%kick @BadUser Being disruptive`')
                .setColor(0xff0000);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Try to get member by mention first, then by ID
        let member = message.mentions.members.first();
        
        if (!member && args[0]) {
            try {
                // Try to fetch member by ID
                member = await message.guild.members.fetch(args[0]);
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ User not found. Please mention a valid user or provide a valid user ID.')
                    .setColor(0xff0000);
                return await sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }

        if (!member) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please mention a user or provide a user ID to kick!')
                .setColor(0xff0000);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if user is trying to kick themselves
        if (member.user.id === message.author.id) {
            return message.reply('❌ You cannot kick yourself!');
        }

        // Check if user is trying to kick the bot
        if (member.user.id === message.client.user.id) {
            return message.reply('❌ I cannot kick myself!');
        }

        // Check if member is kickable
        if (!member.kickable) {
            return message.reply('❌ I can\'t kick this user! They may have higher permissions than me.');
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            // Try to DM the user before kicking
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('👢 You have been kicked')
                    .setDescription(`You have been kicked from **${message.guild.name}**.\nReason: ${reason}\n\nYou can rejoin the server if you have an invite link.`)
                    .setColor(0xffa500)
                    .setTimestamp();
                
                await member.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                // User has DMs disabled, that's okay
                console.log(`Could not DM kick notification to ${member.user.tag}`);
            }

            // Kick the user
            await member.kick(reason);

            const embed = new EmbedBuilder()
                .setTitle('👢 User Kicked')
                .setDescription(`**${member.user.tag}** has been kicked from the server!\n\n👋 **Goodbye!** Don't let the door hit you on the way out!\n\n**Reason:** ${reason}`)
                .setColor(0xffa500)
                .setFooter({ text: 'Floof\'s Moderation System' })
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Kick error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ Failed to kick the user. Please check my permissions and try again.')
                .setColor(0xff0000);
            await sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
