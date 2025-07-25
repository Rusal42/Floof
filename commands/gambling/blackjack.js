const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { loadBalances, saveBalances, getBalance, setBalance, addBalance } = require('./utils/balance-manager');

// Blackjack command: %blackjack <amount>
// In-memory blackjack state: { [userId_channelId]: { deck, player, dealer, bet, messageId } }
const blackjackGames = {};
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ value, suit });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function handValue(hand) {
    let value = 0;
    let aces = 0;
    for (const card of hand) {
        if (card.value === 'A') {
            value += 11;
            aces++;
        } else if (['K', 'Q', 'J'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value);
        }
    }
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    return value;
}

function formatHand(hand, hideFirstCard = false) {
    if (hideFirstCard) {
        return '🂠 ' + hand.slice(1).map(card => `${card.value}${card.suit}`).join(' ');
    }
    return hand.map(card => `${card.value}${card.suit}`).join(' ');
}

async function blackjack(message, amountArg) {
    const userId = message.author.id;
    
    // Check if user is arrested
    const { isArrested, getArrestTimeRemaining } = require('./beatup');
    if (isArrested(userId)) {
        const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Blackjack')
                    .setDescription(`You are currently arrested and cannot gamble! You'll be free in **${remainingMinutes} minutes**.`)
                    .setColor(0xff6961)
            ]
        });
    }
    
    // Restrict to channels under category 1393667685753159742
    if (!message.channel.parentId || message.channel.parentId !== '1393667685753159742') {
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Blackjack')
                    .setDescription('Blackjack can only be played in channels under the allowed gambling category.')
                    .setColor(0xff6961)
            ]
        });
    }
    amountArg = parseInt(amountArg, 10);
    if (isNaN(amountArg) || amountArg <= 0) {
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Blackjack')
                    .setDescription('Usage: %blackjack <amount>')
                    .setColor(0xffd700)
            ]
        });
    }
    const currentBalance = getBalance(userId);
    if (currentBalance < amountArg) {
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Blackjack')
                    .setDescription('You do not have enough coins to play blackjack!')
                    .setColor(0xff6961)
            ]
        });
    }
    // Deduct bet up front
    addBalance(userId, -amountArg);
    saveBalances();
    // Initialize deck and hands
    const deck = createDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];
    // Store game state
    const stateKey = `${userId}_${message.channel.id}`;
    blackjackGames[stateKey] = { deck, player, dealer, bet: amountArg, messageId: null };
    // Prepare embed
    const embed = new EmbedBuilder()
        .setTitle('Blackjack')
        .setDescription(
            `Your hand: ${formatHand(player)} (**${handValue(player)}**)
Dealer: ${formatHand(dealer, true)}\n\nReact with the buttons below to Hit or Stand.`
        )
        .setColor(0x3498db);
    // Buttons
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('blackjack_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('blackjack_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
    );
    // Send as Floof webhook
    const sentMsg = await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
    // Save messageId for interaction filtering
    if (sentMsg && sentMsg.id) {
        blackjackGames[stateKey].messageId = sentMsg.id;
    }
}


module.exports = {
    name: 'blackjack',
    description: 'Play blackjack and bet your coins against the dealer',
    aliases: ['bj'],
    permissions: [],
    cooldown: 3,
    
    async execute(message, args) {
        const amountArg = args[0];
        await blackjack(message, amountArg);
    },
    
    // Export utility functions for use by other parts of the bot
    blackjack,
    blackjackGames,
    handValue,
    formatHand
};
