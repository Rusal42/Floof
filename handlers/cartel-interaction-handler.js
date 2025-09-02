const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { getBalance } = require('../commands/gambling/utils/balance-manager');

// Drug manufacturing operations (copied from cartel.js)
const DRUG_OPERATIONS = {
    street_dealing: {
        name: 'Street Dealing',
        emoji: '🏘️',
        investment: 1000,
        time_hours: 2,
        min_return: 1500,
        max_return: 3000,
        risk: 0.20,
        required_items: ['drugs'],
        description: 'Sell drugs on street corners'
    },
    lab_production: {
        name: 'Lab Production',
        emoji: '🧪',
        investment: 5000,
        time_hours: 6,
        min_return: 8000,
        max_return: 15000,
        risk: 0.30,
        required_items: ['chemicals', 'lab_equipment'],
        description: 'Manufacture high-grade narcotics'
    },
    distribution_network: {
        name: 'Distribution Network',
        emoji: '🚚',
        investment: 15000,
        time_hours: 12,
        min_return: 25000,
        max_return: 45000,
        risk: 0.35,
        required_items: ['vehicles', 'corrupt_contacts'],
        description: 'Large-scale drug distribution operation'
    },
    international_trafficking: {
        name: 'International Trafficking',
        emoji: '🌍',
        investment: 50000,
        time_hours: 24,
        min_return: 80000,
        max_return: 150000,
        risk: 0.45,
        required_items: ['fake_passport', 'cartel_connections'],
        description: 'Cross-border drug trafficking empire'
    }
};

// Cartel territories that can be controlled
const TERRITORIES = {
    downtown: {
        name: 'Downtown District',
        emoji: '🏙️',
        control_cost: 25000,
        daily_income: 2000,
        defense_requirement: 3,
        description: 'High-traffic commercial area'
    },
    docks: {
        name: 'Harbor Docks',
        emoji: '⚓',
        control_cost: 40000,
        daily_income: 3500,
        defense_requirement: 5,
        description: 'Strategic smuggling port'
    },
    industrial: {
        name: 'Industrial Zone',
        emoji: '🏭',
        control_cost: 60000,
        daily_income: 5000,
        defense_requirement: 7,
        description: 'Manufacturing and storage facilities'
    },
    airport: {
        name: 'Airport Terminal',
        emoji: '✈️',
        control_cost: 100000,
        daily_income: 8000,
        defense_requirement: 10,
        description: 'International trafficking hub'
    }
};

async function handleCartelInteraction(interaction) {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // Check if this is a cartel button
    if (!customId.startsWith('cartel_')) return;
    
    const parts = customId.split('_');
    const action = parts[1]; // prev, next, or refresh
    const targetUserId = parts[2];
    const currentPage = parseInt(parts[3]) || 0;
    
    // Only allow the original user to interact
    if (interaction.user.id !== targetUserId) {
        return await interaction.reply({
            content: '❌ This cartel interface is not for you!',
            ephemeral: true
        });
    }
    
    let newPage = currentPage;
    
    switch (action) {
        case 'prev':
            newPage = currentPage - 1;
            break;
        case 'next':
            newPage = currentPage + 1;
            break;
        case 'refresh':
            newPage = 0;
            break;
    }
    
    // Generate the updated cartel display
    const userBalance = getBalance(targetUserId);
    
    // Get all items (operations + territories)
    const allItems = [];
    
    // Add operations
    Object.entries(DRUG_OPERATIONS).forEach(([opId, operation]) => {
        allItems.push({
            type: 'operation',
            id: opId,
            data: operation
        });
    });
    
    // Add territories
    Object.entries(TERRITORIES).forEach(([territoryId, territory]) => {
        allItems.push({
            type: 'territory',
            id: territoryId,
            data: territory
        });
    });
    
    const itemsPerPage = 8;
    const totalPages = Math.ceil(allItems.length / itemsPerPage);
    
    // Ensure new page is valid
    if (newPage >= totalPages) newPage = 0;
    if (newPage < 0) newPage = totalPages - 1;
    
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allItems.length);
    const pageItems = allItems.slice(startIndex, endIndex);
    
    let description = `**🏴‍☠️ Drug Cartel Operations**\n\n`;
    description += `*Welcome to the underworld, jefe...*\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**📦 Available Operations & Territories (Page ${newPage + 1}/${totalPages}):**\n\n`;
    
    pageItems.forEach((item, index) => {
        const itemNumber = startIndex + index + 1;
        
        if (item.type === 'operation') {
            const operation = item.data;
            const canAfford = userBalance >= operation.investment;
            const affordIcon = canAfford ? '✅' : '❌';
            
            description += `**${itemNumber}.** ${operation.emoji} **${operation.name}** ${affordIcon}\n`;
            description += `└ *${operation.description}*\n`;
            description += `└ 💰 Investment: ${operation.investment.toLocaleString()} • Return: ${operation.min_return.toLocaleString()}-${operation.max_return.toLocaleString()}\n`;
            description += `└ ⏱️ ${operation.time_hours}h • ⚠️ ${Math.floor(operation.risk * 100)}% risk\n`;
            description += `└ \`%cartel ${item.id}\` or \`%cartel ${itemNumber}\`\n\n`;
        } else {
            const territory = item.data;
            const canAfford = userBalance >= territory.control_cost;
            const affordIcon = canAfford ? '✅' : '❌';
            
            description += `**${itemNumber}.** ${territory.emoji} **${territory.name}** ${affordIcon}\n`;
            description += `└ *${territory.description}*\n`;
            description += `└ 💰 Control Cost: ${territory.control_cost.toLocaleString()} • Daily: ${territory.daily_income.toLocaleString()}\n`;
            description += `└ 🛡️ Defense: ${territory.defense_requirement} enforcers\n`;
            description += `└ \`%cartel control ${item.id}\`\n\n`;
        }
    });
    
    description += '**🎮 Commands:**\n';
    description += '• `%cartel operations` - View detailed operations\n';
    description += '• `%cartel territories` - Control territory\n';
    description += '• `%cartel empire` - View your cartel status';

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Drug Cartel Empire')
        .setDescription(description)
        .setColor(0x8b0000)
        .setFooter({ text: `Page ${newPage + 1}/${totalPages} • Power, money, respect... or prison.` })
        .setTimestamp();

    // Create updated navigation buttons
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`cartel_prev_${targetUserId}_${newPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === 0),
                new ButtonBuilder()
                    .setCustomId(`cartel_next_${targetUserId}_${newPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`cartel_refresh_${targetUserId}`)
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Primary)
            );
        components.push(row);
    }

    // Update the message with error handling
    try {
        await interaction.update({
            embeds: [embed],
            components: components
        });
    } catch (error) {
        // If interaction expired, try to edit the original message
        try {
            await interaction.editReply({
                embeds: [embed],
                components: components
            });
        } catch (editError) {
            console.error('Failed to update cartel interaction:', error.message);
        }
    }
}

module.exports = { handleCartelInteraction };
