const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

module.exports = {
    name: 'craps',
    description: 'Play Craps - classic dice casino game',
    usage: '%craps <bet> <pass/dontpass/field/any7>',
    category: 'gambling',
    aliases: ['dice'],
    cooldown: 4,

    async execute(message, args) {
        const userId = message.author.id;
        
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

        // Check sleep drug effect
        const { isSleeping, getSleepTimeRemaining } = require('./utils/sleep-manager');
        if (isSleeping(userId)) {
            const remainingMinutes = Math.ceil(getSleepTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`😴 You are currently sleeping peacefully! You cannot gamble for another **${remainingMinutes}** minutes.`)
                        .setColor(0x9b59b6)
                ]
            });
        }

        if (args.length < 2) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('🎲 **Craps** | Types: pass/field/any7 | Payouts: 2x/2x/5x | Min: 50 coins\n`%craps <bet> <type>`')
                        .setColor(0xe74c3c)
                ]
            });
        }

        const betAmount = parseInt(args[0]);
        const betType = args[1].toLowerCase();

        if (isNaN(betAmount) || betAmount < 50) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Invalid bet amount! Minimum bet is **50** coins.')
                        .setColor(0xff0000)
                ]
            });
        }

        if (!['pass', 'dontpass', 'field', 'any7'].includes(betType)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Invalid bet type! Choose: **pass**, **dontpass**, **field**, or **any7**')
                        .setColor(0xff0000)
                ]
            });
        }

        const userBalance = getBalance(userId);
        if (betAmount > userBalance) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ Insufficient funds! You have **${userBalance.toLocaleString()}** coins.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Deduct bet
        subtractBalance(userId, betAmount);

        // Roll dice
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;

        // Determine winnings
        let winnings = 0;
        let won = false;
        let resultText = '';

        switch (betType) {
            case 'pass':
                if ([7, 11].includes(total)) {
                    won = true;
                    winnings = betAmount * 2;
                    resultText = 'Pass Line wins on 7 or 11!';
                } else if ([2, 3, 12].includes(total)) {
                    resultText = 'Pass Line loses on 2, 3, or 12!';
                } else {
                    resultText = `Point established at ${total}. (Simplified: treating as push)`;
                    winnings = betAmount; // Return bet for simplicity
                    won = true;
                }
                break;
            case 'dontpass':
                if ([2, 3].includes(total)) {
                    won = true;
                    winnings = betAmount * 2;
                    resultText = 'Don\'t Pass wins on 2 or 3!';
                } else if ([7, 11].includes(total)) {
                    resultText = 'Don\'t Pass loses on 7 or 11!';
                } else if (total === 12) {
                    resultText = 'Don\'t Pass pushes on 12!';
                    winnings = betAmount; // Return bet
                    won = true;
                } else {
                    resultText = `Point established at ${total}. (Simplified: treating as push)`;
                    winnings = betAmount; // Return bet for simplicity
                    won = true;
                }
                break;
            case 'field':
                if ([2, 3, 4, 9, 10, 11, 12].includes(total)) {
                    won = true;
                    if ([2, 12].includes(total)) {
                        winnings = betAmount * 3; // Triple on 2 or 12
                        resultText = `Field wins triple on ${total}!`;
                    } else {
                        winnings = betAmount * 2;
                        resultText = `Field wins on ${total}!`;
                    }
                } else {
                    resultText = `Field loses on ${total}!`;
                }
                break;
            case 'any7':
                if (total === 7) {
                    won = true;
                    winnings = betAmount * 5;
                    resultText = 'Any 7 wins!';
                } else {
                    resultText = `Any 7 loses - rolled ${total}!`;
                }
                break;
        }

        if (won) {
            addBalance(userId, winnings);
        }

        // Create result embed
        const embed = new EmbedBuilder()
            .addFields(
                {
                    name: '🎲 Roll',
                    value: `${getDieEmoji(die1)} ${getDieEmoji(die2)}\n**${total}**`,
                    inline: true
                },
                {
                    name: '🎯 Bet',
                    value: `${betType.toUpperCase()}\n${betAmount.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📊 Result',
                    value: resultText.replace('Pass Line', 'Pass').replace('Don\'t Pass', 'DontPass'),
                    inline: true
                }
            )
            .setFooter({ text: `Balance: ${getBalance(userId).toLocaleString()} coins` });

        if (won) {
            embed.setColor(0x00ff00);
            const profit = winnings - betAmount;
            if (profit > 0) {
                embed.setDescription(`🎉 **WON!** +${profit.toLocaleString()} coins | Total: ${winnings.toLocaleString()}`);
            } else {
                embed.setDescription(`🔄 **PUSH** | Returned: ${winnings.toLocaleString()} coins`);
            }
        } else {
            embed.setColor(0xff0000);
            embed.setDescription(`💸 **LOST** -${betAmount.toLocaleString()} coins`);
        }

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};

function getDieEmoji(value) {
    const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return diceEmojis[value] || '🎲';
}
