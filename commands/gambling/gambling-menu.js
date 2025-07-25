// gambling-menu.js
// Sends a select menu for all gambling commands

const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

async function gamblingMenu(message) {
    const embed = new EmbedBuilder()
        .setTitle('🎲 Floof Gambling Commands')
        .setDescription(
            '**%coinflip <heads|tails> <amount>**\nBet coins on a coin toss. Example: `%coinflip heads 100`\n\n' +
            '**%beg**\nIf you lose all your coins, use `%beg` to get back on your feet and start gambling again!\n\n' +
            '**%balance [@user|userID]**\nCheck your own or another user\'s coin balance. Example: `%balance @FloofUser`\n\n' +
            '**%donate <@user> <amount>**\nDonate coins to another user. Example: `%donate @FloofUser 50`\n\n' +
            '**%work**\nWork various jobs to earn coins! Has a 12-second cooldown. Example: `%work`\n\n' +
            '**%beatup <@user>**\nBeat up another user! 80% chance to steal coins, 20% chance to get arrested. Example: `%beatup @user`\n\n' +
            '**%slots <amount>**\nSpin the emoji slot machine for a chance to win big! Example: `%slots 100`\n\n' +
            '**%blackjack <amount>**\nPlay a game of blackjack against the dealer. Example: `%blackjack 200`\n\n' +
            '**%leaderboard**\nView the top 10 richest users in the casino.'
        )
        .setColor(0xffd700);
    await sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports = { gamblingMenu };
