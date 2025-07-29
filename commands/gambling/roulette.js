const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, saveBalances } = require('./utils/balance-manager');

// Roulette wheel numbers (0-36)
const WHEEL_NUMBERS = Array.from({ length: 37 }, (_, i) => i);

// Number colors (0 is green, others alternate red/black)
const NUMBER_COLORS = {
    0: 'green',
    // Red numbers
    1: 'red', 3: 'red', 5: 'red', 7: 'red', 9: 'red', 12: 'red',
    14: 'red', 16: 'red', 18: 'red', 19: 'red', 21: 'red', 23: 'red',
    25: 'red', 27: 'red', 30: 'red', 32: 'red', 34: 'red', 36: 'red',
    // Black numbers (all others)
};

// Payout multipliers
const PAYOUTS = {
    'number': 35,  // Single number (0-36)
    'color': 1,    // Red or black (1:1)
    'green': 17    // Green (0) (17:1)
};

// Bet types and their validation
const BET_TYPES = {
    // Single number (0-36)
    'number': (bet) => !isNaN(bet) && bet >= 0 && bet <= 36,
    // Red or Black
    'color': (bet) => ['red', 'black'].includes(bet.toLowerCase()),
    // Green (0)
    'green': (bet) => bet === '0' || bet === '00'
};

// Spin the wheel and get a random number
function spinWheel() {
    return Math.floor(Math.random() * 37); // 0-36
}

// Check if a bet wins
function checkWin(betType, betValue, result) {
    if (result === 0) {
        return betType === 'number' && parseInt(betValue) === 0;
    }

    const color = NUMBER_COLORS[result] || 'black';
    
    switch (betType) {
        case 'number':
            return parseInt(betValue) === result;
        case 'color':
            return color === betValue.toLowerCase();
        case 'green':
        default:
            return false;
    }
}

// Get the payout for a bet type
function getPayout(betType) {
    return PAYOUTS[betType] || 1;
}

// Roulette command
async function roulette(message, args) {
    const userId = message.author.id;
    const amount = parseInt(args[0]);
    let betType = args[1]?.toLowerCase();
    let betValue = args[2];

    // Check if amount is valid
    if (!amount || isNaN(amount) || amount <= 0) {
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎰 Roulette - Invalid Bet')
                    .setDescription('Please specify a valid bet amount! Example: `%roulette 100 color red`')
                    .setColor(0xff6961)
            ]
        });
        return showRouletteHelp(message);
    }
    
    // Default to color bet if no bet type specified
    if (!betType || !['color', 'number', 'green'].includes(betType)) {
        betType = 'color';
        betValue = args[1]?.toLowerCase() || 'red'; // Default to red if no color specified
    }

    // Check balance
    const balance = getBalance(userId);
    if (amount > balance) {
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎰 Roulette')
                    .setDescription(`You don't have enough coins! Your balance: **${balance}**`)
                    .setColor(0xff6961)
            ]
        });
    }

    // Process bet type and value
    if (betType === 'number') {
        betValue = parseInt(args[2]);
        if (isNaN(betValue) || betValue < 0 || betValue > 36) {
            await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🎰 Roulette - Invalid Number')
                        .setDescription('Please specify a valid number between 0 and 36! Example: `%roulette 100 number 17`')
                        .setColor(0xff6961)
                ]
            });
            return showRouletteHelp(message);
        }
    } else if (betType === 'color') {
        betValue = (args[2]?.toLowerCase() || 'red');
        if (!['red', 'black'].includes(betValue)) {
            await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🎰 Roulette - Invalid Color')
                        .setDescription('Please specify either `red` or `black`! Example: `%roulette 100 color red`')
                        .setColor(0xff6961)
                ]
            });
            return showRouletteHelp(message);
        }
    } else if (betType === 'green') {
        betValue = '0';
    }

    // Final validation
    if (!BET_TYPES[betType] || (betValue === undefined || !BET_TYPES[betType](betValue))) {
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎰 Roulette - Invalid Bet')
                    .setDescription('Please specify a valid bet! Example: `%roulette 100 color red`')
                    .setColor(0xff6961)
            ]
        });
        return showRouletteHelp(message);
    }

    // Place bet
    addBalance(userId, -amount);
    saveBalances();

    // Spin the wheel
    const result = spinWheel();
    const resultColor = NUMBER_COLORS[result] || 'black';
    const won = checkWin(betType, betValue, result);
    const payout = getPayout(betType);
    const winnings = won ? amount * (payout + 1) : 0;

    // Update balance if won
    if (won) {
        addBalance(userId, winnings);
        saveBalances();
    }

    // Create result embed
    const embed = new EmbedBuilder()
        .setTitle('🎰 Roulette')
        .setDescription(
            `**The ball lands on... ${result} ${resultColor === 'red' ? '🔴' : resultColor === 'green' ? '🟢' : '⚫'}**\n` +
            `You ${won ? 'won' : 'lost'} **${won ? winnings : amount}** coins!`
        )
        .setColor(won ? 0x43b581 : 0xff6961);

    // Send result
    await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Show roulette help
async function showRouletteHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('🎰 Roulette Help')
        .setDescription(
            'Place bets on the roulette wheel!\n\n' +
            '**Bet Types:**\n' +
            '`%roulette <amount> color <red/black>` - Bet on red or black (1:1)\n' +
            '`%roulette <amount> number <0-36>` - Bet on a single number (35:1)\n' +
            '`%roulette <amount> green` - Bet on green (0) (17:1)\n\n' +
            '**Examples:**\n' +
            '`%roulette 100 color red` - Bet 100 on red\n' +
            '`%roulette 50 number 17` - Bet 50 on number 17\n' +
            '`%roulette 200 green` - Bet 200 on green (0)'
        )
        .setColor(0x3498db);

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports = {
    name: 'roulette',
    description: 'Play roulette and bet your coins',
    aliases: ['rl'],
    permissions: [],
    cooldown: 3,
    
    async execute(message, args) {
        await roulette(message, args);
    },
    
    // Export functions for testing
    _test: {
        spinWheel,
        checkWin
    }
};
