const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Active high-low games
const activeGames = new Map();
const gameCooldowns = new Map();

module.exports = {
    name: 'highlow',
    description: 'Guess if the next number will be higher or lower',
    usage: '%highlow <bet_amount>',
    category: 'gambling',
    aliases: ['hl', 'hilo'],
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
                        .setDescription(`⏰ Please wait **${remaining}** seconds before starting another high-low game.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await showHighLowHelp(message);
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
        return await startHighLowGame(message, userId, betAmount);
    }
};

async function startHighLowGame(message, userId, betAmount) {
    const currentNumber = Math.floor(Math.random() * 100) + 1;
    
    const gameState = {
        userId,
        betAmount,
        currentNumber,
        round: 1,
        totalWinnings: 0,
        multiplier: 1.0
    };
    
    activeGames.set(userId, gameState);
    subtractBalance(userId, betAmount);
    
    return await displayHighLowGame(message, gameState);
}

async function displayHighLowGame(message, gameState) {
    const { currentNumber, round, betAmount, totalWinnings, multiplier } = gameState;
    
    let description = `**🎯 High-Low Guessing Game**\n\n`;
    description += `**Current Number:** **${currentNumber}**\n`;
    description += `**Round:** ${round}\n`;
    description += `**Original Bet:** ${betAmount.toLocaleString()} coins\n`;
    description += `**Current Multiplier:** ${multiplier.toFixed(1)}x\n\n`;
    
    if (round === 1) {
        description += `**Will the next number be higher or lower than ${currentNumber}?**\n`;
        description += `(Numbers range from 1-100)`;
    } else {
        description += `**Potential Winnings:** ${Math.floor(betAmount * multiplier).toLocaleString()} coins\n\n`;
        description += `**Will the next number be higher or lower than ${currentNumber}?**\n`;
        description += `Continue playing to increase your multiplier, or cash out now!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🎯 High-Low Game')
        .setDescription(description)
        .setColor(0x3498db)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`highlow_higher_${gameState.userId}`)
                .setLabel('📈 Higher')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`highlow_lower_${gameState.userId}`)
                .setLabel('📉 Lower')
                .setStyle(ButtonStyle.Danger)
        );

    if (round > 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`highlow_cashout_${gameState.userId}`)
                .setLabel('💰 Cash Out')
                .setStyle(ButtonStyle.Primary)
        );
    }

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function handleHighLowAction(interaction, action) {
    const userId = interaction.user.id;
    const gameState = activeGames.get(userId);
    
    if (!gameState) {
        return await interaction.reply({ content: '❌ No active high-low game found!', ephemeral: true });
    }
    
    await interaction.deferUpdate();
    
    const message = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild
    };
    
    switch (action) {
        case 'higher':
            return await makeGuess(message, gameState, 'higher');
        case 'lower':
            return await makeGuess(message, gameState, 'lower');
        case 'cashout':
            return await cashOut(message, gameState);
    }
}

async function makeGuess(message, gameState, guess) {
    const { currentNumber } = gameState;
    const nextNumber = Math.floor(Math.random() * 100) + 1;
    
    let correct = false;
    if (guess === 'higher' && nextNumber > currentNumber) {
        correct = true;
    } else if (guess === 'lower' && nextNumber < currentNumber) {
        correct = true;
    } else if (nextNumber === currentNumber) {
        // Tie - continue game
        return await handleTie(message, gameState, nextNumber);
    }
    
    if (correct) {
        // Correct guess - increase multiplier and continue
        gameState.currentNumber = nextNumber;
        gameState.round++;
        gameState.multiplier += 0.5; // Increase multiplier by 0.5x each round
        
        return await displayHighLowGame(message, gameState);
    } else {
        // Wrong guess - game over
        return await gameOver(message, gameState, nextNumber, guess);
    }
}

async function handleTie(message, gameState, nextNumber) {
    let description = `**🤝 IT'S A TIE!**\n\n`;
    description += `**Previous Number:** ${gameState.currentNumber}\n`;
    description += `**Next Number:** ${nextNumber}\n\n`;
    description += `**The numbers are the same! Try again with a new number.**`;
    
    // Generate new number and continue
    gameState.currentNumber = Math.floor(Math.random() * 100) + 1;
    
    const embed = new EmbedBuilder()
        .setTitle('🤝 Tie Game!')
        .setDescription(description)
        .setColor(0xf39c12)
        .setTimestamp();
    
    // Wait a moment then show the game again
    setTimeout(async () => {
        await displayHighLowGame(message, gameState);
    }, 2000);
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function gameOver(message, gameState, nextNumber, guess) {
    const { currentNumber, betAmount, round } = gameState;
    
    let description = `**💸 GAME OVER!**\n\n`;
    description += `**Your Guess:** ${guess === 'higher' ? '📈 Higher' : '📉 Lower'}\n`;
    description += `**Previous Number:** ${currentNumber}\n`;
    description += `**Next Number:** ${nextNumber}\n\n`;
    description += `**Rounds Survived:** ${round - 1}\n`;
    description += `**Lost:** ${betAmount.toLocaleString()} coins\n`;
    description += `**💳 Balance:** ${getBalance(gameState.userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('💸 High-Low Game Over')
        .setDescription(description)
        .setColor(0xe74c3c)
        .setTimestamp();
    
    activeGames.delete(gameState.userId);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`highlow_play_${gameState.userId}`)
                .setLabel('🎯 Play Again')
                .setStyle(ButtonStyle.Primary)
        );
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function cashOut(message, gameState) {
    const { betAmount, multiplier, round } = gameState;
    const winnings = Math.floor(betAmount * multiplier);
    
    addBalance(gameState.userId, winnings);
    
    let description = `**💰 CASHED OUT!**\n\n`;
    description += `**Rounds Survived:** ${round - 1}\n`;
    description += `**Final Multiplier:** ${multiplier.toFixed(1)}x\n`;
    description += `**Original Bet:** ${betAmount.toLocaleString()} coins\n`;
    description += `**Winnings:** ${winnings.toLocaleString()} coins\n`;
    description += `**Profit:** ${(winnings - betAmount).toLocaleString()} coins\n`;
    description += `**💳 Balance:** ${getBalance(gameState.userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Successfully Cashed Out!')
        .setDescription(description)
        .setColor(0x2ecc71)
        .setTimestamp();
    
    activeGames.delete(gameState.userId);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`highlow_play_${gameState.userId}`)
                .setLabel('🎯 Play Again')
                .setStyle(ButtonStyle.Primary)
        );
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function showHighLowHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 High-Low Guessing Game')
        .setDescription(`**How to Play:**
• A random number (1-100) is shown
• Guess if the next number will be higher or lower
• Each correct guess increases your multiplier by 0.5x
• Cash out anytime to secure your winnings
• One wrong guess = lose everything!

**Strategy:**
🎯 **Numbers 1-25:** Usually guess higher
🎯 **Numbers 75-100:** Usually guess lower  
🎯 **Numbers 26-74:** Risky territory!

**Multiplier System:**
• Round 1: 1.0x (break even)
• Round 2: 1.5x multiplier
• Round 3: 2.0x multiplier
• Round 4: 2.5x multiplier
• And so on...

**Usage:** \`%highlow <bet_amount>\`
**Example:** \`%highlow 250\`
**Minimum Bet:** 25 coins`)
        .setColor(0x3498db)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports.handleHighLowAction = handleHighLowAction;
