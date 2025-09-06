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
        // Create ephemeral response for the user who clicked
        const { EmbedBuilder } = require('discord.js');
        
        if (action === 'overview' || action === 'refresh') {
            const userBalance = require('../commands/gambling/utils/balance-manager').getBalance(userId);
            
            let description = `**💰 Balance:** ${userBalance.toLocaleString()} coins\n\n`;
            description += `**🎒 Your Inventory:**\n`;
            description += `Your inventory is currently empty!\n\n`;
            description += `**💡 Get Started:**\n`;
            description += `• Use \`%shop\` to buy weapons and items\n`;
            description += `• Use \`%business\` to start your empire\n`;
            description += `• Use \`%pet buy\` to adopt pets\n`;
            description += `• Use \`%blackmarket\` for special items`;

            const embed = new EmbedBuilder()
                .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
                .setDescription(description)
                .setColor(0x3498db)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (action === 'items') {
            let description = `**🗡️ Your Items & Equipment:**\n`;
            description += `Your inventory is currently empty!\n\n`;
            description += `**💡 Get Started:**\n`;
            description += `• Use \`%shop\` to buy weapons and armor\n`;
            description += `• Use \`%blackmarket\` for special items`;
            
            const embed = new EmbedBuilder()
                .setTitle(`🗡️ ${interaction.user.username}'s Items & Equipment`)
                .setDescription(description)
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (action === 'businesses') {
            let description = `**🏢 Your Business Empire:**\n`;
            description += `You don't own any businesses yet!\n\n`;
            description += `**💡 Get Started:**\n`;
            description += `• Use \`%business shop\` to browse available businesses\n`;
            description += `• Use \`%business buy\` to purchase your first business`;
            
            const embed = new EmbedBuilder()
                .setTitle(`🏢 ${interaction.user.username}'s Businesses`)
                .setDescription(description)
                .setColor(0xf39c12)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (action === 'pets') {
            let description = `**🐾 Your Pet Collection:**\n`;
            description += `You don't have any pets yet!\n\n`;
            description += `**💡 Get Started:**\n`;
            description += `• Use \`%pet types\` to see available pets\n`;
            description += `• Use \`%pet buy <type> <name>\` to adopt your first pet`;
            
            const embed = new EmbedBuilder()
                .setTitle(`🐾 ${interaction.user.username}'s Pets`)
                .setDescription(description)
                .setColor(0xe91e63)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (action === 'farms') {
            let description = `**🌱 Your Farming Operations:**\n`;
            description += `You don't own any farms yet!\n\n`;
            description += `**💡 Get Started:**\n`;
            description += `• Use \`%farm\` to start your agricultural empire`;
            
            const embed = new EmbedBuilder()
                .setTitle(`🌱 ${interaction.user.username}'s Farms`)
                .setDescription(description)
                .setColor(0x27ae60)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (action === 'bodyguards') {
            let description = `**🛡️ Your Security Force:**\n`;
            description += `You don't have any bodyguards yet!\n\n`;
            description += `**💡 Get Started:**\n`;
            description += `• Use \`%blackmarket\` to hire bodyguards\n`;
            description += `• Use \`%bodyguards\` to manage your security`;
            
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ ${interaction.user.username}'s Bodyguards`)
                .setDescription(description)
                .setColor(0x2c2c2c)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } else if (action === 'networth') {
            await handleNetworthInteraction(interaction);
        }
    } catch (error) {
        console.error('Error in inventory interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while updating your inventory.', ephemeral: true });
        }
    }
}

async function handleNetworthInteraction(interaction) {
    const userId = interaction.user.id;
    
    try {
        const { calculateNetWorth } = require('../commands/gambling/networth');
        const netWorthData = await calculateNetWorth(userId);
        
        let description = `**💎 Total Net Worth:** ${netWorthData.total.toLocaleString()} coins\n\n`;
        description += `**💰 Liquid Assets:**\n`;
        description += `└ 🪙 Cash: ${netWorthData.cash.toLocaleString()} coins\n\n`;
        description += `**🎒 Inventory Value:**\n`;
        description += `└ 🗡️ Weapons: ${netWorthData.weapons.toLocaleString()} coins\n`;
        description += `└ 🛡️ Protection: ${netWorthData.protection.toLocaleString()} coins\n`;
        description += `└ 💊 Consumables: ${netWorthData.consumables.toLocaleString()} coins\n\n`;
        description += `**🏢 Business Assets:**\n`;
        description += `└ 💼 Businesses: ${netWorthData.businesses.toLocaleString()} coins\n\n`;
        description += `**🐾 Pet Assets:**\n`;
        description += `└ 🐕 Pets: ${netWorthData.pets.toLocaleString()} coins\n\n`;
        description += `**🌱 Farm Assets:**\n`;
        description += `└ 🚜 Farms: ${netWorthData.farms.toLocaleString()} coins`;

        const embed = new EmbedBuilder()
            .setTitle(`💎 ${interaction.user.username}'s Net Worth`)
            .setDescription(description)
            .setColor(0xffd700)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error calculating net worth:', error);
        await interaction.reply({ content: '❌ An error occurred while calculating your net worth.', ephemeral: true });
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

async function handleNetworthInteraction(interaction) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const action = parts[1];
    const userId = parts[2];
    
    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ This is not your networth display!', ephemeral: true });
    }
    
    try {
        const message = {
            author: interaction.user,
            channel: interaction.channel,
            guild: interaction.guild,
            client: interaction.client
        };
        
        const { calculateNetWorth, displayNetWorthSummary, displayDetailedNetWorth } = require('../commands/gambling/networth');
        const netWorthData = await calculateNetWorth(userId);
        
        if (action === 'detailed') {
            await interaction.deferUpdate();
            await displayDetailedNetWorth(message, userId, netWorthData);
        } else if (action === 'summary') {
            await interaction.deferUpdate();
            await displayNetWorthSummary(message, userId, netWorthData);
        } else if (action === 'refresh') {
            await interaction.deferUpdate();
            // Check if current display is detailed or summary based on button context
            const currentEmbed = interaction.message.embeds[0];
            if (currentEmbed && currentEmbed.title && currentEmbed.title.includes('Detailed')) {
                await displayDetailedNetWorth(message, userId, netWorthData);
            } else {
                await displayNetWorthSummary(message, userId, netWorthData);
            }
        }
    } catch (error) {
        console.error('Error in networth interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while updating your networth display.', ephemeral: true });
        }
    }
}

async function handleGamblingInteraction(interaction) {
    const customId = interaction.customId;
    
    try {
        // Handle different gambling game interactions
        if (customId.startsWith('baccarat_')) {
            await handleBaccaratInteraction(interaction);
        } else if (customId.startsWith('keno_')) {
            await handleKenoInteraction(interaction);
        } else if (customId.startsWith('wheel_')) {
            await handleWheelInteraction(interaction);
        } else if (customId.startsWith('plinko_')) {
            await handlePlinkoInteraction(interaction);
        } else if (customId.startsWith('poker_')) {
            await handlePokerInteraction(interaction);
        } else if (customId.startsWith('dice_')) {
            await handleDiceInteraction(interaction);
        } else if (customId.startsWith('lottery_')) {
            await handleLotteryInteraction(interaction);
        } else if (customId.startsWith('war_')) {
            await handleWarInteraction(interaction);
        } else if (customId.startsWith('scratch_')) {
            await handleScratchInteraction(interaction);
        } else if (customId.startsWith('highlow_')) {
            await handleHighLowInteraction(interaction);
        } else if (customId.startsWith('inventory_')) {
            await handleInventoryInteraction(interaction);
        } else if (customId.startsWith('bodyguards_')) {
            await handleBodyguardsInteraction(interaction);
        } else if (customId.startsWith('business_')) {
            await handleBusinessInteraction(interaction);
        } else if (customId.startsWith('races_')) {
            await handleRacesInteraction(interaction);
        } else if (customId.startsWith('floofgambling_')) {
            await handleFloofgamblingInteraction(interaction);
        } else if (customId.startsWith('networth_')) {
            await handleNetworthInteraction(interaction);
        } else {
            console.log(`Unhandled gambling interaction: ${customId}`);
        }
    } catch (error) {
        console.error('Error in gambling interaction handler:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true });
        }
    }
}

// Handler functions for new gambling games
async function handlePokerInteraction(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const { handlePokerAction } = require('../commands/gambling/poker');
    await handlePokerAction(interaction, action);
}

async function handleDiceInteraction(interaction) {
    const parts = interaction.customId.split('_');
    const betType = parts[1];
    const { handleDiceAction } = require('../commands/gambling/dice');
    await handleDiceAction(interaction, betType);
}

async function handleLotteryInteraction(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const { handleLotteryAction } = require('../commands/gambling/lottery');
    await handleLotteryAction(interaction, action);
}

async function handleWarInteraction(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const { handleWarAction } = require('../commands/gambling/war');
    await handleWarAction(interaction, action);
}

async function handleScratchInteraction(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const position = parts[3]; // For position-based actions
    const { handleScratchAction } = require('../commands/gambling/scratch');
    await handleScratchAction(interaction, action, position);
}

async function handleHighLowInteraction(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const { handleHighLowAction } = require('../commands/gambling/highlow');
    await handleHighLowAction(interaction, action);
}

module.exports = {
    handleGamblingInteraction
};
