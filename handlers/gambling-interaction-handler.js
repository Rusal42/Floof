// Central handler for all gambling game button interactions
const { handleBaccaratInteraction } = require('../commands/gambling/baccarat');
const { handleKenoInteraction } = require('../commands/gambling/keno');
const { handleWheelInteraction } = require('../commands/gambling/wheel');
const { handlePlinkoInteraction } = require('../commands/gambling/plinko');
const { displayShopCategories } = require('../commands/gambling/shop');
const { displayCartelMenu } = require('../commands/gambling/cartel');
const { displayBlackmarket } = require('../commands/gambling/blackmarket');
const { displayBusinessOverview } = require('../commands/gambling/business');
const { displayBodyguardsOverview } = require('../commands/gambling/bodyguards');
const { 
    displayInventoryOverview, 
    displayItemsCategory, 
    displayBusinessesCategory, 
    displayPetsCategory, 
    displayFarmsCategory, 
    displayBodyguardsCategory 
} = require('../commands/gambling/inventory');
const { showRaceMenu, showOdds, showRaceStatus } = require('../commands/gambling/races');

// Import pagination handlers
async function handleShopInteraction(interaction) {
    const customId = interaction.customId;
    const [action, userId, currentPage] = customId.split('_').slice(1);
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your shop menu!', ephemeral: true });
    }
    
    let newPage = parseInt(currentPage) || 0;
    
    if (action === 'prev') {
        newPage = Math.max(0, newPage - 1);
    } else if (action === 'next') {
        newPage = newPage + 1;
    } else if (action === 'refresh') {
        newPage = 0;
    }
    
    const mockMessage = {
        author: interaction.user,
        channel: interaction.channel
    };
    
    try {
        // Import the display function directly
        const { displayShopCategories } = require('../commands/gambling/shop');
        await displayShopCategories(mockMessage, newPage);
        await interaction.deferUpdate();
    } catch (error) {
        console.error('Shop interaction error:', error);
        await interaction.reply({ content: '❌ Failed to update shop display.', ephemeral: true });
    }
}

async function handleCartelInteraction(interaction) {
    const customId = interaction.customId;
    const [action, userId, currentPage] = customId.split('_').slice(1);
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your cartel menu!', ephemeral: true });
    }
    
    let newPage = parseInt(currentPage) || 0;
    
    if (action === 'prev') {
        newPage = Math.max(0, newPage - 1);
    } else if (action === 'next') {
        newPage = newPage + 1;
    } else if (action === 'refresh') {
        newPage = 0;
    }
    
    const mockMessage = {
        author: interaction.user,
        channel: interaction.channel
    };
    
    try {
        // Import the display function directly
        const { displayCartelMenu } = require('../commands/gambling/cartel');
        await displayCartelMenu(mockMessage, userId, newPage);
        await interaction.deferUpdate();
    } catch (error) {
        console.error('Cartel interaction error:', error);
        await interaction.reply({ content: '❌ Failed to update cartel display.', ephemeral: true });
    }
}

async function handleBlackmarketInteraction(interaction) {
    const customId = interaction.customId;
    const [action, userId, currentPage] = customId.split('_').slice(1);
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your blackmarket menu!', ephemeral: true });
    }
    
    let newPage = parseInt(currentPage) || 0;
    
    if (action === 'prev') {
        newPage = Math.max(0, newPage - 1);
    } else if (action === 'next') {
        newPage = newPage + 1;
    } else if (action === 'refresh') {
        newPage = 0;
    }
    
    const mockMessage = {
        author: interaction.user,
        channel: interaction.channel
    };
    
    try {
        // Import the display function directly
        const { displayBlackmarket } = require('../commands/gambling/blackmarket');
        await displayBlackmarket(mockMessage, userId, newPage);
        await interaction.deferUpdate();
    } catch (error) {
        console.error('Blackmarket interaction error:', error);
        await interaction.reply({ content: '❌ Failed to update blackmarket display.', ephemeral: true });
    }
}

async function handleBusinessInteraction(interaction) {
    const customId = interaction.customId;
    const [action, userId, currentPage] = customId.split('_').slice(1);
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your business menu!', ephemeral: true });
    }
    
    let newPage = parseInt(currentPage) || 0;
    
    if (action === 'prev') {
        newPage = Math.max(0, newPage - 1);
    } else if (action === 'next') {
        newPage = newPage + 1;
    } else if (action === 'refresh') {
        newPage = 0;
    }
    
    const mockMessage = {
        author: interaction.user,
        channel: interaction.channel
    };
    
    try {
        // Import the display function directly
        const { displayBusinessOverview } = require('../commands/gambling/business');
        await displayBusinessOverview(mockMessage, userId, newPage);
        await interaction.deferUpdate();
    } catch (error) {
        console.error('Business interaction error:', error);
        await interaction.reply({ content: '❌ Failed to update business display.', ephemeral: true });
    }
}

async function handleBodyguardsInteraction(interaction) {
    const customId = interaction.customId;
    const [action, userId] = customId.split('_').slice(1);
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your bodyguard menu!', ephemeral: true });
    }
    
    const mockMessage = {
        author: interaction.user,
        channel: interaction.channel
    };
    
    try {
        if (action === 'refresh') {
            await displayBodyguards(mockMessage, userId);
            await interaction.deferUpdate();
        } else if (action === 'blackmarket') {
            const blackmarketCommand = require('../commands/gambling/blackmarket');
            await blackmarketCommand.execute(mockMessage, []);
            await interaction.deferUpdate();
        }
    } catch (error) {
        console.error('Bodyguards interaction error:', error);
        await interaction.reply({ content: '❌ Failed to process bodyguard action.', ephemeral: true });
    }
}

async function handleFloofgamblingInteraction(interaction) {
    const customId = interaction.customId;
    const [action, userId] = customId.split('_').slice(1);
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your gambling menu!', ephemeral: true });
    }
    
    const mockMessage = {
        author: interaction.user,
        channel: interaction.channel
    };
    
    try {
        let command;
        
        switch (action) {
            case 'shop':
                command = require('../commands/gambling/shop');
                break;
            case 'cartel':
                command = require('../commands/gambling/cartel');
                break;
            case 'blackmarket':
                command = require('../commands/gambling/blackmarket');
                break;
            case 'business':
                command = require('../commands/gambling/business');
                break;
            case 'bodyguards':
                command = require('../commands/gambling/bodyguards');
                break;
            case 'petshop':
                command = require('../commands/gambling/petshop');
                break;
            case 'refresh':
                command = require('../commands/gambling/floofgambling');
                break;
            default:
                return await interaction.reply({ content: '❌ Unknown menu option!', ephemeral: true });
        }
        
        await command.execute(mockMessage, []);
        await interaction.deferUpdate();
    } catch (error) {
        console.error('Floofgambling interaction error:', error);
        await interaction.reply({ content: '❌ Failed to open menu.', ephemeral: true });
    }
}

async function handleInventoryInteraction(interaction) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const action = parts[1];
    const userId = parts[2];
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your inventory!', ephemeral: true });
    }
    
    try {
        const message = {
            author: interaction.user,
            channel: interaction.channel,
            guild: interaction.guild,
            client: interaction.client
        };
        
        if (action === 'overview' || action === 'refresh') {
            await interaction.deferUpdate();
            await displayInventoryOverview(message, userId);
        } else if (action === 'items') {
            const page = parseInt(parts[3]) || 1;
            await interaction.deferUpdate();
            await displayItemsCategory(message, userId, page);
        } else if (action === 'businesses') {
            const page = parseInt(parts[3]) || 1;
            await interaction.deferUpdate();
            await displayBusinessesCategory(message, userId, page);
        } else if (action === 'pets') {
            const page = parseInt(parts[3]) || 1;
            await interaction.deferUpdate();
            await displayPetsCategory(message, userId, page);
        } else if (action === 'farms') {
            const page = parseInt(parts[3]) || 1;
            await interaction.deferUpdate();
            await displayFarmsCategory(message, userId, page);
        } else if (action === 'bodyguards') {
            const page = parseInt(parts[3]) || 1;
            await interaction.deferUpdate();
            await displayBodyguardsCategory(message, userId, page);
        } else if (action === 'networth') {
            await interaction.deferUpdate();
            const { displayNetWorthSummary } = require('../commands/gambling/networth');
            await displayNetWorthSummary(message, userId);
        } else if (action === 'business' && parts[2] === 'manage') {
            await interaction.deferUpdate();
            await displayBusinessOverview(message, userId);
        } else if (action === 'pets' && parts[2] === 'manage') {
            await interaction.reply({ content: '🐾 Pet management coming soon! Use `%pet` for now.', ephemeral: true });
        } else if (action === 'farms' && parts[2] === 'manage') {
            await interaction.reply({ content: '🌱 Farm management coming soon! Use `%farm` for now.', ephemeral: true });
        } else if (action === 'bodyguards' && parts[2] === 'manage') {
            await interaction.deferUpdate();
            await displayBodyguardsOverview(message, userId);
        }
    } catch (error) {
        console.error('Error in inventory interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while updating your inventory.', ephemeral: true });
        }
    }
}

async function handleRacesInteraction(interaction) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const action = parts[1];
    const userId = parts[2];
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your race menu!', ephemeral: true });
    }
    
    try {
        const message = {
            author: interaction.user,
            channel: interaction.channel,
            guild: interaction.guild,
            client: interaction.client
        };
        
        if (action === 'start') {
            await interaction.deferUpdate();
            const { startRace } = require('../commands/gambling/races');
            await startRace(message);
        } else if (action === 'odds') {
            await interaction.deferUpdate();
            await showOdds(message);
        } else if (action === 'status') {
            await interaction.deferUpdate();
            await showRaceStatus(message);
        } else if (action === 'celebrate') {
            await interaction.reply({ content: '🎉🎊🏆 WOOHOO! What an amazing race! 🏆🎊🎉', ephemeral: true });
        } else if (action === 'menu') {
            await interaction.deferUpdate();
            await showRaceMenu(message);
        }
    } catch (error) {
        console.error('Error in races interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while updating the race menu.', ephemeral: true });
        }
    }
}

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
            } else if (customId.startsWith('shop_')) {
                await handleShopInteraction(interaction);
            } else if (customId.startsWith('cartel_')) {
                await handleCartelInteraction(interaction);
            } else if (customId.startsWith('blackmarket_')) {
                await handleBlackmarketInteraction(interaction);
            } else if (customId.startsWith('business_')) {
                await handleBusinessInteraction(interaction);
            } else if (customId.startsWith('bodyguards_')) {
                await handleBodyguardsInteraction(interaction);
            } else if (customId.startsWith('inventory_')) {
                await handleInventoryInteraction(interaction);
            } else if (customId.startsWith('races_')) {
                await handleRacesInteraction(interaction);
            } else if (customId.startsWith('floofgambling_')) {
                await handleFloofGamblingInteraction(interaction);
            }
        } catch (replyError) {
            console.error('Failed to send error response:', replyError);
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
