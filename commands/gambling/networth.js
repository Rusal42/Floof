const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance } = require('./utils/balance-manager');
const { getUserBusinessData } = require('./utils/business-manager');
const { getUserPets } = require('./utils/pet-manager');

module.exports = {
    name: 'networth',
    description: 'Calculate and display your total net worth',
    usage: '%networth',
    category: 'gambling',
    aliases: ['nw', 'worth', 'wealth'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        const netWorthData = await calculateNetWorth(userId);
        
        return await displayNetWorthSummary(message, userId, netWorthData);
    }
};

async function calculateNetWorth(userId) {
    const balance = getBalance(userId);
    let businessValue = 0;
    let petValue = 0;
    let itemValue = 0;
    
    // Calculate business value
    try {
        const businessData = getUserBusinessData(userId);
        if (businessData.businesses) {
            Object.values(businessData.businesses).forEach(business => {
                businessValue += business.value || 0;
            });
        }
    } catch (error) {
        console.log('Error calculating business value:', error);
    }
    
    // Calculate pet value
    try {
        const petData = getUserPets(userId);
        if (petData.pets) {
            petData.pets.forEach(pet => {
                const { PET_TYPES } = require('./utils/pet-manager');
                const petInfo = PET_TYPES[pet.type];
                if (petInfo) {
                    petValue += petInfo.price;
                }
            });
        }
    } catch (error) {
        console.log('Error calculating pet value:', error);
    }
    
    const totalNetWorth = balance + businessValue + petValue + itemValue;
    
    return {
        balance,
        businessValue,
        petValue,
        itemValue,
        totalNetWorth
    };
}

async function displayNetWorthSummary(message, userId, netWorthData) {
    const { balance, businessValue, petValue, itemValue, totalNetWorth } = netWorthData;
    
    let description = `**💰 Liquid Cash:** ${balance.toLocaleString()} coins\n`;
    description += `**🏢 Business Assets:** ${businessValue.toLocaleString()} coins\n`;
    description += `**🐾 Pet Collection:** ${petValue.toLocaleString()} coins\n`;
    description += `**🎒 Item Inventory:** ${itemValue.toLocaleString()} coins\n\n`;
    description += `**💎 Total Net Worth:** ${totalNetWorth.toLocaleString()} coins`;

    const embed = new EmbedBuilder()
        .setTitle(`💎 ${message.author.username}'s Net Worth`)
        .setDescription(description)
        .setColor(0xffd700)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
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
    const { balance, businessValue, petValue, itemValue, totalNetWorth } = netWorthData;
    
    let description = `**💰 Liquid Assets:**\n`;
    description += `└ Cash: ${balance.toLocaleString()} coins\n\n`;
    
    description += `**🏢 Business Portfolio:**\n`;
    try {
        const businessData = getUserBusinessData(userId);
        if (businessData.businesses && Object.keys(businessData.businesses).length > 0) {
            Object.entries(businessData.businesses).forEach(([type, business]) => {
                description += `└ ${business.emoji || '🏢'} ${business.name}: ${(business.value || 0).toLocaleString()} coins\n`;
            });
        } else {
            description += `└ No businesses owned\n`;
        }
    } catch (error) {
        description += `└ Error loading business data\n`;
    }
    
    description += `\n**🐾 Pet Collection:**\n`;
    try {
        const petData = getUserPets(userId);
        if (petData.pets && petData.pets.length > 0) {
            petData.pets.forEach(pet => {
                const { PET_TYPES } = require('./utils/pet-manager');
                const petInfo = PET_TYPES[pet.type];
                if (petInfo) {
                    description += `└ ${petInfo.emoji} ${pet.name}: ${petInfo.price.toLocaleString()} coins\n`;
                }
            });
        } else {
            description += `└ No pets owned\n`;
        }
    } catch (error) {
        description += `└ Error loading pet data\n`;
    }
    
    description += `\n**🎒 Item Inventory:**\n`;
    description += `└ No items tracked yet\n\n`;
    description += `**💎 Total Net Worth:** ${totalNetWorth.toLocaleString()} coins`;

    const embed = new EmbedBuilder()
        .setTitle(`📊 ${message.author.username}'s Detailed Net Worth`)
        .setDescription(description)
        .setColor(0xffd700)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`networth_summary_${userId}`)
                .setLabel('📋 Summary View')
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

module.exports.calculateNetWorth = calculateNetWorth;
module.exports.displayNetWorthSummary = displayNetWorthSummary;
module.exports.displayDetailedNetWorth = displayDetailedNetWorth;