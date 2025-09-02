const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance, hasBalance } = require('./utils/balance-manager');

module.exports = {
    name: 'coinflip',
    description: 'Flip a coin and bet on heads or tails',
    usage: '%coinflip <heads/tails> <amount>',
    category: 'gambling',
    aliases: ['cf', 'flip'],

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is sleeping
        const { isUserSleeping } = require('./utils/blackmarket-manager');
        if (isUserSleeping(userId)) {
            return sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`😴 You are fast asleep! You cannot gamble while under the effects of sleeping pills.\n\n💊 Wait for the effects to wear off before gambling again.`)
                        .setColor(0x9b59b6)
                ]
            });
        }
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot gamble for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length < 2) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Usage: `%coinflip <heads/tails> <amount>`\nExample: `%coinflip heads 100`')
                        .setColor(0xff0000)
                ]
            });
        }

        const side = args[0].toLowerCase();
        if (!['heads', 'tails', 'h', 't'].includes(side)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please choose either `heads` or `tails` (or `h`/`t`)')
                        .setColor(0xff0000)
                ]
            });
        }

        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount <= 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please provide a valid positive amount to bet!')
                        .setColor(0xff0000)
                ]
            });
        }

        if (amount > 10000) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Maximum bet is 10,000 coins!')
                        .setColor(0xff0000)
                ]
            });
        }

        if (!hasBalance(userId, amount)) {
            const currentBalance = getBalance(userId);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have enough coins! You have **${currentBalance.toLocaleString()}** coins but tried to bet **${amount.toLocaleString()}** coins.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Normalize the side
        const chosenSide = (side === 'h' || side === 'heads') ? 'heads' : 'tails';
        
        // Flip the coin
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = chosenSide === result;
        
        let newBalance;
        if (won) {
            newBalance = addBalance(userId, amount);
        } else {
            newBalance = subtractBalance(userId, amount);
        }

        const embed = new EmbedBuilder()
            .setTitle('🪙 Coinflip Result')
            .setDescription(`You chose: **${chosenSide}**\nResult: **${result}**\n\n${won ? '🎉 You won!' : '😔 You lost!'}\n\n💰 Balance: **${newBalance.toLocaleString()}** coins (${won ? '+' : '-'}${amount.toLocaleString()})`)
            .setColor(won ? 0x00ff00 : 0xff0000)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
