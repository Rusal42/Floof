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
                        content: '❌ User not found! Please mention a user or provide a valid user ID.'
                    });
                }
            }
        }

        const balance = getBalance(targetUser.id);
        
        const embed = new EmbedBuilder()
            .setTitle('💰 Balance')
            .setDescription(`${targetUser === message.author ? 'Your' : `${targetUser.username}'s`} balance: **${balance.toLocaleString()}** coins`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
