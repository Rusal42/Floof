// gambling.js
// All gambling-related commands for Floof bot

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, setBalance, addBalance, subtractBalance, hasBalance, STARTING_BALANCE } = require('./utils/balance-manager');

const begCooldowns = {};

function coinflip(message, side, amount) {
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
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Coinflip')
                    .setDescription(`You are currently arrested and cannot gamble! You'll be free in **${remainingMinutes} minutes**.`)
                    .setColor(0xff6961)
            ]
        });
    }
    
    side = (side || '').toLowerCase();
    if (side !== 'heads' && side !== 'tails') {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Coinflip')
                .setDescription('Usage: %coinflip <heads|tails> <amount>')
                .setColor(0xffd700)
        ] });
    }
    amount = parseInt(amount, 10);
    if (isNaN(amount) || amount <= 0) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Coinflip')
                .setDescription('Please enter a valid amount to bet.')
                .setColor(0xffd700)
        ] });
    }
    const currentBalance = getBalance(userId);
    if (currentBalance < amount) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Coinflip')
                .setDescription(`You only have ${currentBalance} coins!`)
                .setColor(0xffd700)
        ] });
    }
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    let reply;
    let newBalance;
    if (side === result) {
        newBalance = addBalance(userId, amount);
        reply = `🪙 The coin landed on **${result}**! You won ${amount} coins. New balance: ${newBalance}`;
    } else {
        newBalance = subtractBalance(userId, amount);
        reply = `🪙 The coin landed on **${result}**! You lost ${amount} coins. New balance: ${newBalance}`;
    }
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('Coinflip')
            .setDescription(reply)
            .setColor(0xffd700)
    ] });
}

function balance(message, userArg) {
    let targetUser = message.mentions.users.first();
    // If no mention, but an argument is provided, try to fetch by ID
    if (!targetUser && userArg) {
        targetUser = message.client.users.cache.get(userArg) || null;
    }
    // If no targetUser found, default to the sender
    if (!targetUser) targetUser = message.author;
    const targetBalance = getBalance(targetUser.id);
    const isSelf = targetUser.id === message.author.id;
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('Balance')
            .setDescription(isSelf ?
                `You (${targetUser.tag}) have **${targetBalance}** coins.` :
                `${targetUser.tag} has **${targetBalance}** coins.`)
            .setColor(0xffd700)
    ] });
}

function beg(message) {
    const userId = message.author.id;
    
    // Check if user is arrested
    const { isArrested, getArrestTimeRemaining } = require('./beatup');
    if (isArrested(userId)) {
        const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Beg')
                    .setDescription(`You are currently arrested and cannot beg! You'll be free in **${remainingMinutes} minutes**.`)
                    .setColor(0xff6961)
            ]
        });
    }
    const now = Date.now();
    const COOLDOWN = 30 * 1000; // 30 seconds in ms
    if (begCooldowns[userId] && now - begCooldowns[userId] < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - begCooldowns[userId])) / 1000);
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beg')
                .setDescription(`You must wait ${remaining} more second(s) before begging again!`)
                .setColor(0x7289da)
        ] });
    }
    const currentBalance = getBalance(userId);
    begCooldowns[userId] = now;

    // Insulting/funny outcomes
    const outcomes = [
        // Good outcomes
        (user) => {
            const amount = Math.floor(Math.random() * 201) + 50;
            const newBalance = addBalance(user, amount);
            return {
                desc: `You begged like a true degenerate and got **${amount}** coins. Try not to spend it all in one place.\nNew balance: ${newBalance}`,
                color: 0x7289da
            };
        },
        // Bad outcomes
        (user) => {
            const loss = Math.floor(Math.random() * 51) + 10;
            const newBalance = subtractBalance(user, loss);
            return {
                desc: `Floof laughs and steals **${loss}** coins from your pocket. Maybe begging isn't your thing.\nNew balance: ${newBalance}`,
                color: 0xff6961
            };
        },
        (user) => {
            return {
                desc: `You tripped over your own feet and found nothing but dust.\nNo coins for you!`,
                color: 0xb0b0b0
            };
        },
        (user) => {
            return {
                desc: `Floof glares at you and says: "Get a job." You received absolutely nothing.`,
                color: 0x36393f
            };
        },
        (user) => {
            const amount = Math.floor(Math.random() * 101) + 10;
            const newBalance = addBalance(user, amount);
            return {
                desc: `Floof sighs and tosses you **${amount}** pity coins. Don't spend it all in one place.\nNew balance: ${newBalance}`,
                color: 0x7289da
            };
        },
        (user) => {
            return {
                desc: `A passing seagull steals your dignity (and your chance at coins). Try again later.`,
                color: 0x7289da
            };
        },
        (user) => {
            return {
                desc: `You begged so pathetically that even the bots ignored you. No coins for you.`,
                color: 0x7289da
            };
        },
        (user) => {
            const loss = Math.floor(Math.random() * 101) + 10;
            const newBalance = subtractBalance(user, loss);
            return {
                desc: `Floof is offended by your begging and fines you **${loss}** coins.\nNew balance: ${newBalance}`,
                color: 0xff6961
            };
        },
        (user) => {
            const amount = Math.floor(Math.random() * 51) + 10;
            const newBalance = addBalance(user, amount);
            return {
                desc: `You annoy Floof, but someone else takes pity and gives you **${amount}** coins.\nNew balance: ${newBalance}`,
                color: 0x7289da
            };
        },
        (user) => {
            return {
                desc: `You begged so loudly that you were ignored by everyone. Try again later.`,
                color: 0x36393f
            };
        }
    ];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)](userId);
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('Beg')
            .setDescription(outcome.desc)
            .setColor(outcome.color)
    ] });
}
function work(message) {
    const userId = message.author.id;
    if (!work.cooldowns) work.cooldowns = {};
    const now = Date.now();
    const COOLDOWN = 12 * 1000;
    // Check if user is arrested from beatup command
    const { isArrested, getArrestTimeRemaining } = require('./beatup');
    if (isArrested(userId)) {
        const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Work')
                    .setDescription(`You are currently arrested and cannot work! You'll be free in **${remainingMinutes} minutes**.`)
                    .setColor(0xff6961)
            ]
        });
    }
    if (work.cooldowns[userId] && now - work.cooldowns[userId] < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - work.cooldowns[userId])) / 1000);
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Work')
                    .setDescription(`You must wait ${remaining} more second(s) before working again!`)
                    .setColor(0x7289da)
            ]
        });
    }
    work.cooldowns[userId] = now;
    const currentBalance = getBalance(userId);
    // Job list with payout ranges
    const jobs = [
        { name: 'Dog Walker', min: 25, max: 75 },
        { name: 'Pizza Delivery', min: 50, max: 150 },
        { name: 'Streamer', min: 100, max: 500 }, // Increased from 10-300
        { name: 'Cat Cafe Barista', min: 40, max: 120 },
        { name: 'Meme Lord', min: 50, max: 400 }, // Increased from 5-250
        { name: 'Professional Sleeper', min: 20, max: 150 }, // Increased from 1-100
        { name: 'Treasure Hunter', min: 200, max: 800 }, // Increased from 100-400
        { name: 'Space Janitor', min: 300, max: 900 }, // High-tier space job!
        { name: 'Magical Floof', min: 500, max: 1200 }, // Increased from 200-600 (rare jackpot)
        { name: 'Fortune Cookie Writer', min: 40, max: 130 } // Increased from 30-90
    ];
    // Random job selection
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    // Random payout in range
    const payout = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    const newBalance = addBalance(userId, payout);
    sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('Work')
                .setDescription(`You worked as a **${job.name}** and earned **${payout}** coins!\nNew balance: **${newBalance}** coins.`)
                .setColor(0x43b581)
        ]
    });
}

function donate(message, targetUser, amount) {
    const senderId = message.author.id;
    
    // Check if user is arrested
    const { isArrested, getArrestTimeRemaining } = require('./beatup');
    if (isArrested(senderId)) {
        const remainingMinutes = Math.ceil(getArrestTimeRemaining(senderId) / 60);
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Donate')
                    .setDescription(`You are currently arrested and cannot donate! You'll be free in **${remainingMinutes} minutes**.`)
                    .setColor(0xff6961)
            ]
        });
    }
    if (!targetUser || !targetUser.id) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Donate')
                .setDescription('You must mention a user to donate to!')
                .setColor(0xff6961)
        ] });
    }
    if (targetUser.id === senderId) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Donate')
                .setDescription('You cannot donate to yourself!')
                .setColor(0xff6961)
        ] });
    }
    amount = parseInt(amount, 10);
    if (isNaN(amount) || amount <= 0) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Donate')
                .setDescription('Please enter a valid amount to donate.')
                .setColor(0xffd700)
        ] });
    }
    const senderBalance = getBalance(senderId);
    if (senderBalance < amount) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Donate')
                .setDescription('You do not have enough coins to donate that amount!')
                .setColor(0xff6961)
        ] });
    }
    const senderNewBalance = subtractBalance(senderId, amount);
    const receiverNewBalance = addBalance(targetUser.id, amount);
    // Sender receipt
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('Donate')
            .setDescription(`You donated **${amount}** coins to <@${targetUser.id}>!\nYour new balance: ${senderNewBalance}`)
            .setColor(0x7289da)
    ] });
    // Recipient receipt (in channel, tag recipient)
    sendAsFloofWebhook(message, { content: `<@${targetUser.id}>`, embeds: [
        new EmbedBuilder()
            .setTitle('You received a donation!')
            .setDescription(`<@${senderId}> donated **${amount}** coins to you!\nYour new balance: ${receiverNewBalance}`)
            .setColor(0x43b581)
    ] });
}

module.exports = {
    coinflip,
    balance,
    beg,
    work,
    donate
};
