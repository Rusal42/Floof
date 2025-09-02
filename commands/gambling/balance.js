const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance } = require('./utils/balance-manager');

module.exports = {
    name: 'balance',
    description: 'Check your or another user\'s balance',
    usage: '%balance [@user]',
    category: 'gambling',
    aliases: ['bal', 'money', 'coins'],
    cooldown: 2,

    async execute(message, args) {
        try {
            let targetUser = message.author;
            
            // Check if a user was mentioned or ID provided
            if (args[0]) {
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                } else {
                    // Try to find user by ID
                    try {
                        targetUser = await message.client.users.fetch(args[0]);
                    } catch (error) {
                        return await sendAsFloofWebhook(message, {
                            content: '❌ User not found! Please mention a user or provide a valid user ID.\n💡 **Tip:** Try `%balance @username` or just `%balance` for your own balance.'
                        });
                    }
                }
            }

            // Get balance with error handling
            let balance;
            try {
                balance = getBalance(targetUser.id);
            } catch (error) {
                console.error('Error getting balance:', error);
                return await sendAsFloofWebhook(message, {
                    content: '❌ Failed to retrieve balance data. This might be a new server setup issue.\n💡 **Tip:** Try again in a moment, or contact an admin if this persists.'
                });
            }

            const isOwnBalance = targetUser.id === message.author.id;
            const displayName = targetUser.displayName || targetUser.username;

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`💰 ${isOwnBalance ? 'Your Balance' : `${displayName}'s Balance`}`)
                .setDescription(`**${balance.toLocaleString()} coins** 🪙`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ 
                    text: isOwnBalance 
                        ? 'Use %work to earn more coins!' 
                        : `Requested by ${message.author.username}` 
                });

            // Add helpful tips for new users
            if (balance <= 1000 && isOwnBalance) {
                embed.addFields({
                    name: '💡 Getting Started',
                    value: '• Use `%work` to earn coins\n• Try `%beg` for quick money\n• Play `%slots` to gamble\n• Check `%help gambling` for more commands',
                    inline: false
                });
            }

            return await sendAsFloofWebhook(message, { embeds: [embed] });

        } catch (error) {
            console.error('Balance command error:', error);
            return await sendAsFloofWebhook(message, {
                content: '❌ Something went wrong checking the balance.\n💡 **New server?** Try `%setup gambling` for help getting started!'
            });
        }
    }
};
