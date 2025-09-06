const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Active poker games
const activeGames = new Map();
const gameCooldowns = new Map();

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

module.exports = {
    name: 'poker',
    description: 'Play Texas Hold\'em Poker against the house',
    usage: '%poker <bet_amount>',
    category: 'gambling',
    aliases: ['holdem', 'texasholdem'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check cooldown
        const now = Date.now();
        const lastGame = gameCooldowns.get(userId);
        if (lastGame && now - lastGame < 10000) {
            const remaining = Math.ceil((10000 - (now - lastGame)) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Please wait **${remaining}** seconds before starting another poker game.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await showPokerHelp(message);
        }

        const betAmount = parseInt(args[0]);
        if (isNaN(betAmount) || betAmount <= 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please provide a valid positive amount to bet!')
                        .setColor(0xff0000)
                ]
            });
        }

        const userBalance = getBalance(userId);
        if (userBalance < betAmount) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have enough coins! You have **${userBalance.toLocaleString()}** coins.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Start new poker game
        gameCooldowns.set(userId, now);
        return await startPokerGame(message, userId, betAmount);
    }
};

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, value: RANK_VALUES[rank] });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function formatCard(card) {
    return `${card.rank}${card.suit}`;
}

function evaluateHand(cards) {
    // Sort cards by value for easier evaluation
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    
    // Check for flush
    const isFlush = cards.every(card => card.suit === cards[0].suit);
    
    // Check for straight
    const values = sorted.map(card => card.value);
    let isStraight = true;
    for (let i = 1; i < values.length; i++) {
        if (values[i-1] - values[i] !== 1) {
            isStraight = false;
            break;
        }
    }
    
    // Special case: A-2-3-4-5 straight (wheel)
    if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
        isStraight = true;
    }
    
    // Count ranks
    const rankCounts = {};
    for (const card of cards) {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    
    // Determine hand ranking
    if (isStraight && isFlush) {
        if (values[0] === 14 && values[1] === 13) return { rank: 9, name: 'Royal Flush', multiplier: 250 };
        return { rank: 8, name: 'Straight Flush', multiplier: 50 };
    }
    if (counts[0] === 4) return { rank: 7, name: 'Four of a Kind', multiplier: 25 };
    if (counts[0] === 3 && counts[1] === 2) return { rank: 6, name: 'Full House', multiplier: 9 };
    if (isFlush) return { rank: 5, name: 'Flush', multiplier: 6 };
    if (isStraight) return { rank: 4, name: 'Straight', multiplier: 4 };
    if (counts[0] === 3) return { rank: 3, name: 'Three of a Kind', multiplier: 3 };
    if (counts[0] === 2 && counts[1] === 2) return { rank: 2, name: 'Two Pair', multiplier: 2 };
    if (counts[0] === 2) return { rank: 1, name: 'Pair', multiplier: 1 };
    return { rank: 0, name: 'High Card', multiplier: 0 };
}

function getBestHand(playerCards, communityCards) {
    const allCards = [...playerCards, ...communityCards];
    let bestHand = null;
    
    // Try all combinations of 5 cards from 7 available
    for (let i = 0; i < allCards.length - 4; i++) {
        for (let j = i + 1; j < allCards.length - 3; j++) {
            for (let k = j + 1; k < allCards.length - 2; k++) {
                for (let l = k + 1; l < allCards.length - 1; l++) {
                    for (let m = l + 1; m < allCards.length; m++) {
                        const hand = [allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]];
                        const evaluation = evaluateHand(hand);
                        
                        if (!bestHand || evaluation.rank > bestHand.rank) {
                            bestHand = { ...evaluation, cards: hand };
                        }
                    }
                }
            }
        }
    }
    
    return bestHand;
}

async function startPokerGame(message, userId, betAmount) {
    const deck = createDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerCards = [deck.pop(), deck.pop()];
    const communityCards = [];
    
    // Deal the flop (3 cards)
    deck.pop(); // Burn card
    communityCards.push(deck.pop(), deck.pop(), deck.pop());
    
    const gameState = {
        userId,
        betAmount,
        deck,
        playerCards,
        dealerCards,
        communityCards,
        stage: 'flop',
        pot: betAmount * 2
    };
    
    activeGames.set(userId, gameState);
    subtractBalance(userId, betAmount);
    
    return await displayPokerGame(message, gameState);
}

async function displayPokerGame(message, gameState) {
    const { playerCards, communityCards, stage, betAmount, pot } = gameState;
    
    let description = `**🃏 Texas Hold'em Poker**\n\n`;
    description += `**💰 Bet:** ${betAmount.toLocaleString()} coins\n`;
    description += `**🎯 Pot:** ${pot.toLocaleString()} coins\n\n`;
    
    description += `**Your Cards:** ${playerCards.map(formatCard).join(' ')}\n\n`;
    
    description += `**Community Cards (${stage.toUpperCase()}):**\n`;
    description += `${communityCards.map(formatCard).join(' ')}`;
    
    if (stage === 'river') {
        description += `\n\n**🎲 Final Results Coming...**`;
    } else {
        description += `\n\n**Choose your action:**`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🃏 Texas Hold\'em Poker')
        .setDescription(description)
        .setColor(0x2ecc71)
        .setTimestamp();
    
    const row = new ActionRowBuilder();
    
    if (stage === 'river') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`poker_showdown_${gameState.userId}`)
                .setLabel('🎯 Showdown')
                .setStyle(ButtonStyle.Success)
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`poker_call_${gameState.userId}`)
                .setLabel('📞 Call')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`poker_raise_${gameState.userId}`)
                .setLabel('⬆️ Raise')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`poker_fold_${gameState.userId}`)
                .setLabel('🚫 Fold')
                .setStyle(ButtonStyle.Danger)
        );
    }
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function handlePokerAction(interaction, action) {
    const userId = interaction.user.id;
    const gameState = activeGames.get(userId);
    
    if (!gameState) {
        return await interaction.reply({ content: '❌ No active poker game found!', ephemeral: true });
    }
    
    await interaction.deferUpdate();
    
    const message = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild
    };
    
    switch (action) {
        case 'call':
            return await handleCall(message, gameState);
        case 'raise':
            return await handleRaise(message, gameState);
        case 'fold':
            return await handleFold(message, gameState);
        case 'showdown':
            return await handleShowdown(message, gameState);
    }
}

async function handleCall(message, gameState) {
    // Move to next stage
    if (gameState.stage === 'flop') {
        // Deal the turn
        gameState.deck.pop(); // Burn card
        gameState.communityCards.push(gameState.deck.pop());
        gameState.stage = 'turn';
    } else if (gameState.stage === 'turn') {
        // Deal the river
        gameState.deck.pop(); // Burn card
        gameState.communityCards.push(gameState.deck.pop());
        gameState.stage = 'river';
    }
    
    return await displayPokerGame(message, gameState);
}

async function handleRaise(message, gameState) {
    const raiseAmount = Math.floor(gameState.betAmount * 0.5);
    const userBalance = getBalance(gameState.userId);
    
    if (userBalance < raiseAmount) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Not enough coins to raise!')
                    .setColor(0xff0000)
            ]
        });
    }
    
    subtractBalance(gameState.userId, raiseAmount);
    gameState.pot += raiseAmount * 2;
    
    // Move to next stage after raise
    return await handleCall(message, gameState);
}

async function handleFold(message, gameState) {
    activeGames.delete(gameState.userId);
    
    const embed = new EmbedBuilder()
        .setTitle('🚫 Folded')
        .setDescription(`You folded your hand and lost **${gameState.betAmount.toLocaleString()}** coins.\n\n**Your Cards:** ${gameState.playerCards.map(formatCard).join(' ')}\n**Community:** ${gameState.communityCards.map(formatCard).join(' ')}`)
        .setColor(0xe74c3c)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleShowdown(message, gameState) {
    const playerBest = getBestHand(gameState.playerCards, gameState.communityCards);
    const dealerBest = getBestHand(gameState.dealerCards, gameState.communityCards);
    
    let result = '';
    let winnings = 0;
    let color = 0xe74c3c;
    
    if (playerBest.rank > dealerBest.rank) {
        winnings = Math.floor(gameState.pot * (1 + playerBest.multiplier * 0.1));
        addBalance(gameState.userId, winnings);
        result = '🎉 **YOU WIN!**';
        color = 0x2ecc71;
    } else if (playerBest.rank < dealerBest.rank) {
        result = '💸 **DEALER WINS**';
    } else {
        // Tie - return bet
        addBalance(gameState.userId, gameState.betAmount);
        result = '🤝 **TIE GAME**';
        color = 0xf39c12;
    }
    
    let description = `${result}\n\n`;
    description += `**Your Hand:** ${gameState.playerCards.map(formatCard).join(' ')}\n`;
    description += `**Best:** ${playerBest.name} (${playerBest.cards.map(formatCard).join(' ')})\n\n`;
    description += `**Dealer Hand:** ${gameState.dealerCards.map(formatCard).join(' ')}\n`;
    description += `**Best:** ${dealerBest.name} (${dealerBest.cards.map(formatCard).join(' ')})\n\n`;
    description += `**Community:** ${gameState.communityCards.map(formatCard).join(' ')}\n\n`;
    
    if (winnings > 0) {
        description += `**💰 Winnings:** ${winnings.toLocaleString()} coins\n`;
    }
    description += `**💳 Balance:** ${getBalance(gameState.userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('🃏 Poker Showdown')
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    
    activeGames.delete(gameState.userId);
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function showPokerHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('🃏 Texas Hold\'em Poker')
        .setDescription(`**How to Play:**
• Get dealt 2 cards, community gets 5 cards
• Make the best 5-card hand possible
• Beat the dealer to win!

**Hand Rankings (High to Low):**
🏆 Royal Flush (250x)
🎯 Straight Flush (50x)
🔥 Four of a Kind (25x)
🏠 Full House (9x)
💎 Flush (6x)
📈 Straight (4x)
🎲 Three of a Kind (3x)
👥 Two Pair (2x)
👤 Pair (1x)

**Usage:** \`%poker <bet_amount>\`
**Example:** \`%poker 1000\`
**Minimum Bet:** 100 coins`)
        .setColor(0x2ecc71)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports.handlePokerAction = handlePokerAction;
