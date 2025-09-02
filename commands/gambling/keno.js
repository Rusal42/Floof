const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Store active keno games
const activeGames = new Map();

module.exports = {
    name: 'keno',
    description: 'Play Keno - pick numbers and hope they match!',
    usage: '%keno <bet>',
    category: 'gambling',
    aliases: ['k'],
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
                        .setDescription('🎱 **Keno** | Pick 5 from 1-20 | Payouts: 3=2x 4=5x 5=20x | Min: 100\n`%keno <bet>`')
                        .setColor(0xf39c12)
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
                        .setDescription('❌ You already have an active Keno game! Finish it first.')
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
            selectedNumbers: [],
            phase: 'selecting'
        };
        
        activeGames.set(userId, gameState);

        // Create number selection interface
        await showNumberSelection(message, gameState);
    }
};

async function showNumberSelection(message, gameState) {
    const embed = new EmbedBuilder()
        .setTitle('🎱 Keno - Select Your Numbers')
        .setDescription(`**Pick 5 numbers from 1-20**\n\n**Selected:** ${gameState.selectedNumbers.length > 0 ? gameState.selectedNumbers.sort((a,b) => a-b).join(', ') : 'None'}\n**Remaining:** ${5 - gameState.selectedNumbers.length}\n\n**Bet:** ${gameState.betAmount.toLocaleString()} coins`)
        .setColor(0xf39c12)
        .setFooter({ text: 'Click numbers to select them!' });

    // Create number buttons (1-20)
    const rows = [];
    for (let i = 0; i < 4; i++) {
        const row = new ActionRowBuilder();
        for (let j = 1; j <= 5; j++) {
            const number = i * 5 + j;
            if (number <= 20) {
                const isSelected = gameState.selectedNumbers.includes(number);
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`keno_select_${gameState.userId}_${number}`)
                        .setLabel(number.toString())
                        .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
                );
            }
        }
        rows.push(row);
    }

    // Add control buttons
    const controlRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`keno_play_${gameState.userId}`)
                .setLabel('🎲 Play Game')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(gameState.selectedNumbers.length !== 5),
            new ButtonBuilder()
                .setCustomId(`keno_cancel_${gameState.userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    rows.push(controlRow);

    await sendAsFloofWebhook(message, { 
        embeds: [embed], 
        components: rows 
    });
}

// Handle button interactions
async function handleKenoInteraction(interaction) {
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
        case 'select':
            await handleNumberSelect(interaction, gameState, parseInt(value));
            break;
        case 'play':
            await handlePlayGame(interaction, gameState);
            break;
        case 'cancel':
            await handleCancelGame(interaction, gameState);
            break;
    }
}

async function handleNumberSelect(interaction, gameState, number) {
    const index = gameState.selectedNumbers.indexOf(number);
    
    if (index > -1) {
        // Deselect number
        gameState.selectedNumbers.splice(index, 1);
    } else {
        // Select number (if not at limit)
        if (gameState.selectedNumbers.length < 5) {
            gameState.selectedNumbers.push(number);
        } else {
            return await interaction.reply({ 
                content: '❌ You can only select 5 numbers!', 
                ephemeral: true 
            });
        }
    }

    // Update the interface
    const embed = new EmbedBuilder()
        .setTitle('🎱 Keno - Select Your Numbers')
        .setDescription(`**Pick 5 numbers from 1-20**\n\n**Selected:** ${gameState.selectedNumbers.length > 0 ? gameState.selectedNumbers.sort((a,b) => a-b).join(', ') : 'None'}\n**Remaining:** ${5 - gameState.selectedNumbers.length}\n\n**Bet:** ${gameState.betAmount.toLocaleString()} coins`)
        .setColor(0xf39c12)
        .setFooter({ text: 'Click numbers to select them!' });

    // Recreate buttons with updated selection
    const rows = [];
    for (let i = 0; i < 4; i++) {
        const row = new ActionRowBuilder();
        for (let j = 1; j <= 5; j++) {
            const num = i * 5 + j;
            if (num <= 20) {
                const isSelected = gameState.selectedNumbers.includes(num);
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`keno_select_${gameState.userId}_${num}`)
                        .setLabel(num.toString())
                        .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
                );
            }
        }
        rows.push(row);
    }

    const controlRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`keno_play_${gameState.userId}`)
                .setLabel('🎲 Play Game')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(gameState.selectedNumbers.length !== 5),
            new ButtonBuilder()
                .setCustomId(`keno_cancel_${gameState.userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    rows.push(controlRow);

    await interaction.update({ embeds: [embed], components: rows });
}

async function handlePlayGame(interaction, gameState) {
    if (gameState.selectedNumbers.length !== 5) {
        return await interaction.reply({ 
            content: '❌ You must select exactly 5 numbers!', 
            ephemeral: true 
        });
    }

    // Draw 10 random numbers
    const drawnNumbers = [];
    while (drawnNumbers.length < 10) {
        const num = Math.floor(Math.random() * 20) + 1;
        if (!drawnNumbers.includes(num)) {
            drawnNumbers.push(num);
        }
    }

    // Calculate matches
    const matches = gameState.selectedNumbers.filter(num => drawnNumbers.includes(num));
    const matchCount = matches.length;

    // Calculate winnings
    let winnings = 0;
    let multiplier = 0;
    
    switch (matchCount) {
        case 3:
            multiplier = 2;
            winnings = gameState.betAmount * 2;
            break;
        case 4:
            multiplier = 5;
            winnings = gameState.betAmount * 5;
            break;
        case 5:
            multiplier = 20;
            winnings = gameState.betAmount * 20;
            break;
    }

    if (winnings > 0) {
        addBalance(gameState.userId, winnings);
    }

    // Create result embed
    const embed = new EmbedBuilder()
        .setTitle('🎱 Keno Results')
        .addFields(
            {
                name: '🎯 Your Numbers',
                value: gameState.selectedNumbers.sort((a,b) => a-b).join(', '),
                inline: true
            },
            {
                name: '🎲 Drawn Numbers',
                value: drawnNumbers.sort((a,b) => a-b).join(', '),
                inline: true
            },
            {
                name: '✨ Matches',
                value: matches.length > 0 ? matches.sort((a,b) => a-b).join(', ') : 'None',
                inline: false
            }
        )
        .setFooter({ text: `Balance: ${getBalance(gameState.userId).toLocaleString()} coins` })
        .setTimestamp();

    if (winnings > 0) {
        embed.setColor(0x00ff00);
        embed.setDescription(`🎉 **${matchCount} MATCHES!**\n💰 **Winnings:** ${winnings.toLocaleString()} coins (${multiplier}x)\n📈 **Profit:** +${(winnings - gameState.betAmount).toLocaleString()} coins`);
    } else {
        embed.setColor(0xff0000);
        embed.setDescription(`💸 **${matchCount} matches - No win!**\n📉 **Lost:** ${gameState.betAmount.toLocaleString()} coins`);
    }

    // Clean up game
    activeGames.delete(gameState.userId);

    await interaction.update({ embeds: [embed], components: [] });
}

async function handleCancelGame(interaction, gameState) {
    // Refund bet
    addBalance(gameState.userId, gameState.betAmount);
    
    // Clean up game
    activeGames.delete(gameState.userId);

    const embed = new EmbedBuilder()
        .setTitle('🎱 Keno Cancelled')
        .setDescription(`Game cancelled! Your **${gameState.betAmount.toLocaleString()}** coins have been refunded.`)
        .setColor(0x95a5a6);

    await interaction.update({ embeds: [embed], components: [] });
}

// Export the interaction handler
module.exports.handleKenoInteraction = handleKenoInteraction;
