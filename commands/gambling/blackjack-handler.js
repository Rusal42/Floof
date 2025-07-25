// blackjack-handler.js
// Handles Discord button interactions for blackjack game

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { userBalances, saveBalances } = require('./gambling');
const { blackjackGames, handValue, formatHand } = require('./blackjack');

// Create a new deck
function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ value, suit });
        }
    }
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

async function handleBlackjackInteraction(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channelId;
    const stateKey = `${userId}_${channelId}`;
    
    // Check if this user has an active game
    if (!blackjackGames[stateKey]) {
        return interaction.reply({ 
            content: 'You don\'t have an active blackjack game!', 
            ephemeral: true 
        });
    }
    
    const game = blackjackGames[stateKey];
    
    // Verify this interaction is for the correct message
    if (game.messageId && interaction.message.id !== game.messageId) {
        return interaction.reply({ 
            content: 'This is not your current blackjack game!', 
            ephemeral: true 
        });
    }
    
    if (interaction.customId === 'blackjack_hit') {
        // Player hits - draw a card
        const newCard = game.deck.pop();
        game.player.push(newCard);
        
        const playerValue = handValue(game.player);
        
        if (playerValue > 21) {
            // Player busts - dealer wins
            delete blackjackGames[stateKey];
            
            const embed = new EmbedBuilder()
                .setTitle('Blackjack - Bust!')
                .setDescription(
                    `Your hand: ${formatHand(game.player)} (**${playerValue}**)\n` +
                    `Dealer: ${formatHand(game.dealer)}\n\n` +
                    `💥 **BUST!** You went over 21 and lost **${game.bet}** coins!`
                )
                .setColor(0xff6961);
            
            await interaction.update({ embeds: [embed], components: [] });
        } else {
            // Continue game - show updated hand
            const embed = new EmbedBuilder()
                .setTitle('Blackjack')
                .setDescription(
                    `Your hand: ${formatHand(game.player)} (**${playerValue}**)\n` +
                    `Dealer: ${formatHand(game.dealer, true)}\n\n` +
                    `React with the buttons below to Hit or Stand.`
                )
                .setColor(0x3498db);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('blackjack_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('blackjack_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.update({ embeds: [embed], components: [row] });
        }
        
    } else if (interaction.customId === 'blackjack_stand') {
        // Player stands - dealer plays
        const dealerValue = handValue(game.dealer);
        
        // Dealer hits until 17 or higher
        while (handValue(game.dealer) < 17) {
            const newCard = game.deck.pop();
            game.dealer.push(newCard);
        }
        
        const finalDealerValue = handValue(game.dealer);
        const playerValue = handValue(game.player);
        
        let result = '';
        let color = 0x7289da;
        
        if (finalDealerValue > 21) {
            // Dealer busts - player wins
            result = `🎉 **YOU WIN!** Dealer busted! You won **${game.bet}** coins!`;
            userBalances[userId] += game.bet * 2; // Return bet + winnings
            color = 0x43b581;
        } else if (playerValue > finalDealerValue) {
            // Player wins
            result = `🎉 **YOU WIN!** You won **${game.bet}** coins!`;
            userBalances[userId] += game.bet * 2; // Return bet + winnings
            color = 0x43b581;
        } else if (playerValue < finalDealerValue) {
            // Dealer wins
            result = `💸 **DEALER WINS!** You lost **${game.bet}** coins!`;
            color = 0xff6961;
        } else {
            // Tie
            result = `🤝 **PUSH!** It's a tie! Your **${game.bet}** coins are returned.`;
            userBalances[userId] += game.bet; // Return bet
            color = 0xffd700;
        }
        
        saveBalances();
        delete blackjackGames[stateKey];
        
        const embed = new EmbedBuilder()
            .setTitle('Blackjack - Game Over')
            .setDescription(
                `Your hand: ${formatHand(game.player)} (**${playerValue}**)\n` +
                `Dealer: ${formatHand(game.dealer)} (**${finalDealerValue}**)\n\n` +
                result + `\n\nYour balance: **${userBalances[userId]}** coins`
            )
            .setColor(color);
        
        await interaction.update({ embeds: [embed], components: [] });
    }
}

module.exports = {
    handleBlackjackInteraction
};
