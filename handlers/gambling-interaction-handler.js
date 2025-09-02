// Central handler for all gambling game button interactions
const { handleBaccaratInteraction } = require('../commands/gambling/baccarat');
const { handleKenoInteraction } = require('../commands/gambling/keno');
const { handleWheelInteraction } = require('../commands/gambling/wheel');
const { handlePlinkoInteraction } = require('../commands/gambling/plinko');

module.exports = {
    name: 'gambling-interactions',
    
    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;
        
        const customId = interaction.customId;
        
        try {
            // Route to appropriate game handler based on customId prefix
            if (customId.startsWith('baccarat_')) {
                await handleBaccaratInteraction(interaction);
            } else if (customId.startsWith('keno_')) {
                await handleKenoInteraction(interaction);
            } else if (customId.startsWith('wheel_')) {
                await handleWheelInteraction(interaction);
            } else if (customId.startsWith('plinko_')) {
                await handlePlinkoInteraction(interaction);
            }
            // Add more game handlers here as needed
            
        } catch (error) {
            console.error('Gambling interaction error:', error);
            
            // Try to respond with error message
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        content: '❌ An error occurred while processing your action.', 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: '❌ An error occurred while processing your action.', 
                        ephemeral: true 
                    });
                }
            } catch (replyError) {
                console.error('Failed to send error response:', replyError);
            }
        }
    }
};
