const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance } = require('./utils/balance-manager');
const { getUserInventory, getItemInfo, getAllItemTypes } = require('./utils/inventory-manager');
const { getUserPets } = require('./utils/pet-manager');

module.exports = {
    name: 'inventory',
    description: 'View your inventory and assets',
    usage: '%inventory [category]',
    category: 'gambling',
    aliases: ['inv', 'items', 'bag', 'i'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        const userBalance = getBalance(userId);
        const userInventory = getUserInventory(userId);
        const userPets = getUserPets(userId);
        
        // Filter by category if specified
        const category = args[0] ? args[0].toLowerCase() : null;
        
        let description = `**💰 Balance:** ${userBalance.toLocaleString()} coins\n\n`;
        
        // Show pets
        if (!category || category === 'pets') {
            description += `**🐾 Pets (${userPets.pets.length}/5):**\n`;
            if (userPets.pets.length === 0) {
                description += `❌ No pets owned\n`;
            } else {
                userPets.pets.forEach(pet => {
                    const isActive = pet.id === userPets.active_pet ? '⭐' : '';
                    description += `${isActive} 🐾 **${pet.name}** (Lv.${pet.level})\n`;
                });
            }
            description += `\n`;
        }
        
        // Show inventory items
        if (!category || category === 'items') {
            description += `**🎒 Items:**\n`;
            const hasItems = Object.keys(userInventory).length > 0;
            
            if (!hasItems) {
                description += `❌ No items in inventory\n`;
            } else {
                // Group items by type
                const itemsByType = {};
                for (const [itemId, quantity] of Object.entries(userInventory)) {
                    const itemInfo = getItemInfo(itemId);
                    if (itemInfo) {
                        if (!itemsByType[itemInfo.type]) {
                            itemsByType[itemInfo.type] = [];
                        }
                        itemsByType[itemInfo.type].push({
                            id: itemId,
                            info: itemInfo,
                            quantity: quantity
                        });
                    }
                }
                
                // Display items by category
                for (const [type, items] of Object.entries(itemsByType)) {
                    if (category && category !== type) continue;
                    
                    const typeEmoji = {
                        weapon: '🔫',
                        ammo: '🔸',
                        protection: '🛡️',
                        consumable: '🍺',
                        tool: '🔧'
                    };
                    
                    description += `\n**${typeEmoji[type] || '📦'} ${type.charAt(0).toUpperCase() + type.slice(1)}:**\n`;
                    items.forEach(item => {
                        description += `${item.info.emoji} **${item.info.name}** x${item.quantity}\n`;
                    });
                }
            }
        }
        
        // Show pet items
        if (!category || category === 'petitems') {
            description += `\n**🐾 Pet Items:**\n`;
            const petItems = userPets.pet_items || {};
            const hasPetItems = Object.keys(petItems).length > 0;
            
            if (!hasPetItems) {
                description += `❌ No pet items\n`;
            } else {
                for (const [itemId, quantity] of Object.entries(petItems)) {
                    const { PET_ITEMS } = require('./utils/pet-manager');
                    const itemInfo = PET_ITEMS[itemId];
                    if (itemInfo) {
                        description += `${itemInfo.emoji} **${itemInfo.name}** x${quantity}\n`;
                    }
                }
            }
        }
        
        if (!category) {
            description += `\n**💡 Commands:**\n`;
            description += `• \`%shop\` - Buy weapons and items\n`;
            description += `• \`%petshop\` - Buy pets and pet items\n`;
            description += `• \`%inv <category>\` - Filter by category\n`;
            description += `• Categories: items, pets, petitems`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎒 ${message.author.username}'s Inventory`)
            .setDescription(description)
            .setColor(0x3498db)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`inventory_refresh_${userId}`)
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`inventory_items_${userId}`)
                    .setLabel('🎒 Items')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`inventory_pets_${userId}`)
                    .setLabel('🐾 Pets')
                    .setStyle(ButtonStyle.Primary)
            );

        return await sendAsFloofWebhook(message, {
            embeds: [embed],
            components: [row]
        });
    }
};