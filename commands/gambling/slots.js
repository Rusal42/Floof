// slots.js
// Classic emoji slots command for Floof bot

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { loadBalances, saveBalances, getBalance, setBalance, addBalance } = require('./utils/balance-manager');

const OWNER_ID = '1007799027716329484';

// Emoji slots setup
const slotEmojis = ['🍒', '🍋', '🍉', '🍇', '🍀', '💎', '⭐'];
const slotPayouts = {
    '🍒🍒🍒': 5,
    '🍋🍋🍋': 7,
    '🍉🍉🍉': 10,
    '🍇🍇🍇': 12,
    '🍀🍀🍀': 20,
    '💎💎💎': 50,
    '⭐⭐⭐': 100
};

function slots(message, amountArg) {
    const userId = message.author.id;
    
    // Check if user is arrested
    const { isArrested, getArrestTimeRemaining } = require('./beatup');
    if (isArrested(userId)) {
        const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Slots')
                    .setDescription(`You are currently arrested and cannot gamble! You'll be free in **${remainingMinutes} minutes**.`)
                    .setColor(0xff6961)
            ]
        });
    }
    const now = Date.now();
    // No casino police logic here
    // Cooldown for slots (30s)
    if (!slots.cooldowns) slots.cooldowns = {};
    const COOLDOWN = 30 * 1000;
    if (slots.cooldowns[userId] && now - slots.cooldowns[userId] < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - slots.cooldowns[userId])) / 1000);
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Slots')
                .setDescription(`You need to wait ${remaining} seconds before playing slots again!`)
                .setColor(0x7289da)
        ] });
    }
    slots.cooldowns[userId] = now;
    let amount = parseInt(amountArg, 10);
    if (isNaN(amount) || amount <= 0) {
        amount = 10;
    }
    const currentBalance = getBalance(userId);
    if (currentBalance < amount) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Slots')
                .setDescription(`You only have ${currentBalance} coins!`)
                .setColor(0xffd700)
        ] });
    }
    // Spin the slots
    const spinArr = Array(3).fill().map(() => slotEmojis[Math.floor(Math.random() * slotEmojis.length)]);
    const result = spinArr.join('');
    let payout = 0;
    let winType = null;
    if (slotPayouts[result]) {
        payout = amount * slotPayouts[result];
        addBalance(userId, payout);
        winType = 'JACKPOT!';
    } else if (spinArr[0] === spinArr[1] || spinArr[1] === spinArr[2] || spinArr[0] === spinArr[2]) {
        payout = Math.floor(amount * 1.5);
        addBalance(userId, payout);
        winType = 'Small Win!';
    } else {
        addBalance(userId, -amount);
        winType = 'No Win';
    }
    saveBalances();
    const embed = new EmbedBuilder()
        .setTitle('🎰 Floof Slots')
        .setDescription(
            `**${spinArr[0]} | ${spinArr[1]} | ${spinArr[2]}**\n\n` +
            (payout > 0 ? `**${winType}** You won **${payout}** coins!` : 'You lost your bet!') +
            `\nYour new balance: **${getBalance(userId).toLocaleString()}** coins.`
        )
        .setColor(payout > 0 ? 0x43b581 : 0xff6961);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports = {
    name: 'slots',
    description: 'Play the slot machine and bet your coins for big payouts',
    aliases: ['slot'],
    permissions: [],
    cooldown: 30,
    
    async execute(message, args) {
        const amountArg = args[0];
        await slots(message, amountArg);
    },
    
    // Export utility functions for use by other parts of the bot
    slots
};
