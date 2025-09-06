const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Active war games
const activeGames = new Map();
const gameCooldowns = new Map();

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

module.exports = {
    name: 'war',
    description: 'Play the classic card game War against the dealer',
    usage: '%war <bet_amount>',
    category: 'gambling',
    aliases: ['cardwar'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check cooldown
        const now = Date.now();
        const lastGame = gameCooldowns.get(userId);
        if (lastGame && now - lastGame < 5000) {
            const remaining = Math.ceil((5000 - (now - lastGame)) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Please wait **${remaining}** seconds before starting another war game.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await showWarHelp(message);
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

        gameCooldowns.set(userId, now);
        return await startWarGame(message, userId, betAmount);
    }
};

function createCard() {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    return {
        suit,
        rank,
        value: RANK_VALUES[rank],
        display: `${rank}${suit}`
    };
}

async function startWarGame(message, userId, betAmount) {
    const playerCard = createCard();
    const dealerCard = createCard();
    
    let result = '';
    let winnings = 0;
    let color = 0xe74c3c;
    let isWar = false;
    
    if (playerCard.value > dealerCard.value) {
        winnings = betAmount * 2;
        addBalance(userId, winnings);
        result = '🎉 **YOU WIN!**';
        color = 0x2ecc71;
    } else if (playerCard.value < dealerCard.value) {
        subtractBalance(userId, betAmount);
        result = '💸 **DEALER WINS**';
    } else {
        // War situation
        isWar = true;
        result = '⚔️ **WAR!**';
        color = 0xf39c12;
    }
    
    if (isWar) {
        const gameState = {
            userId,
            betAmount,
            playerCard,
            dealerCard,
            stage: 'war'
        };
        
        activeGames.set(userId, gameState);
        return await displayWarGame(message, gameState);
    } else {
        return await displayWarResult(message, playerCard, dealerCard, result, winnings, betAmount, color, userId);
    }
}

async function displayWarGame(message, gameState) {
    const { playerCard, dealerCard, betAmount } = gameState;
    
    let description = `**⚔️ WAR DECLARED!**\n\n`;
    description += `**Your Card:** ${playerCard.display}\n`;
    description += `**Dealer Card:** ${dealerCard.display}\n\n`;
    description += `**💰 Current Bet:** ${betAmount.toLocaleString()} coins\n\n`;
    description += `**⚔️ It's a tie! Time for WAR!**\n`;
    description += `Choose to surrender and get half your bet back, or go to war and risk it all for double winnings!`;
    
    const embed = new EmbedBuilder()
        .setTitle('⚔️ Card War - WAR TIME!')
        .setDescription(description)
        .setColor(0xf39c12)
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`war_battle_${gameState.userId}`)
                .setLabel('⚔️ Go to War!')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`war_surrender_${gameState.userId}`)
                .setLabel('🏳️ Surrender')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function handleWarAction(interaction, action) {
    const userId = interaction.user.id;
    const gameState = activeGames.get(userId);
    
    if (!gameState) {
        return await interaction.reply({ content: '❌ No active war game found!', ephemeral: true });
    }
    
    await interaction.deferUpdate();
    
    const message = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild
    };
    
    if (action === 'surrender') {
        return await handleSurrender(message, gameState);
    } else if (action === 'battle') {
        return await handleWarBattle(message, gameState);
    }
}

async function handleSurrender(message, gameState) {
    const halfBet = Math.floor(gameState.betAmount / 2);
    addBalance(gameState.userId, halfBet);
    
    let description = `**🏳️ SURRENDERED**\n\n`;
    description += `**Your Card:** ${gameState.playerCard.display}\n`;
    description += `**Dealer Card:** ${gameState.dealerCard.display}\n\n`;
    description += `**💰 Bet Returned:** ${halfBet.toLocaleString()} coins (50%)\n`;
    description += `**💳 Balance:** ${getBalance(gameState.userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('🏳️ War Surrendered')
        .setDescription(description)
        .setColor(0x95a5a6)
        .setTimestamp();
    
    activeGames.delete(gameState.userId);
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleWarBattle(message, gameState) {
    // Draw 4 cards each (3 face down, 1 face up for battle)
    const playerWarCard = createCard();
    const dealerWarCard = createCard();
    
    let result = '';
    let winnings = 0;
    let color = 0xe74c3c;
    
    if (playerWarCard.value > dealerWarCard.value) {
        winnings = gameState.betAmount * 3; // Triple winnings for winning war
        addBalance(gameState.userId, winnings);
        result = '🎉 **YOU WIN THE WAR!**';
        color = 0x2ecc71;
    } else if (playerWarCard.value < dealerWarCard.value) {
        subtractBalance(gameState.userId, gameState.betAmount);
        result = '💸 **DEALER WINS THE WAR**';
    } else {
        // Another tie - return bet
        addBalance(gameState.userId, gameState.betAmount);
        result = '🤝 **ANOTHER TIE - BET RETURNED**';
        color = 0xf39c12;
    }
    
    let description = `${result}\n\n`;
    description += `**Original Cards:**\n`;
    description += `Your Card: ${gameState.playerCard.display} vs Dealer: ${gameState.dealerCard.display}\n\n`;
    description += `**WAR BATTLE:**\n`;
    description += `Your War Card: ${playerWarCard.display}\n`;
    description += `Dealer War Card: ${dealerWarCard.display}\n\n`;
    
    if (winnings > 0) {
        description += `**💰 Winnings:** ${winnings.toLocaleString()} coins (3x multiplier!)\n`;
    } else if (result.includes('RETURNED')) {
        description += `**💰 Bet Returned:** ${gameState.betAmount.toLocaleString()} coins\n`;
    } else {
        description += `**💸 Lost:** ${gameState.betAmount.toLocaleString()} coins\n`;
    }
    
    description += `**💳 Balance:** ${getBalance(gameState.userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('⚔️ War Battle Results')
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    
    activeGames.delete(gameState.userId);
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayWarResult(message, playerCard, dealerCard, result, winnings, betAmount, color, userId) {
    let description = `${result}\n\n`;
    description += `**Your Card:** ${playerCard.display}\n`;
    description += `**Dealer Card:** ${dealerCard.display}\n\n`;
    
    if (winnings > 0) {
        description += `**💰 Winnings:** ${winnings.toLocaleString()} coins\n`;
    } else {
        description += `**💸 Lost:** ${betAmount.toLocaleString()} coins\n`;
    }
    
    description += `**💳 Balance:** ${getBalance(userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('⚔️ Card War Results')
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function showWarHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('⚔️ Card War')
        .setDescription(`**How to Play:**
• You and the dealer each draw one card
• Highest card wins and takes both cards
• If cards tie, you can go to WAR or surrender

**War Rules:**
• Surrender: Get 50% of your bet back
• Go to War: Risk your bet for 3x winnings
• Another tie in war: Bet returned

**Card Values:**
Ace (highest) → King → Queen → Jack → 10 → 9 → 8 → 7 → 6 → 5 → 4 → 3 → 2 (lowest)

**Payouts:**
🎯 **Win:** 2x your bet
⚔️ **Win War:** 3x your bet  
🏳️ **Surrender:** 50% back

**Usage:** \`%war <bet_amount>\`
**Example:** \`%war 500\`
**Minimum Bet:** 50 coins`)
        .setColor(0xe74c3c)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports.handleWarAction = handleWarAction;
