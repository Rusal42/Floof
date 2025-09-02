const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Store active plinko games
const activeGames = new Map();

// Plinko multipliers (left to right)
const MULTIPLIERS = [1000, 130, 26, 9, 4, 2, 2, 1.5, 1.5, 1.5, 1.5, 2, 2, 4, 9, 26, 130, 1000];

module.exports = {
    name: 'plinko',
    description: 'Drop a ball down the Plinko board for big multipliers!',
    usage: '%plinko <bet> <risk>',
    category: 'gambling',
    aliases: ['pl'],
    cooldown: 3,

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
                        .setTitle('🎯 Plinko')
                        .setDescription('**How to Play:**\n• Drop ball down Plinko board\n• Ball bounces to multiplier slots\n\n**Risk Levels:**\n🟢 Low: 0.5x-5.6x | 🟡 Med: 0.2x-25x | 🔴 High: 0.2x-1000x\n\n**Usage:** `%plinko <bet> <risk>`')
                        .setColor(0x3498db)
                        .setFooter({ text: 'Minimum bet: 100 coins' })
                ]
            });
        }

        const betAmount = parseInt(args[0]);
        let riskLevel = args[1] ? args[1].toLowerCase() : 'medium';

        if (isNaN(betAmount) || betAmount < 100) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Invalid bet amount! Minimum bet is **100** coins.')
                        .setColor(0xff0000)
                ]
            });
        }

        if (!['low', 'medium', 'high'].includes(riskLevel)) {
            riskLevel = 'medium';
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
                        .setDescription('❌ You already have an active Plinko game! Finish it first.')
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
            riskLevel,
            phase: 'ready'
        };
        
        activeGames.set(userId, gameState);

        // Show game interface
        await showPlinkoInterface(message, gameState);
    }
};

async function showPlinkoInterface(message, gameState) {
    const riskColor = getRiskColor(gameState.riskLevel);
    const riskEmoji = getRiskEmoji(gameState.riskLevel);
    
    const embed = new EmbedBuilder()
        .setTitle('🎯 Plinko - Ready to Drop!')
        .setDescription(`${riskEmoji} **Risk Level:** ${gameState.riskLevel.toUpperCase()}\n💰 **Bet Amount:** ${gameState.betAmount.toLocaleString()} coins\n\n🎯 **Multiplier Range:**\n${getMultiplierRange(gameState.riskLevel)}\n\n🎲 Click **Drop Ball** to release the ball down the board!`)
        .setColor(riskColor)
        .setFooter({ text: 'The ball will bounce randomly - good luck!' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`plinko_drop_${gameState.userId}`)
                .setLabel('🎲 Drop Ball')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`plinko_cancel_${gameState.userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    await sendAsFloofWebhook(message, { 
        embeds: [embed], 
        components: [row] 
    });
}

async function dropBall(interaction, gameState) {
    // Show dropping animation
    const dropEmbed = new EmbedBuilder()
        .setTitle('🎯 Plinko - Ball Dropping!')
        .setDescription('🔴 The ball is bouncing down the board...\n\n```\n    🔴\n   / \\\n  🔘 🔘\n / \\ / \\\n🔘 🔘 🔘\n```')
        .setColor(0xf39c12);

    await interaction.update({ embeds: [dropEmbed], components: [] });

    // Wait for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calculate result based on risk level
    const multipliers = getMultipliersForRisk(gameState.riskLevel);
    const selectedMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
    
    const winnings = Math.floor(gameState.betAmount * selectedMultiplier);
    addBalance(gameState.userId, winnings);

    // Create result embed
    const profit = winnings - gameState.betAmount;
    const riskEmoji = getRiskEmoji(gameState.riskLevel);
    
    const embed = new EmbedBuilder()
        .setTitle('🎯 Plinko Results')
        .addFields(
            {
                name: '🎲 Ball Path',
                value: generateBallPath(),
                inline: false
            },
            {
                name: '🎯 Landing Slot',
                value: `**${selectedMultiplier}x** Multiplier`,
                inline: true
            },
            {
                name: '💰 Payout',
                value: `${winnings.toLocaleString()} coins`,
                inline: true
            }
        )
        .setFooter({ text: `Balance: ${getBalance(gameState.userId).toLocaleString()} coins` })
        .setTimestamp();

    if (profit > 0) {
        embed.setColor(0x00ff00);
        embed.setDescription(`🎉 **WINNER!**\n${riskEmoji} **Risk:** ${gameState.riskLevel.toUpperCase()}\n📈 **Profit:** +${profit.toLocaleString()} coins`);
    } else if (profit === 0) {
        embed.setColor(0x95a5a6);
        embed.setDescription(`🔄 **BREAK EVEN!**\n${riskEmoji} **Risk:** ${gameState.riskLevel.toUpperCase()}\n💰 **No profit or loss**`);
    } else {
        embed.setColor(0xff0000);
        embed.setDescription(`💸 **LOSS!**\n${riskEmoji} **Risk:** ${gameState.riskLevel.toUpperCase()}\n📉 **Loss:** ${Math.abs(profit).toLocaleString()} coins`);
    }

    // Clean up game
    activeGames.delete(gameState.userId);

    await interaction.editReply({ embeds: [embed], components: [] });
}

function getMultipliersForRisk(riskLevel) {
    switch (riskLevel) {
        case 'low':
            return [0.5, 1, 1.5, 2, 3, 5.6, 3, 2, 1.5, 1, 0.5];
        case 'medium':
            return [0.2, 0.7, 2, 5, 12, 25, 12, 5, 2, 0.7, 0.2];
        case 'high':
            return [0.2, 0.5, 1, 2, 10, 50, 1000, 50, 10, 2, 1, 0.5, 0.2];
        default:
            return [0.2, 0.7, 2, 5, 12, 25, 12, 5, 2, 0.7, 0.2];
    }
}

function getMultiplierRange(riskLevel) {
    switch (riskLevel) {
        case 'low':
            return '0.5x - 5.6x (Safer bets)';
        case 'medium':
            return '0.2x - 25x (Balanced risk)';
        case 'high':
            return '0.2x - 1000x (High risk, high reward!)';
        default:
            return '0.2x - 25x (Balanced risk)';
    }
}

function getRiskColor(riskLevel) {
    switch (riskLevel) {
        case 'low': return 0x2ecc71;
        case 'medium': return 0xf39c12;
        case 'high': return 0xe74c3c;
        default: return 0xf39c12;
    }
}

function getRiskEmoji(riskLevel) {
    switch (riskLevel) {
        case 'low': return '🟢';
        case 'medium': return '🟡';
        case 'high': return '🔴';
        default: return '🟡';
    }
}

function generateBallPath() {
    const paths = [
        '```\n    🔴\n   ↙ \n  🔘   \n ↙     \n🔘      \n```',
        '```\n    🔴\n     ↘\n    🔘 \n     ↘\n      🔘\n```',
        '```\n    🔴\n   ↙ ↘\n  🔘 🔘\n ↙   ↘ \n🔘   🔘\n```',
        '```\n    🔴\n   ↙   \n  🔘   \n   ↘   \n    🔘 \n```'
    ];
    return paths[Math.floor(Math.random() * paths.length)];
}

// Handle button interactions
async function handlePlinkoInteraction(interaction) {
    const [action, userId] = interaction.customId.split('_').slice(1);
    
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
        case 'drop':
            await dropBall(interaction, gameState);
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
        .setTitle('🎯 Plinko Cancelled')
        .setDescription(`Game cancelled! Your **${gameState.betAmount.toLocaleString()}** coins have been refunded.`)
        .setColor(0x95a5a6);

    await interaction.update({ embeds: [embed], components: [] });
}

// Export the interaction handler
module.exports.handlePlinkoInteraction = handlePlinkoInteraction;
