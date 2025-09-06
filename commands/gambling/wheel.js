const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Store active wheel games
const activeGames = new Map();

// Wheel segments with different payouts
const WHEEL_SEGMENTS = [
    { color: 'red', payout: 2, emoji: '🔴', count: 18 },
    { color: 'black', payout: 2, emoji: '⚫', count: 18 },
    { color: 'green', payout: 14, emoji: '🟢', count: 2 },
    { color: 'gold', payout: 50, emoji: '🟡', count: 1 }
];

module.exports = {
    name: 'wheel',
    description: 'Spin the Wheel of Fortune - bet on colors!',
    usage: '%wheel <bet>',
    category: 'gambling',
    aliases: ['spin', 'fortune'],
    cooldown: 4,

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
                        .setDescription('🎡 **Wheel** | Colors: Red/Black/Green/Gold | Payouts: 2x/2x/14x/50x | Min: 200\n`%wheel <bet>`')
                        .setColor(0xe67e22)
                ]
            });
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
                        .setDescription('❌ You already have an active Wheel game! Finish it first.')
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
            selectedColor: null,
            phase: 'betting'
        };
        
        activeGames.set(userId, gameState);

        // Show betting interface
        await showBettingInterface(message, gameState);
    }
};

async function showBettingInterface(message, gameState) {
    const embed = new EmbedBuilder()
        .setDescription(`🎡 **Wheel** | Bet: **${gameState.betAmount.toLocaleString()}** coins\n\n🔴 Red (2x) | ⚫ Black (2x) | 🟢 Green (14x) | 🟡 Gold (50x)`)
        .setColor(0xe67e22);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`wheel_bet_${gameState.userId}_red`)
                .setLabel('🔴 Red (2x)')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`wheel_bet_${gameState.userId}_black`)
                .setLabel('⚫ Black (2x)')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`wheel_bet_${gameState.userId}_green`)
                .setLabel('🟢 Green (14x)')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`wheel_bet_${gameState.userId}_gold`)
                .setLabel('🟡 Gold (50x)')
                .setStyle(ButtonStyle.Primary)
        );

    const cancelRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`wheel_cancel_${gameState.userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    await sendAsFloofWebhook(message, { 
        embeds: [embed], 
        components: [row, cancelRow] 
    });
}

async function spinWheel(interaction, gameState) {
    // Create weighted wheel based on segment counts
    const wheelSlots = [];
    WHEEL_SEGMENTS.forEach(segment => {
        for (let i = 0; i < segment.count; i++) {
            wheelSlots.push(segment);
        }
    });

    // Spin the wheel
    const result = wheelSlots[Math.floor(Math.random() * wheelSlots.length)];
    
    // Check if player won
    const won = result.color === gameState.selectedColor;
    let winnings = 0;
    
    if (won) {
        winnings = gameState.betAmount * result.payout;
        addBalance(gameState.userId, winnings);
    }

    // Create spinning animation embed first
    const spinEmbed = new EmbedBuilder()
        .setTitle('🎡 Spinning the Wheel...')
        .setDescription('🌀 The wheel is spinning... 🌀')
        .setColor(0xf39c12);

    await interaction.update({ embeds: [spinEmbed], components: [] });

    // Wait for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show result
    const resultEmbed = new EmbedBuilder()
        .setTitle('🎡 Wheel of Fortune Results')
        .addFields(
            {
                name: '🎯 Your Bet',
                value: `${getColorEmoji(gameState.selectedColor)} **${gameState.selectedColor.toUpperCase()}**\n${gameState.betAmount.toLocaleString()} coins`,
                inline: true
            },
            {
                name: '🎲 Wheel Result',
                value: `${result.emoji} **${result.color.toUpperCase()}**\n${result.payout}x payout`,
                inline: true
            },
            {
                name: '📊 Outcome',
                value: won ? '🎉 **WINNER!**' : '💸 **Better luck next time!**',
                inline: false
            }
        )
        .setFooter({ text: `Balance: ${getBalance(gameState.userId).toLocaleString()} coins` })
        .setTimestamp();

    if (won) {
        resultEmbed.setColor(0x00ff00);
        resultEmbed.setDescription(`🎉 **YOU WON!**\n💰 **Winnings:** ${winnings.toLocaleString()} coins\n📈 **Profit:** +${(winnings - gameState.betAmount).toLocaleString()} coins`);
    } else {
        resultEmbed.setColor(0xff0000);
        resultEmbed.setDescription(`💸 **You Lost!**\n📉 **Lost:** ${gameState.betAmount.toLocaleString()} coins`);
    }

    // Clean up game
    activeGames.delete(gameState.userId);

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

function getColorEmoji(color) {
    const emojis = {
        red: '🔴',
        black: '⚫',
        green: '🟢',
        gold: '🟡'
    };
    return emojis[color] || '❓';
}

// Handle button interactions
async function handleWheelInteraction(interaction) {
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
            gameState.selectedColor = value;
            await spinWheel(interaction, gameState);
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
        .setTitle('🎡 Wheel Game Cancelled')
        .setDescription(`Game cancelled! Your **${gameState.betAmount.toLocaleString()}** coins have been refunded.`)
        .setColor(0x95a5a6);

    await interaction.update({ embeds: [embed], components: [] });
}

// Export the interaction handler
module.exports.handleWheelInteraction = handleWheelInteraction;
