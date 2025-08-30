const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');

module.exports = {
    name: 'ban',
    description: 'Ban a user from the server',
    usage: '%ban <@user|userID> [reason]',
    category: 'moderation',
    aliases: ['hammer', 'banish'],
    permissions: [PermissionsBitField.Flags.BanMembers],
    cooldown: 3,

    async execute(message, args) {
        // Standardized permission check
        if (!(await requirePerms(message, PermissionsBitField.Flags.BanMembers, 'ban members'))) return;

        if (args.length < 1) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%ban <@user|userID> [reason]`\nExample: `%ban @BadUser Spamming`')
                .setColor(0xff0000);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Try to get user by mention first, then by ID
        let member = message.mentions.members.first();
        let user = message.mentions.users.first();
        
        if (!member && args[0]) {
            try {
                // Try to fetch member by ID
                member = await message.guild.members.fetch(args[0]);
                user = member.user;
            } catch (error) {
                try {
                    // If member not found, try to fetch user by ID (for users not in server)
                    user = await message.client.users.fetch(args[0]);
                } catch (userError) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ User not found. Please mention a valid user or provide a valid user ID.')
                        .setColor(0xff0000);
                    return await sendAsFloofWebhook(message, { embeds: [embed] });
                }
            }
        }

        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please mention a user or provide a user ID to ban!')
                .setColor(0xff0000);
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if user is trying to ban themselves
        if (user.id === message.author.id) {
            return message.reply('❌ You cannot ban yourself!');
        }

        // Check if user is trying to ban the bot
        if (user.id === message.client.user.id) {
            return message.reply('❌ I cannot ban myself!');
        }

        // Check if member exists and is bannable
        if (member && !member.bannable) {
            return message.reply('❌ I can\'t ban this user! They may have higher permissions than me.');
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            // Ban the user
            await message.guild.members.ban(user, { reason: reason });

            const embed = new EmbedBuilder()
                .setTitle('🔨 User Banned')
                .setDescription(`**${user.tag}** has been permanently banned from the server!\n\n🚫 **Good riddance!** They won't be missed!\n\n**Reason:** ${reason}`)
                .setColor(0xff0000)
                .setFooter({ text: 'Floof\'s Moderation System' })
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });

            // Try to DM the user about the ban (if they're still in server)
            if (member) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🔨 You have been banned')
                        .setDescription(`You have been banned from **${message.guild.name}**.\nReason: ${reason}`)
                        .setColor(0xff0000)
                        .setTimestamp();
                    
                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    // User has DMs disabled or left server, that's okay
                    console.log(`Could not DM ban notification to ${user.tag}`);
                }
            }
        } catch (error) {
            console.error('Ban error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ Failed to ban the user. Please check my permissions and try again.')
                .setColor(0xff0000);
            await sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
