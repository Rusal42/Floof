// owner-gambling.js
// Owner-only gambling commands for Floof bot

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { userBalances, STARTING_BALANCE, saveBalances } = require('./gambling');

// Use environment variable for owner ID
const { isOwner } = require('../../utils/owner-util');

module.exports = {
    name: 'give',
    description: 'Give coins to a user (Owner only)',
    usage: '%give <amount> [@user]',
    category: 'gambling',
    ownerOnly: true,
    cooldown: 0,

    async execute(message, args) {
        // Check if user is owner
        if (!isOwner(message.author.id)) {
            return sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('Owner Only')
                    .setDescription('This command is for the bot owner only!')
                    .setColor(0xff0000)
            ] });
        }

        // Parse amount
        const amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount <= 0) {
            return sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('Give Coins')
                    .setDescription('Please provide a valid amount to give!')
                    .setColor(0xff0000)
            ] });
        }

        // Get target user
        let targetUser = message.author;
        if (args[1]) {
            if (message.mentions.users.size > 0) {
                targetUser = message.mentions.users.first();
            } else {
                try {
                    targetUser = await message.client.users.fetch(args[1]);
                } catch (error) {
                    return sendAsFloofWebhook(message, { embeds: [
                        new EmbedBuilder()
                            .setTitle('Give Coins')
                            .setDescription('User not found! Please mention a user or provide a valid user ID.')
                            .setColor(0xff0000)
                    ] });
                }
            }
        }

        // Initialize balance if needed
        if (!userBalances[targetUser.id]) {
            userBalances[targetUser.id] = STARTING_BALANCE;
        }

        // Add coins
        userBalances[targetUser.id] += amount;

        // Save balances
        saveBalances();

        // Send confirmation
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('💰 Coins Given!')
                .setDescription(`Successfully gave **${amount.toLocaleString()}** coins to ${targetUser.username}!\n\nTheir new balance: **${userBalances[targetUser.id].toLocaleString()}** coins`)
                .setColor(0x00ff00)
                .setThumbnail(targetUser.displayAvatarURL())
        ] });
    }
};
