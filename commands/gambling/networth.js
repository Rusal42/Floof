const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance } = require('./utils/balance-manager');
const { getInventory, ITEM_TYPES } = require('./utils/inventory-manager');
const { getUserCrimeData } = require('./utils/crime-manager');
const { getUserBusinessData, BUSINESS_TYPES } = require('./utils/business-manager');
const { getUserPets, PET_TYPES } = require('./utils/pet-manager');
const { getUserFarmData, CROP_TYPES } = require('./utils/farming-manager');

module.exports = {
    name: 'networth',
    description: 'Calculate your total net worth including all assets, businesses, pets, and items',
    usage: '%networth [detailed]',
    category: 'gambling',
    aliases: ['nw', 'worth', 'assets'],
    cooldown: 10,

    async execute(message, args) {
        const userId = message.author.id;
        const detailed = args[0]?.toLowerCase() === 'detailed';

        const netWorthData = await calculateNetWorth(userId);
        
        if (detailed) {
            return await displayDetailedNetWorth(message, userId, netWorthData);
        } else {
            return await displayNetWorthSummary(message, userId, netWorthData);
        }
    }
};

async function calculateNetWorth(userId) {
    const data = {
        cash: 0,
        items: 0,
        businesses: 0,
        pets: 0,
        farms: 0,
        bodyguards: 0,
        total: 0,
        breakdown: {
            cash: { value: 0, details: [] },
            items: { value: 0, details: [] },
            businesses: { value: 0, details: [] },
            pets: { value: 0, details: [] },
            farms: { value: 0, details: [] },
            bodyguards: { value: 0, details: [] }
        }
    };

    // Cash balance
    data.cash = getBalance(userId);
    data.breakdown.cash.value = data.cash;
    data.breakdown.cash.details.push(`💰 Liquid Cash: ${data.cash.toLocaleString()} coins`);

    // Items in inventory
    const inventory = getInventory(userId);
    Object.entries(inventory.items).forEach(([itemId, quantity]) => {
        const itemInfo = ITEM_TYPES[itemId];
        if (itemInfo) {
            let itemValue = 0;
            
            // Estimate item values based on type
            switch (itemInfo.type) {
                case 'weapon':
                    itemValue = itemInfo.damage * 100; // 100 coins per damage point
                    break;
                case 'protection':
                    itemValue = itemInfo.defense * 150; // 150 coins per defense point
                    break;
                case 'consumable':
                    itemValue = 50; // Base consumable value
                    break;
                case 'drug':
                    itemValue = 200; // Drug base value
                    break;
                case 'alcohol':
                    itemValue = 100; // Alcohol base value
                    break;
                case 'document':
                    itemValue = 2000; // Documents are valuable
                    break;
                case 'connection':
                    itemValue = 5000; // Connections are very valuable
                    break;
                default:
                    itemValue = 100; // Default item value
            }
            
            const totalValue = itemValue * quantity;
            data.items += totalValue;
            data.breakdown.items.details.push(`${itemInfo.emoji} ${itemInfo.name} x${quantity}: ${totalValue.toLocaleString()} coins`);
        }
    });
    data.breakdown.items.value = data.items;

    // Businesses
    const businessData = getUserBusinessData(userId);
    if (businessData.businesses) {
        Object.entries(businessData.businesses).forEach(([businessId, business]) => {
            const businessInfo = BUSINESS_TYPES[businessId];
            if (businessInfo) {
                // Business value = purchase cost + employee investments
                let businessValue = businessInfo.cost;
                
                if (business.employees) {
                    Object.entries(business.employees).forEach(([employeeType, count]) => {
                        businessValue += count * 2000; // Estimate employee value
                    });
                }
                
                data.businesses += businessValue;
                data.breakdown.businesses.details.push(`${businessInfo.emoji} ${businessInfo.name}: ${businessValue.toLocaleString()} coins`);
            }
        });
    }
    data.breakdown.businesses.value = data.businesses;

    // Pets
    const userPets = getUserPets(userId);
    if (userPets.pets) {
        Object.entries(userPets.pets).forEach(([petId, pet]) => {
            const petInfo = PET_TYPES[pet.type];
            if (petInfo) {
                // Pet value based on level and stats
                const baseValue = petInfo.cost || 1000;
                const levelMultiplier = 1 + (pet.level * 0.1); // 10% per level
                const petValue = Math.floor(baseValue * levelMultiplier);
                
                data.pets += petValue;
                data.breakdown.pets.details.push(`${petInfo.emoji} ${pet.name} (Lv.${pet.level}): ${petValue.toLocaleString()} coins`);
            }
        });
    }
    data.breakdown.pets.value = data.pets;

    // Farms
    const farmData = getUserFarmData(userId);
    if (farmData.plots) {
        Object.entries(farmData.plots).forEach(([plotId, plot]) => {
            let plotValue = 5000; // Base plot value
            
            if (plot.crop) {
                const cropInfo = CROP_TYPES[plot.crop];
                if (cropInfo) {
                    // Add crop value based on growth stage
                    const cropValue = cropInfo.sell_price * (plot.growth / 100);
                    plotValue += cropValue;
                }
            }
            
            data.farms += plotValue;
            const cropDisplay = plot.crop ? ` (${plot.crop} ${plot.growth}%)` : ' (Empty)';
            data.breakdown.farms.details.push(`🌱 Plot ${plotId}${cropDisplay}: ${plotValue.toLocaleString()} coins`);
        });
    }
    
    if (farmData.upgrades) {
        Object.entries(farmData.upgrades).forEach(([upgradeId, owned]) => {
            if (owned) {
                const upgradeValue = 8000; // Estimate upgrade value
                data.farms += upgradeValue;
                data.breakdown.farms.details.push(`🏠 Farm Upgrade: ${upgradeValue.toLocaleString()} coins`);
            }
        });
    }
    data.breakdown.farms.value = data.farms;

    // Bodyguards
    const crimeData = getUserCrimeData(userId);
    if (crimeData.bodyguards) {
        Object.entries(crimeData.bodyguards).forEach(([type, bodyguardData]) => {
            let bodyguardValue = 0;
            
            switch (type) {
                case 'basic_bodyguard':
                    bodyguardValue = 5000;
                    break;
                case 'professional_bodyguard':
                    bodyguardValue = 15000;
                    break;
                case 'elite_bodyguard':
                    bodyguardValue = 50000;
                    break;
            }
            
            const totalValue = bodyguardValue * bodyguardData.count;
            data.bodyguards += totalValue;
            
            const assignment = bodyguardData.assignment || 'personal';
            data.breakdown.bodyguards.details.push(`🛡️ ${type.replace('_', ' ')} x${bodyguardData.count} (${assignment}): ${totalValue.toLocaleString()} coins`);
        });
    }
    data.breakdown.bodyguards.value = data.bodyguards;

    // Calculate total
    data.total = data.cash + data.items + data.businesses + data.pets + data.farms + data.bodyguards;

    return data;
}

async function displayNetWorthSummary(message, userId, netWorthData) {
    const embed = new EmbedBuilder()
        .setTitle('💎 Net Worth Summary')
        .setDescription(`**Total Net Worth:** ${netWorthData.total.toLocaleString()} coins\n\n` +
            `💰 **Cash:** ${netWorthData.cash.toLocaleString()} coins (${((netWorthData.cash / netWorthData.total) * 100).toFixed(1)}%)\n` +
            `🎒 **Items:** ${netWorthData.items.toLocaleString()} coins (${((netWorthData.items / netWorthData.total) * 100).toFixed(1)}%)\n` +
            `🏢 **Businesses:** ${netWorthData.businesses.toLocaleString()} coins (${((netWorthData.businesses / netWorthData.total) * 100).toFixed(1)}%)\n` +
            `🐾 **Pets:** ${netWorthData.pets.toLocaleString()} coins (${((netWorthData.pets / netWorthData.total) * 100).toFixed(1)}%)\n` +
            `🌱 **Farms:** ${netWorthData.farms.toLocaleString()} coins (${((netWorthData.farms / netWorthData.total) * 100).toFixed(1)}%)\n` +
            `🛡️ **Bodyguards:** ${netWorthData.bodyguards.toLocaleString()} coins (${((netWorthData.bodyguards / netWorthData.total) * 100).toFixed(1)}%)\n\n` +
            `💡 Use \`%networth detailed\` for a complete breakdown`)
        .setColor(0xffd700)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`networth_detailed_${userId}`)
                .setLabel('📊 Detailed View')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`networth_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function displayDetailedNetWorth(message, userId, netWorthData) {
    const embeds = [];

    // Summary embed
    const summaryEmbed = new EmbedBuilder()
        .setTitle('💎 Detailed Net Worth Analysis')
        .setDescription(`**Total Net Worth:** ${netWorthData.total.toLocaleString()} coins`)
        .addFields(
            { name: '💰 Cash', value: `${netWorthData.cash.toLocaleString()} coins`, inline: true },
            { name: '🎒 Items', value: `${netWorthData.items.toLocaleString()} coins`, inline: true },
            { name: '🏢 Businesses', value: `${netWorthData.businesses.toLocaleString()} coins`, inline: true },
            { name: '🐾 Pets', value: `${netWorthData.pets.toLocaleString()} coins`, inline: true },
            { name: '🌱 Farms', value: `${netWorthData.farms.toLocaleString()} coins`, inline: true },
            { name: '🛡️ Bodyguards', value: `${netWorthData.bodyguards.toLocaleString()} coins`, inline: true }
        )
        .setColor(0xffd700);

    embeds.push(summaryEmbed);

    // Detailed breakdowns for each category
    Object.entries(netWorthData.breakdown).forEach(([category, data]) => {
        if (data.details.length > 0) {
            const categoryEmbed = new EmbedBuilder()
                .setTitle(`${getCategoryIcon(category)} ${category.charAt(0).toUpperCase() + category.slice(1)} Breakdown`)
                .setDescription(data.details.slice(0, 10).join('\n') + 
                    (data.details.length > 10 ? `\n... and ${data.details.length - 10} more items` : ''))
                .setColor(0x2c2c2c);
            
            embeds.push(categoryEmbed);
        }
    });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`networth_summary_${userId}`)
                .setLabel('📋 Summary View')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`networth_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: embeds,
        components: [row]
    });
}

function getCategoryIcon(category) {
    const icons = {
        cash: '💰',
        items: '🎒',
        businesses: '🏢',
        pets: '🐾',
        farms: '🌱',
        bodyguards: '🛡️'
    };
    return icons[category] || '📊';
}

// Export display functions for interaction handler
module.exports.displayNetWorthSummary = displayNetWorthSummary;
module.exports.displayDetailedNetWorth = displayDetailedNetWorth;
module.exports.calculateNetWorth = calculateNetWorth;
