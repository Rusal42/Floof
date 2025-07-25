const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'av',
    description: 'Show a user\'s avatar',
    usage: '%av [@user|userID]',
    category: 'moderation',
    aliases: ['avatar', 'pfp'],
    permissions: null,
    cooldown: 2,

    async execute(message, args) {
        let user = message.author; // Default to command author

        // If user provided an argument, try to get the mentioned user or fetch by ID
        if (args.length > 0) {
            // Try to get user from mention first
            const mentionedUser = message.mentions.users.first();
            
            if (mentionedUser) {
                user = mentionedUser;
            } else {
                // Try to fetch user by ID
                try {
                    user = await message.client.users.fetch(args[0]);
                } catch (error) {
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('❌ User not found. Please mention a valid user or provide a valid user ID.')
                        .setColor(0xff0000);
                    await sendAsFloofWebhook(message, { embeds: [errorEmbed] });
                    return message.delete().catch(() => {});
                }
            }
        }

        // Create avatar embed
        const avatarEmbed = new EmbedBuilder()
            .setTitle(`${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor(0x9966cc)
            .setFooter({ 
                text: `Requested by ${message.author.username}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp();

        // Send embed via webhook
        await sendAsFloofWebhook(message, { embeds: [avatarEmbed] });
        
        // Delete original command message
        message.delete().catch(() => {});
    }
};
