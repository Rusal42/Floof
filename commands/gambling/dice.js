const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

// Active dice games
const activeGames = new Map();
const gameCooldowns = new Map();

const DICE_BETS = {
    'high': { name: 'High (8-12)', min: 8, max: 12, multiplier: 1.8 },
    'low': { name: 'Low (2-6)', min: 2, max: 6, multiplier: 1.8 },
    'seven': { name: 'Lucky Seven', exact: 7, multiplier: 4.0 },
    'doubles': { name: 'Doubles', type: 'doubles', multiplier: 3.0 },
    'snake': { name: 'Snake Eyes (2)', exact: 2, multiplier: 30.0 },
    'boxcars': { name: 'Boxcars (12)', exact: 12, multiplier: 30.0 }
};

module.exports = {
    name: 'dice',
    description: 'Roll two dice and bet on the outcome',
    usage: '%dice <bet_amount|all> [bet_type]',
    category: 'gambling',
    aliases: ['roll', 'craps'],
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
                        .setDescription(`⏰ Please wait **${remaining}** seconds before rolling again.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await showDiceHelp(message);
        }

        let betAmount;
        let isAllIn = false;
        const betInput = args[0].toLowerCase();
        
        // Handle "all in" betting
        if (betInput === 'all' || betInput === 'allin' || betInput === 'all-in') {
            const currentBalance = getBalance(userId);
            if (currentBalance <= 0) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ You have no coins to bet! Your balance is 0.')
                            .setColor(0xff0000)
                    ]
                });
            }
            betAmount = currentBalance;
            isAllIn = true;
        } else {
            betAmount = parseInt(args[0]);
            if (isNaN(betAmount) || betAmount <= 0) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ Please provide a valid positive amount to bet or use "all" to bet everything!')
                            .setColor(0xff0000)
                    ]
                });
            }
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

        // If bet type specified, play immediately
        if (args.length > 1) {
            const betType = args[1].toLowerCase();
            if (!DICE_BETS[betType]) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ Invalid bet type! Use `%dice` to see available bets.')
                            .setColor(0xff0000)
                    ]
                });
            }
            
            gameCooldowns.set(userId, now);
            return await playDiceGame(message, userId, betAmount, betType, isAllIn);
        }

        // Show betting options
        gameCooldowns.set(userId, now);
        return await showDiceBetting(message, userId, betAmount, isAllIn);
    }
};

async function showDiceBetting(message, userId, betAmount, isAllIn = false) {
    const gameState = {
        userId,
        betAmount,
        isAllIn,
        stage: 'betting'
    };
    
    activeGames.set(userId, gameState);
    
    let description = `**🎲 Dice Betting**\n\n`;
    description += `**💰 Bet Amount:** ${betAmount.toLocaleString()} coins${isAllIn ? ' 🎰 **ALL IN!**' : ''}\n\n`;
    description += `**Choose your bet:**\n`;
    description += `🔺 **High (8-12)** - ${DICE_BETS.high.multiplier}x payout\n`;
    description += `🔻 **Low (2-6)** - ${DICE_BETS.low.multiplier}x payout\n`;
    description += `🍀 **Lucky Seven** - ${DICE_BETS.seven.multiplier}x payout\n`;
    description += `👥 **Doubles** - ${DICE_BETS.doubles.multiplier}x payout\n`;
    description += `🐍 **Snake Eyes (2)** - ${DICE_BETS.snake.multiplier}x payout\n`;
    description += `📦 **Boxcars (12)** - ${DICE_BETS.boxcars.multiplier}x payout`;

    const embed = new EmbedBuilder()
        .setTitle('🎲 Choose Your Dice Bet')
        .setDescription(description)
        .setColor(0x3498db)
        .setTimestamp();

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`dice_high_${userId}`)
                .setLabel('🔺 High (8-12)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`dice_low_${userId}`)
                .setLabel('🔻 Low (2-6)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`dice_seven_${userId}`)
                .setLabel('🍀 Lucky Seven')
                .setStyle(ButtonStyle.Success)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`dice_doubles_${userId}`)
                .setLabel('👥 Doubles')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`dice_snake_${userId}`)
                .setLabel('🐍 Snake Eyes')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`dice_boxcars_${userId}`)
                .setLabel('📦 Boxcars')
                .setStyle(ButtonStyle.Danger)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row1, row2]
    });
}

async function playDiceGame(message, userId, betAmount, betType, isAllIn = false) {
    const bet = DICE_BETS[betType];
    
    // Roll the dice
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    
    let won = false;
    
    // Check win conditions
    if (bet.exact && total === bet.exact) {
        won = true;
    } else if (bet.min && bet.max && total >= bet.min && total <= bet.max) {
        won = true;
    } else if (bet.type === 'doubles' && die1 === die2) {
        won = true;
    }
    
    let winnings = 0;
    let color = 0xe74c3c;
    let result = '';
    
    if (won) {
        winnings = Math.floor(betAmount * bet.multiplier);
        addBalance(userId, winnings);
        result = '🎉 **YOU WIN!**';
        color = 0x2ecc71;
    } else {
        subtractBalance(userId, betAmount);
        result = '💸 **YOU LOSE**';
    }
    
    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    
    let description = `${result}\n\n`;
    description += `**🎲 Roll Result:** ${diceEmojis[die1-1]} ${diceEmojis[die2-1]} = **${total}**\n`;
    description += `**🎯 Your Bet:** ${bet.name}\n\n`;
    
    if (won) {
        description += `**💰 Winnings:** ${winnings.toLocaleString()} coins\n`;
        description += `**📈 Multiplier:** ${bet.multiplier}x\n`;
    } else {
        description += `**💸 Lost:** ${betAmount.toLocaleString()} coins\n`;
    }
    
    description += `**💳 Balance:** ${getBalance(userId).toLocaleString()} coins${isAllIn ? '\n🎰 **ALL IN!**' : ''}`;
    
    const embed = new EmbedBuilder()
        .setTitle('🎲 Dice Roll Results')
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    
    activeGames.delete(userId);
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleDiceAction(interaction, betType) {
    const userId = interaction.user.id;
    const gameState = activeGames.get(userId);
    
    if (!gameState) {
        return await interaction.reply({ content: '❌ No active dice game found!', ephemeral: true });
    }
    
    await interaction.deferUpdate();
    
    const message = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild
    };
    
    return await playDiceGame(message, userId, gameState.betAmount, betType, gameState.isAllIn);
}

async function showDiceHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('🎲 Dice Rolling Game')
        .setDescription(`**How to Play:**
• Roll two dice and bet on the outcome
• Different bets have different payouts
• Higher risk = higher reward!

**Bet Types:**
🔺 **High (8-12)** - ${DICE_BETS.high.multiplier}x payout
🔻 **Low (2-6)** - ${DICE_BETS.low.multiplier}x payout  
🍀 **Lucky Seven** - ${DICE_BETS.seven.multiplier}x payout
👥 **Doubles** - ${DICE_BETS.doubles.multiplier}x payout
🐍 **Snake Eyes (2)** - ${DICE_BETS.snake.multiplier}x payout
📦 **Boxcars (12)** - ${DICE_BETS.boxcars.multiplier}x payout

**Usage:** 
\`%dice <amount|all>\` - Choose bet interactively
\`%dice <amount|all> <type>\` - Direct bet
**Examples:** 
\`%dice 500\`
\`%dice all high\`
\`%dice 1000 seven\`
**Minimum Bet:** 50 coins`)
        .setColor(0x3498db)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports.handleDiceAction = handleDiceAction;
