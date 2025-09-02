const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { formatInventoryDisplay, equipWeapon, equipProtection, unequipProtection, getItemInfo, hasItem } = require('./utils/inventory-manager');
const { getBalance } = require('./utils/balance-manager');
const { getUserCrimeData } = require('./utils/crime-manager');
const { getUserBusinessData, BUSINESS_TYPES } = require('./utils/business-manager');
const { getUserPets, PET_TYPES } = require('./utils/pet-manager');
const { getUserFarmData, CROP_TYPES } = require('./utils/farming-manager');

module.exports = {
    name: 'inventory',
    description: 'View your comprehensive inventory including items, businesses, pets, farms, and bodyguards',
    usage: '%inventory [category] [page]',
    category: 'gambling',
    aliases: ['inv', 'items', 'bag', 'i'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        const category = args[0]?.toLowerCase() || 'overview';
        const page = parseInt(args[1]) || 1;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot access your inventory for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        try {
            switch (category) {
                case 'overview':
                case 'summary':
                    return await displayInventoryOverview(message, userId);
                case 'items':
                case 'weapons':
                case 'gear':
                    return await displayItemsCategory(message, userId, page);
                case 'businesses':
                case 'business':
                    return await displayBusinessesCategory(message, userId, page);
                case 'pets':
                case 'pet':
                    return await displayPetsCategory(message, userId, page);
                case 'farms':
                case 'farm':
                case 'farming':
                    return await displayFarmsCategory(message, userId, page);
                case 'bodyguards':
                case 'guards':
                case 'protection':
                    return await displayBodyguardsCategory(message, userId, page);
                default:
                    return await displayInventoryOverview(message, userId);
            }
        } catch (error) {
            console.error('Inventory command error:', error);
            await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Failed to load inventory. Please try again.')
                        .setColor(0xff0000)
                ]
            });
        }
    }
};

async function displayInventoryOverview(message, userId) {
    const userBalance = getBalance(userId);
    const inventoryDisplay = formatInventoryDisplay(userId);
    const businessData = getUserBusinessData(userId);
    const userPets = getUserPets(userId);
    const farmData = getUserFarmData(userId);
    const crimeData = getUserCrimeData(userId);

    // Count assets
    const businessCount = businessData.businesses ? Object.keys(businessData.businesses).length : 0;
    const petCount = userPets.pets ? Object.keys(userPets.pets).length : 0;
    const farmPlotCount = farmData.plots ? Object.keys(farmData.plots).length : 0;
    const bodyguardCount = crimeData.bodyguards ? Object.values(crimeData.bodyguards).reduce((sum, bg) => sum + bg.count, 0) : 0;

    let description = `**💰 Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**📊 Asset Summary:**\n`;
    description += `🏢 **Businesses:** ${businessCount}\n`;
    description += `🐾 **Pets:** ${petCount}\n`;
    description += `🌱 **Farm Plots:** ${farmPlotCount}\n`;
    description += `🛡️ **Bodyguards:** ${bodyguardCount}\n\n`;
    description += `**🎒 Quick Items Overview:**\n${inventoryDisplay}\n\n`;
    description += `**📋 Categories:**\n`;
    description += `• \`%inventory items\` - Weapons, armor, consumables\n`;
    description += `• \`%inventory businesses\` - Your business empire\n`;
    description += `• \`%inventory pets\` - Your pet collection\n`;
    description += `• \`%inventory farms\` - Your farming operations\n`;
    description += `• \`%inventory bodyguards\` - Your security force\n\n`;
    description += `💡 Use \`%networth\` to see total asset value`;

    const embed = new EmbedBuilder()
        .setTitle(`🎒 ${message.author.username}'s Complete Inventory`)
        .setDescription(description)
        .setColor(0x3498db)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_items_${userId}_1`)
                .setLabel('🗡️ Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_businesses_${userId}_1`)
                .setLabel('🏢 Businesses')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_pets_${userId}_1`)
                .setLabel('🐾 Pets')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_farms_${userId}_1`)
                .setLabel('🌱 Farms')
                .setStyle(ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_bodyguards_${userId}_1`)
                .setLabel('🛡️ Bodyguards')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_networth_${userId}`)
                .setLabel('💎 Net Worth')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`inventory_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row, row2]
    });
}

async function displayItemsCategory(message, userId, page = 1) {
    const inventoryDisplay = formatInventoryDisplay(userId);
    
    const embed = new EmbedBuilder()
        .setTitle(`🗡️ ${message.author.username}'s Items & Equipment`)
        .setDescription(inventoryDisplay)
        .setColor(0xe74c3c)
        .setFooter({ text: 'Use %select weapon/protection <number> to equip items' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_overview_${userId}`)
                .setLabel('📋 Overview')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`inventory_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function displayBusinessesCategory(message, userId, page = 1) {
    const businessData = getUserBusinessData(userId);
    let description = '';

    if (!businessData.businesses || Object.keys(businessData.businesses).length === 0) {
        description = '❌ **No businesses owned**\n\nUse `%business` to start your empire!';
    } else {
        description = '**🏢 Your Business Empire:**\n\n';
        
        Object.entries(businessData.businesses).forEach(([businessId, business]) => {
            const businessInfo = BUSINESS_TYPES[businessId];
            if (businessInfo) {
                description += `${businessInfo.emoji} **${businessInfo.name}**\n`;
                description += `└ 💰 Income: ${businessInfo.income.toLocaleString()} coins/hour\n`;
                description += `└ 📊 Type: ${businessInfo.illegal ? 'Illegal' : 'Legal'}\n`;
                
                if (business.employees) {
                    const employeeCount = Object.values(business.employees).reduce((sum, count) => sum + count, 0);
                    description += `└ 👥 Employees: ${employeeCount}\n`;
                }
                
                description += '\n';
            }
        });
        
        description += `**💼 Total Income:** ${businessData.total_income?.toLocaleString() || 0} coins/hour\n`;
        description += `\n💡 Use \`%business\` to manage your operations`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🏢 ${message.author.username}'s Businesses`)
        .setDescription(description)
        .setColor(0xf39c12)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_overview_${userId}`)
                .setLabel('📋 Overview')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`inventory_business_manage_${userId}`)
                .setLabel('💼 Manage')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function displayPetsCategory(message, userId, page = 1) {
    const userPets = getUserPets(userId);
    let description = '';

    if (!userPets.pets || Object.keys(userPets.pets).length === 0) {
        description = '❌ **No pets owned**\n\nUse `%petshop` to adopt your first companion!';
    } else {
        description = '**🐾 Your Pet Collection:**\n\n';
        
        Object.entries(userPets.pets).forEach(([petId, pet]) => {
            const petInfo = PET_TYPES[pet.type];
            if (petInfo) {
                description += `${petInfo.emoji} **${pet.name}** (${petInfo.name})\n`;
                description += `└ 📊 Level: ${pet.level}\n`;
                description += `└ ❤️ Health: ${pet.stats?.health || 100}/${pet.stats?.max_health || 100}\n`;
                description += `└ 🍖 Hunger: ${pet.hunger || 100}%\n`;
                description += `└ 😊 Happiness: ${pet.happiness || 100}%\n`;
                
                if (pet.active) {
                    description += `└ ⭐ **ACTIVE PET**\n`;
                }
                
                description += '\n';
            }
        });
        
        description += `\n💡 Use \`%pet\` to manage your pets`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🐾 ${message.author.username}'s Pets`)
        .setDescription(description)
        .setColor(0xe67e22)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_overview_${userId}`)
                .setLabel('📋 Overview')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`inventory_pets_manage_${userId}`)
                .setLabel('🐾 Manage')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function displayFarmsCategory(message, userId, page = 1) {
    const farmData = getUserFarmData(userId);
    let description = '';

    if (!farmData.plots || Object.keys(farmData.plots).length === 0) {
        description = '❌ **No farms owned**\n\nUse `%farm` to start your agricultural empire!';
    } else {
        description = '**🌱 Your Farming Operations:**\n\n';
        
        Object.entries(farmData.plots).forEach(([plotId, plot]) => {
            description += `🌱 **Plot ${plotId}**\n`;
            
            if (plot.crop) {
                const cropInfo = CROP_TYPES[plot.crop];
                if (cropInfo) {
                    description += `└ 🌾 Crop: ${cropInfo.emoji} ${cropInfo.name}\n`;
                    description += `└ 📈 Growth: ${plot.growth || 0}%\n`;
                    description += `└ 💰 Value: ${cropInfo.sell_price?.toLocaleString() || 0} coins\n`;
                }
            } else {
                description += `└ 🚫 Empty plot\n`;
            }
            
            description += '\n';
        });
        
        if (farmData.upgrades) {
            description += '**🏠 Farm Upgrades:**\n';
            Object.entries(farmData.upgrades).forEach(([upgradeId, owned]) => {
                if (owned) {
                    description += `✅ ${upgradeId.replace('_', ' ')}\n`;
                }
            });
            description += '\n';
        }
        
        description += `\n💡 Use \`%farm\` to manage your operations`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🌱 ${message.author.username}'s Farms`)
        .setDescription(description)
        .setColor(0x27ae60)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_overview_${userId}`)
                .setLabel('📋 Overview')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`inventory_farms_manage_${userId}`)
                .setLabel('🌱 Manage')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function displayBodyguardsCategory(message, userId, page = 1) {
    const crimeData = getUserCrimeData(userId);
    const bodyguards = crimeData.bodyguards || {};
    let description = '';

    if (Object.keys(bodyguards).length === 0) {
        description = '❌ **No bodyguards hired**\n\nUse `%blackmarket` or `%bodyguards hire` to build your security force!';
    } else {
        description = '**🛡️ Your Security Force:**\n\n';
        
        let totalProtection = 0;
        let dailyCost = 0;
        
        Object.entries(bodyguards).forEach(([type, data]) => {
            const info = getBodyguardInfo(type);
            if (info) {
                totalProtection += info.attack_reduction * data.count;
                dailyCost += info.daily_wage * data.count;
                
                description += `${info.emoji} **${info.name}** x${data.count}\n`;
                description += `└ 🛡️ Protection: ${(info.attack_reduction * 100).toFixed(0)}% each\n`;
                description += `└ 💰 Daily Cost: ${info.daily_wage.toLocaleString()} coins each\n`;
                description += `└ 📍 Assignment: ${data.assignment || 'Personal Protection'}\n\n`;
            }
        });
        
        description += `**📊 Total Protection:** ${(Math.min(totalProtection * 100, 80)).toFixed(0)}% damage reduction\n`;
        description += `**💸 Daily Wages:** ${dailyCost.toLocaleString()} coins\n\n`;
        description += `\n💡 Use \`%bodyguards\` to manage your security`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${message.author.username}'s Bodyguards`)
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_overview_${userId}`)
                .setLabel('📋 Overview')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`inventory_bodyguards_manage_${userId}`)
                .setLabel('🛡️ Manage')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`inventory_refresh_${userId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

function getBodyguardInfo(type) {
    const bodyguardTypes = {
        basic_bodyguard: {
            name: 'Basic Bodyguard',
            emoji: '👨‍💼',
            daily_wage: 500,
            attack_reduction: 0.20
        },
        professional_bodyguard: {
            name: 'Professional Bodyguard',
            emoji: '🕴️',
            daily_wage: 1000,
            attack_reduction: 0.40
        },
        elite_bodyguard: {
            name: 'Elite Bodyguard',
            emoji: '🥷',
            daily_wage: 2000,
            attack_reduction: 0.60
        }
    };
    
    return bodyguardTypes[type];
}

// Export display functions for interaction handler
module.exports.displayInventoryOverview = displayInventoryOverview;
module.exports.displayItemsCategory = displayItemsCategory;
module.exports.displayBusinessesCategory = displayBusinessesCategory;
module.exports.displayPetsCategory = displayPetsCategory;
module.exports.displayFarmsCategory = displayFarmsCategory;
module.exports.displayBodyguardsCategory = displayBodyguardsCategory;
