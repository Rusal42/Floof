// gambling.js
// All gambling-related commands for Floof bot

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

const fs = require('fs');
const path = require('path');
const balancesDir = path.resolve(__dirname, '../../data');
const BALANCES_FILE = path.join(balancesDir, 'balances.json');

let userBalances = {};
const STARTING_BALANCE = 1000;
const begCooldowns = {};

function loadBalances() {
    try {
        if (!fs.existsSync(balancesDir)) {
            fs.mkdirSync(balancesDir);
        }
        if (fs.existsSync(BALANCES_FILE)) {
            const data = fs.readFileSync(BALANCES_FILE, 'utf8');
            userBalances = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading balances.json:', err);
        userBalances = {};
    }
}

function saveBalances() {
    try {
        fs.writeFileSync(BALANCES_FILE, JSON.stringify(userBalances, null, 2));
    } catch (err) {
        console.error('Error saving balances.json:', err);
    }
}

// Load balances on startup
loadBalances();

function coinflip(message, side, amount) {
    const userId = message.author.id;
    
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
    if (!(userId in userBalances)) userBalances[userId] = STARTING_BALANCE;
    if (userBalances[userId] < amount) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Coinflip')
                .setDescription(`You only have ${userBalances[userId]} coins!`)
                .setColor(0xffd700)
        ] });
    }
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    let reply;
    if (side === result) {
        userBalances[userId] += amount;
        saveBalances();
        reply = `🪙 The coin landed on **${result}**! You won ${amount} coins. New balance: ${userBalances[userId]}`;
    } else {
        userBalances[userId] -= amount;
        saveBalances();
        reply = `🪙 The coin landed on **${result}**! You lost ${amount} coins. New balance: ${userBalances[userId]}`;
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
    if (!(targetUser.id in userBalances)) userBalances[targetUser.id] = STARTING_BALANCE;
    saveBalances();
    const isSelf = targetUser.id === message.author.id;
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('Balance')
            .setDescription(isSelf ?
                `You (${targetUser.tag}) have **${userBalances[targetUser.id]}** coins.` :
                `${targetUser.tag} has **${userBalances[targetUser.id]}** coins.`)
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
    if (!(userId in userBalances)) userBalances[userId] = STARTING_BALANCE;
    begCooldowns[userId] = now;

    // Insulting/funny outcomes
    const outcomes = [
        // Good outcomes
        (user) => {
            const amount = Math.floor(Math.random() * 201) + 50;
            userBalances[user] += amount;
            return {
                desc: `You begged like a true degenerate and got **${amount}** coins. Try not to spend it all in one place.\nNew balance: ${userBalances[user]}`,
                color: 0x7289da
            };
        },
        // Bad outcomes
        (user) => {
            const loss = Math.floor(Math.random() * 51) + 10;
            userBalances[user] = Math.max(0, userBalances[user] - loss);
            return {
                desc: `Floof laughs and steals **${loss}** coins from your pocket. Maybe begging isn't your thing.\nNew balance: ${userBalances[user]}`,
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
            userBalances[user] += amount;
            return {
                desc: `Floof sighs and tosses you **${amount}** pity coins. Don't spend it all in one place.\nNew balance: ${userBalances[user]}`,
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
            userBalances[user] = Math.max(0, userBalances[user] - loss);
            return {
                desc: `Floof is offended by your begging and fines you **${loss}** coins.\nNew balance: ${userBalances[user]}`,
                color: 0xff6961
            };
        },
        (user) => {
            const amount = Math.floor(Math.random() * 51) + 10;
            userBalances[user] += amount;
            return {
                desc: `You annoy Floof, but someone else takes pity and gives you **${amount}** coins.\nNew balance: ${userBalances[user]}`,
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
    if (!(userId in userBalances)) userBalances[userId] = STARTING_BALANCE;
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
    userBalances[userId] += payout;
    saveBalances();
    sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('Work')
                .setDescription(`You worked as a **${job.name}** and earned **${payout}** coins!\nNew balance: **${userBalances[userId]}** coins.`)
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
    if (!(senderId in userBalances)) userBalances[senderId] = STARTING_BALANCE;
    if (!(targetUser.id in userBalances)) userBalances[targetUser.id] = STARTING_BALANCE;
    if (userBalances[senderId] < amount) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Donate')
                .setDescription('You do not have enough coins to donate that amount!')
                .setColor(0xff6961)
        ] });
    }
    userBalances[senderId] -= amount;
    userBalances[targetUser.id] += amount;
    saveBalances();
    // Sender receipt
    sendAsFloofWebhook(message, { embeds: [
        new EmbedBuilder()
            .setTitle('Donate')
            .setDescription(`You donated **${amount}** coins to <@${targetUser.id}>!\nYour new balance: ${userBalances[senderId]}`)
            .setColor(0x7289da)
    ] });
    // Recipient receipt (in channel, tag recipient)
    sendAsFloofWebhook(message, { content: `<@${targetUser.id}>`, embeds: [
        new EmbedBuilder()
            .setTitle('You received a donation!')
            .setDescription(`<@${senderId}> donated **${amount}** coins to you!\nYour new balance: ${userBalances[targetUser.id]}`)
            .setColor(0x43b581)
    ] });
}

module.exports = {
    coinflip,
    balance,
    beg,
    work,
    donate,
    userBalances,
    STARTING_BALANCE,
    saveBalances, // Export for use in owner-gambling.js
};
