const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { getBalance } = require('../commands/gambling/utils/balance-manager');
const { getItemInfo } = require('../commands/gambling/utils/inventory-manager');

// Shop categories and items with prices (copied from shop.js)
const SHOP_ITEMS = {
    weapons: {
        name: '🔫 Weapons',
        emoji: '🔫',
        items: {
            pistol: { price: 2500, description: 'Basic sidearm with decent damage' },
            rifle: { price: 8000, description: 'High-damage long-range weapon' },
            crossbow: { price: 4500, description: 'Silent and deadly projectile weapon' },
            flamethrower: { price: 15000, description: 'Area damage fire weapon' },
            laser: { price: 25000, description: 'High-tech energy weapon' },
            speaker: { price: 1500, description: 'Sonic weapon that stuns enemies' }
        }
    },
    ammo: {
        name: '🔸 Ammunition',
        emoji: '🔸',
        items: {
            bullets: { price: 50, description: 'Standard ammunition for pistols and rifles', bundle: 25 },
            arrows: { price: 75, description: 'Sharp arrows for crossbows', bundle: 20 },
            fuel: { price: 100, description: 'Fuel canisters for flamethrowers', bundle: 10 },
            energy: { price: 150, description: 'Energy cells for laser weapons', bundle: 15 },
            sound: { price: 25, description: 'Sound waves for speakers', bundle: 30 }
        }
    },
    protection: {
        name: '🛡️ Protection',
        emoji: '🛡️',
        items: {
            armor: { price: 5000, description: 'Body armor that reduces damage' },
            helmet: { price: 2000, description: 'Head protection gear' },
            shield: { price: 7500, description: 'Riot shield for maximum defense' }
        }
    },
    consumables: {
        name: '🍺 Consumables',
        emoji: '🍺',
        items: {
            health_pack: { price: 500, description: 'Restores 50 health points' },
            energy_drink: { price: 300, description: 'Boosts energy and removes fatigue' },
            beer: { price: 750, description: 'Removes all cooldowns when consumed' }
        }
    },
    tools: {
        name: '🔧 Tools & Special',
        emoji: '🔧',
        items: {
            briefcase: { price: 10000, description: 'Mystery box with random valuable contents' },
            lockpick: { price: 1200, description: 'Tool for breaking into things' },
            smoke_grenade: { price: 800, description: 'Creates cover and confusion' }
        }
    }
};

// Get ammo type for weapons
function getAmmoType(weaponId) {
    const ammoMap = {
        pistol: 'bullets',
        rifle: 'bullets', 
        crossbow: 'arrows',
        flamethrower: 'fuel',
        laser: 'energy',
        speaker: 'sound'
    };
    return ammoMap[weaponId];
}

async function handleShopInteraction(interaction) {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // Check if this is a shop button
    if (!customId.startsWith('shop_')) return;
    
    const parts = customId.split('_');
    const action = parts[1]; // prev, next, or refresh
    const targetUserId = parts[2];
    const currentPage = parseInt(parts[3]) || 0;
    
    // Only allow the original user to interact
    if (interaction.user.id !== targetUserId) {
        return await interaction.reply({
            content: '❌ This shop interface is not for you!',
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
    
    // Generate the updated shop display
    const userBalance = getBalance(targetUserId);
    
    // Get all items across all categories
    const allItems = [];
    for (const [categoryId, category] of Object.entries(SHOP_ITEMS)) {
        for (const [itemId, shopItem] of Object.entries(category.items)) {
            const itemInfo = getItemInfo(itemId);
            allItems.push({
                itemId,
                shopItem,
                categoryId,
                itemInfo,
                category
            });
        }
    }
    
    const itemsPerPage = 12;
    const totalPages = Math.ceil(allItems.length / itemsPerPage);
    
    // Ensure new page is valid
    if (newPage >= totalPages) newPage = 0;
    if (newPage < 0) newPage = totalPages - 1;
    
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allItems.length);
    const pageItems = allItems.slice(startIndex, endIndex);
    
    let description = `**🏪 Welcome to Floof's Armory & Shop**\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**📦 Available Items (Page ${newPage + 1}/${totalPages}):**\n\n`;
    
    pageItems.forEach((item, index) => {
        const itemNumber = startIndex + index + 1;
        const canAfford = userBalance >= item.shopItem.price;
        const priceDisplay = canAfford ? `💰 ${item.shopItem.price.toLocaleString()}` : `❌ ${item.shopItem.price.toLocaleString()}`;
        
        description += `**${itemNumber}.** ${item.itemInfo.emoji} **${item.itemInfo.name}** - ${priceDisplay}`;
        
        if (item.shopItem.bundle) {
            description += ` (${item.shopItem.bundle}x bundle)`;
        }
        
        description += `\n└ *${item.shopItem.description}*\n`;
        description += `└ 📂 **Category:** ${item.category.name}`;
        
        // Show ammo requirements for weapons
        if (item.categoryId === 'weapons') {
            const ammoType = getAmmoType(item.itemId);
            if (ammoType) {
                description += ` • 🔸 **Ammo:** ${ammoType}`;
            }
        }
        
        description += `\n└ \`%shop ${itemNumber}\` or \`%shop buy ${item.itemId}\`\n\n`;
    });
    
    description += '**📋 Commands:**\n';
    description += '• `%shop <category>` - Browse specific category\n';
    description += '• `%shop buy <item> [amount]` - Purchase items\n';
    description += '• `%inventory` - View your items';

    const embed = new EmbedBuilder()
        .setTitle('🏪 Floof\'s Armory & Shop')
        .setDescription(description)
        .setColor(0x3498db)
        .setFooter({ text: `Page ${newPage + 1}/${totalPages} • All sales final` })
        .setTimestamp();

    // Create updated navigation buttons
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_prev_${targetUserId}_${newPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === 0),
                new ButtonBuilder()
                    .setCustomId(`shop_next_${targetUserId}_${newPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`shop_refresh_${targetUserId}`)
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
            console.error('Failed to update shop interaction:', error.message);
        }
    }
}

module.exports = { handleShopInteraction };
