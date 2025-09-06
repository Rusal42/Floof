const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Active scratch games
const activeGames = new Map();
const gameCooldowns = new Map();

const SCRATCH_TYPES = {
    'bronze': { price: 100, name: 'Bronze Scratcher', emoji: '🥉', prizes: [0, 50, 100, 200, 500], weights: [60, 25, 10, 4, 1] },
    'silver': { price: 500, name: 'Silver Scratcher', emoji: '🥈', prizes: [0, 250, 500, 1000, 2500], weights: [55, 25, 12, 6, 2] },
    'gold': { price: 1000, name: 'Gold Scratcher', emoji: '🥇', prizes: [0, 500, 1000, 2500, 10000], weights: [50, 25, 15, 8, 2] },
    'diamond': { price: 2500, name: 'Diamond Scratcher', emoji: '💎', prizes: [0, 1250, 2500, 7500, 25000], weights: [45, 25, 18, 10, 2] }
};

const SCRATCH_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '⭐', '🍀', '💰', '🎰'];

module.exports = {
    name: 'scratch',
    description: 'Buy and play scratch-off lottery tickets',
    usage: '%scratch [type] or %scratch buy <type>',
    category: 'gambling',
    aliases: ['scratchoff', 'ticket'],
    cooldown: 2,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check cooldown
        const now = Date.now();
        const lastGame = gameCooldowns.get(userId);
        if (lastGame && now - lastGame < 3000) {
            const remaining = Math.ceil((3000 - (now - lastGame)) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Please wait **${remaining}** seconds before buying another scratch ticket.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await showScratchShop(message, userId);
        }

        let ticketType = args[0].toLowerCase();
        
        // Handle "buy" command
        if (ticketType === 'buy' && args.length > 1) {
            ticketType = args[1].toLowerCase();
        }

        if (!SCRATCH_TYPES[ticketType]) {
            return await showScratchShop(message, userId);
        }

        gameCooldowns.set(userId, now);
        return await buyScratchTicket(message, userId, ticketType);
    }
};

async function showScratchShop(message, userId) {
    let description = `**🎫 Scratch-Off Ticket Shop**\n\n`;
    
    Object.entries(SCRATCH_TYPES).forEach(([type, info]) => {
        const maxPrize = Math.max(...info.prizes);
        description += `${info.emoji} **${info.name}**\n`;
        description += `└ Price: ${info.price.toLocaleString()} coins\n`;
        description += `└ Max Prize: ${maxPrize.toLocaleString()} coins\n\n`;
    });
    
    description += `**How to Play:**\n`;
    description += `• Buy a ticket and scratch to reveal symbols\n`;
    description += `• Match 3 symbols to win prizes!\n`;
    description += `• Higher tier tickets = better prizes`;

    const embed = new EmbedBuilder()
        .setTitle('🎫 Scratch-Off Lottery')
        .setDescription(description)
        .setColor(0xe67e22)
        .setTimestamp();

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`scratch_bronze_${userId}`)
                .setLabel('🥉 Bronze (100)')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`scratch_silver_${userId}`)
                .setLabel('🥈 Silver (500)')
                .setStyle(ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`scratch_gold_${userId}`)
                .setLabel('🥇 Gold (1,000)')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`scratch_diamond_${userId}`)
                .setLabel('💎 Diamond (2,500)')
                .setStyle(ButtonStyle.Danger)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row1, row2]
    });
}

async function buyScratchTicket(message, userId, ticketType) {
    const ticket = SCRATCH_TYPES[ticketType];
    const userBalance = getBalance(userId);
    
    if (userBalance < ticket.price) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You need **${ticket.price.toLocaleString()}** coins to buy a ${ticket.name}!\nYou have **${userBalance.toLocaleString()}** coins.`)
                    .setColor(0xff0000)
            ]
        });
    }

    subtractBalance(userId, ticket.price);
    
    // Generate scratch ticket
    const symbols = [];
    for (let i = 0; i < 9; i++) {
        symbols.push(SCRATCH_SYMBOLS[Math.floor(Math.random() * SCRATCH_SYMBOLS.length)]);
    }
    
    const gameState = {
        userId,
        ticketType,
        symbols,
        scratched: new Array(9).fill(false),
        stage: 'scratching'
    };
    
    activeGames.set(userId, gameState);
    
    return await displayScratchTicket(message, gameState);
}

async function displayScratchTicket(message, gameState) {
    const ticket = SCRATCH_TYPES[gameState.ticketType];
    const { symbols, scratched } = gameState;
    
    let description = `**${ticket.emoji} ${ticket.name}**\n\n`;
    description += `**🎯 Match 3 symbols to win!**\n\n`;
    
    // Display 3x3 grid
    description += `**Your Ticket:**\n`;
    for (let row = 0; row < 3; row++) {
        let rowText = '';
        for (let col = 0; col < 3; col++) {
            const index = row * 3 + col;
            if (scratched[index]) {
                rowText += `${symbols[index]} `;
            } else {
                rowText += `❓ `;
            }
        }
        description += `${rowText}\n`;
    }
    
    const scratchedCount = scratched.filter(s => s).length;
    
    if (scratchedCount === 9) {
        // All scratched, check for wins
        return await checkScratchWin(message, gameState);
    }
    
    description += `\n**Scratched:** ${scratchedCount}/9`;
    description += `\n**Click numbers to scratch!**`;

    const embed = new EmbedBuilder()
        .setTitle('🎫 Scratch-Off Ticket')
        .setDescription(description)
        .setColor(0xf39c12)
        .setTimestamp();

    // Create buttons for each position
    const rows = [];
    for (let row = 0; row < 3; row++) {
        const actionRow = new ActionRowBuilder();
        for (let col = 0; col < 3; col++) {
            const index = row * 3 + col;
            const button = new ButtonBuilder()
                .setCustomId(`scratch_pos_${gameState.userId}_${index}`)
                .setLabel(`${index + 1}`)
                .setStyle(scratched[index] ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(scratched[index]);
            actionRow.addComponents(button);
        }
        rows.push(actionRow);
    }

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: rows
    });
}

async function handleScratchAction(interaction, action, position = null) {
    const userId = interaction.user.id;
    const gameState = activeGames.get(userId);
    
    if (!gameState) {
        return await interaction.reply({ content: '❌ No active scratch ticket found!', ephemeral: true });
    }
    
    await interaction.deferUpdate();
    
    const message = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild
    };
    
    if (action === 'buy') {
        const ticketType = position; // position is actually ticket type for buy actions
        return await buyScratchTicket(message, userId, ticketType);
    } else if (action === 'pos') {
        return await scratchPosition(message, gameState, parseInt(position));
    }
}

async function scratchPosition(message, gameState, position) {
    if (gameState.scratched[position]) {
        return; // Already scratched
    }
    
    gameState.scratched[position] = true;
    
    return await displayScratchTicket(message, gameState);
}

async function checkScratchWin(message, gameState) {
    const ticket = SCRATCH_TYPES[gameState.ticketType];
    const { symbols } = gameState;
    
    // Count symbol occurrences
    const symbolCounts = {};
    symbols.forEach(symbol => {
        symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
    });
    
    // Find matches of 3 or more
    const matches = Object.entries(symbolCounts).filter(([symbol, count]) => count >= 3);
    
    let totalWinnings = 0;
    let winDescription = '';
    
    if (matches.length > 0) {
        // Determine prize based on ticket type and random selection
        const prizeIndex = getRandomPrizeIndex(ticket.weights);
        const prize = ticket.prizes[prizeIndex];
        
        if (prize > 0) {
            totalWinnings = prize;
            addBalance(gameState.userId, totalWinnings);
            
            winDescription = `🎉 **WINNER!**\n\n`;
            winDescription += `**Matching Symbols:**\n`;
            matches.forEach(([symbol, count]) => {
                winDescription += `${symbol} x${count}\n`;
            });
        } else {
            winDescription = `😢 **No Prize**\n\nYou matched symbols but didn't win this time!`;
        }
    } else {
        winDescription = `😢 **No Match**\n\nBetter luck next time!`;
    }
    
    let description = `**${ticket.emoji} ${ticket.name} - RESULTS**\n\n`;
    
    // Display final grid
    description += `**Final Ticket:**\n`;
    for (let row = 0; row < 3; row++) {
        let rowText = '';
        for (let col = 0; col < 3; col++) {
            const index = row * 3 + col;
            rowText += `${symbols[index]} `;
        }
        description += `${rowText}\n`;
    }
    
    description += `\n${winDescription}`;
    
    if (totalWinnings > 0) {
        description += `\n**💰 Prize Won:** ${totalWinnings.toLocaleString()} coins`;
    }
    
    description += `\n**💳 Balance:** ${getBalance(gameState.userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('🎫 Scratch Ticket Results')
        .setDescription(description)
        .setColor(totalWinnings > 0 ? 0x2ecc71 : 0xe74c3c)
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`scratch_shop_${gameState.userId}`)
                .setLabel('🎫 Buy Another')
                .setStyle(ButtonStyle.Primary)
        );
    
    activeGames.delete(gameState.userId);
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

function getRandomPrizeIndex(weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return i;
        }
    }
    
    return weights.length - 1;
}

module.exports.handleScratchAction = handleScratchAction;
