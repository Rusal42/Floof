// owner-gambling.js
// Owner-only gambling commands for Floof bot

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { userBalances, STARTING_BALANCE } = require('./gambling');

// Replace this with your actual Discord user ID
const OWNER_ID = '1007799027716329484';

// Add more owner-only gambling commands below

/**
 * Owner-only give command
 * Usage: %give <amount> [@user]
 */
function give(message, amount, userMention) {
    if (message.author.id !== OWNER_ID) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Owner Only')
                .setDescription('This command is for the bot owner only!')
                .setColor(0xff0000)
        ] });
    }
    amount = parseInt(amount, 10);
    if (isNaN(amount) || amount <= 0) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Give Coins')
                .setDescription('Please enter a valid amount to give.')
                .setColor(0xffd700)
        ] });
    }
    let targetUser = message.mentions.users.first();
    if (!targetUser && userMention) {
        // Try to fetch by ID if provided
        targetUser = message.client.users.cache.get(userMention) || null;
    }
    if (!targetUser) targetUser = message.author;

    if (!(targetUser.id in userBalances)) userBalances[targetUser.id] = STARTING_BALANCE;
    userBalances[targetUser.id] += amount;

    // Confirmation to owner
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('Give Coins')
            .setDescription(`You gave **${amount}** coins to <@${targetUser.id}>!\nTheir new balance: ${userBalances[targetUser.id]}`)
            .setColor(0x43b581)
    ] });

    // If giving to someone else, notify them
    if (targetUser.id !== message.author.id) {
        sendAsFloofWebhook(message, { content: `<@${targetUser.id}>`, embeds: [
            new EmbedBuilder()
                .setTitle('You received coins!')
                .setDescription(`<@${message.author.id}> gave you **${amount}** coins!\nYour new balance: ${userBalances[targetUser.id]}`)
                .setColor(0x43b581)
        ] });
    }
    saveBalances();
}

// Release a user from arrested state (owner only)
function release(message, userMention) {
    if (message.author.id !== OWNER_ID) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Owner Only')
                .setDescription('This command is for the bot owner only!')
                .setColor(0xff0000)
        ] });
    }
    
    let targetUser = message.mentions.users.first();
    if (!targetUser && userMention) {
        // Try to fetch by ID if provided
        targetUser = message.client.users.cache.get(userMention) || null;
    }
    
    if (!targetUser) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Release User')
                .setDescription('Please mention a user or provide their ID to release from arrest.')
                .setColor(0xffd700)
        ] });
    }
    
    // Import arrested users from beatup.js
    const { isArrested, releaseUser } = require('./beatup');
    
    if (!isArrested(targetUser.id)) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Release User')
                .setDescription(`<@${targetUser.id}> is not currently arrested!`)
                .setColor(0xffd700)
        ] });
    }
    
    // Release the user
    releaseUser(targetUser.id);
    
    // Confirmation to owner
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('🔓 User Released')
            .setDescription(`<@${targetUser.id}> has been released from arrest!\n\n✅ They can now use gambling commands again.`)
            .setColor(0x43b581)
    ] });
}

module.exports = {
    give,
    release,
    // Add more exports here as you add commands
};
