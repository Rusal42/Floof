const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Store active baccarat games
const activeGames = new Map();

module.exports = {
    name: 'baccarat',
    description: 'Play Baccarat - bet on Player, Banker, or Tie',
    usage: '%baccarat <bet> <player/banker/tie>',
    category: 'gambling',
    aliases: ['bac'],
    cooldown: 5,

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

        if (args.length < 1) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('🎴 **Baccarat** | Bet: Player/Banker/Tie | Payouts: 2x/1.95x/8x | Min: 100 coins\n`%baccarat <bet>`')
                        .setColor(0x9b59b6)
                ]
            });
        }

        const betAmount = parseInt(args[0]);

        if (isNaN(betAmount) || betAmount < 100) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Invalid bet amount! Minimum bet is **100** coins.')
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

        // Check if user already has an active game
        if (activeGames.has(userId)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You already have an active Baccarat game! Finish it first.')
                        .setColor(0xff0000)
                ]
            });
        }

        // Deduct bet and start game
        subtractBalance(userId, betAmount);
        
        // Initialize game state
        const gameState = {
            userId,
            betAmount,
            selectedBet: null,
            phase: 'betting'
        };
        
        activeGames.set(userId, gameState);

        // Show betting interface
        await showBettingInterface(message, gameState);
    }
};

async function showBettingInterface(message, gameState) {
    const embed = new EmbedBuilder()
        .setDescription(`🎴 **Baccarat** | Bet: **${gameState.betAmount.toLocaleString()}** coins\n\n👤 Player (2x) | 🏦 Banker (1.95x) | 🤝 Tie (8x)`)
        .setColor(0x9b59b6);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`baccarat_bet_${gameState.userId}_player`)
                .setLabel('👤 Player (2x)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`baccarat_bet_${gameState.userId}_banker`)
                .setLabel('🏦 Banker (1.95x)')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`baccarat_bet_${gameState.userId}_tie`)
                .setLabel('🤝 Tie (8x)')
                .setStyle(ButtonStyle.Success)
        );

    const cancelRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`baccarat_cancel_${gameState.userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    await sendAsFloofWebhook(message, { 
        embeds: [embed], 
        components: [row, cancelRow] 
    });
}

async function playBaccaratGame(interaction, gameState, betType) {
    // Play the game
    const result = playBaccarat();
    const { playerCards, bankerCards, playerTotal, bankerTotal, winner } = result;

    // Determine winnings
    let winnings = 0;
    let won = false;

    if (winner === betType) {
        won = true;
        switch (betType) {
            case 'player':
                winnings = Math.floor(gameState.betAmount * 2);
                break;
            case 'banker':
                winnings = Math.floor(gameState.betAmount * 1.95);
                break;
            case 'tie':
                winnings = Math.floor(gameState.betAmount * 8);
                break;
        }
        addBalance(gameState.userId, winnings);
    }

    // Create result embed
    const embed = new EmbedBuilder()
        .addFields(
            {
                name: '👤 Player',
                value: `${formatCards(playerCards)}\n**${playerTotal}**`,
                inline: true
            },
            {
                name: '🏦 Banker', 
                value: `${formatCards(bankerCards)}\n**${bankerTotal}**`,
                inline: true
            },
            {
                name: '🎯 Result',
                value: `**${winner.toUpperCase()}** wins\nBet: ${betType.toUpperCase()}`,
                inline: true
            }
        )
        .setFooter({ text: `Balance: ${getBalance(gameState.userId).toLocaleString()} coins` });

    if (won) {
        embed.setColor(0x00ff00);
        embed.setDescription(`🎉 **WON!** +${(winnings - gameState.betAmount).toLocaleString()} coins | Total: ${winnings.toLocaleString()}`);
    } else {
        embed.setColor(0xff0000);
        embed.setDescription(`💸 **LOST** -${gameState.betAmount.toLocaleString()} coins`);
    }

    // Clean up game
    activeGames.delete(gameState.userId);

    await interaction.update({ embeds: [embed], components: [] });
}

// Handle button interactions
async function handleBaccaratInteraction(interaction) {
    const [action, userId, value] = interaction.customId.split('_').slice(1);
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ 
            content: '❌ This is not your game!', 
            ephemeral: true 
        });
    }

    const gameState = activeGames.get(userId);
    if (!gameState) {
        return await interaction.reply({ 
            content: '❌ Game not found!', 
            ephemeral: true 
        });
    }

    switch (action) {
        case 'bet':
            await playBaccaratGame(interaction, gameState, value);
            break;
        case 'cancel':
            await handleCancelGame(interaction, gameState);
            break;
    }
}

async function handleCancelGame(interaction, gameState) {
    // Refund bet
    addBalance(gameState.userId, gameState.betAmount);
    
    // Clean up game
    activeGames.delete(gameState.userId);

    const embed = new EmbedBuilder()
        .setTitle('🎴 Baccarat Cancelled')
        .setDescription(`Game cancelled! Your **${gameState.betAmount.toLocaleString()}** coins have been refunded.`)
        .setColor(0x95a5a6);

    await interaction.update({ embeds: [embed], components: [] });
}

function playBaccarat() {
    const deck = createDeck();
    
    // Deal initial cards
    const playerCards = [drawCard(deck), drawCard(deck)];
    const bankerCards = [drawCard(deck), drawCard(deck)];
    
    let playerTotal = calculateTotal(playerCards);
    let bankerTotal = calculateTotal(bankerCards);
    
    // Player third card rule
    if (playerTotal <= 5) {
        playerCards.push(drawCard(deck));
        playerTotal = calculateTotal(playerCards);
    }
    
    // Banker third card rule (simplified)
    if (bankerTotal <= 5 && playerCards.length === 2) {
        bankerCards.push(drawCard(deck));
        bankerTotal = calculateTotal(bankerCards);
    } else if (bankerTotal <= 6 && playerCards.length === 3) {
        const playerThirdCard = getCardValue(playerCards[2]);
        if (bankerTotal <= 2 || 
            (bankerTotal === 3 && playerThirdCard !== 8) ||
            (bankerTotal === 4 && [2,3,4,5,6,7].includes(playerThirdCard)) ||
            (bankerTotal === 5 && [4,5,6,7].includes(playerThirdCard)) ||
            (bankerTotal === 6 && [6,7].includes(playerThirdCard))) {
            bankerCards.push(drawCard(deck));
            bankerTotal = calculateTotal(bankerCards);
        }
    }
    
    // Determine winner
    let winner;
    if (playerTotal > bankerTotal) {
        winner = 'player';
    } else if (bankerTotal > playerTotal) {
        winner = 'banker';
    } else {
        winner = 'tie';
    }
    
    return { playerCards, bankerCards, playerTotal, bankerTotal, winner };
}

function createDeck() {
    const suits = ['♠️', '♥️', '♦️', '♣️'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
}

function drawCard(deck) {
    return deck.pop();
}

function getCardValue(card) {
    if (card.rank === 'A') return 1;
    if (['J', 'Q', 'K'].includes(card.rank)) return 0;
    return parseInt(card.rank);
}

function calculateTotal(cards) {
    const total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
    return total % 10; // Baccarat uses modulo 10
}

function formatCards(cards) {
    return cards.map(card => `${card.rank}${card.suit}`).join(' ');
}

// Export the interaction handler
module.exports.handleBaccaratInteraction = handleBaccaratInteraction;
