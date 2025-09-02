const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, subtractBalance } = require('./utils/balance-manager');
const { addItem, getItemInfo, getAllItemTypes } = require('./utils/inventory-manager');

// Shop categories and items with prices
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

module.exports = {
    name: 'shop',
    description: 'Browse and purchase weapons, ammo, and items',
    usage: '%shop [category] [buy] [item] [amount]',
    category: 'gambling',
    aliases: ['store', 'buy', 's', 'armory'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot access the shop for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length === 0) {
            return await displayShopCategories(message);
        }

        const category = args[0].toLowerCase();
        
        // Handle numbered selection: %shop 1, %shop 2 1, %shop weapons 3
        if (!isNaN(parseInt(category))) {
            const itemNumber = parseInt(category);
            const amount = args[1] ? parseInt(args[1]) : 1;
            return await handleNumberedPurchase(message, userId, itemNumber, amount);
        }
        
        // Handle category numbered selection: %shop weapons 1
        if (SHOP_ITEMS[category] && args.length >= 2 && !isNaN(parseInt(args[1]))) {
            const itemNumber = parseInt(args[1]);
            const amount = args[2] ? parseInt(args[2]) : 1;
            return await handleCategoryNumberedPurchase(message, userId, category, itemNumber, amount);
        }

        // Handle direct buy command: %shop buy item amount
        if (category === 'buy' && args.length >= 2) {
            const itemId = args[1].toLowerCase();
            const amount = args[2] ? parseInt(args[2]) : 1;
            return await handlePurchase(message, userId, itemId, amount);
        }
        
        // Handle category buy: %shop weapons buy pistol
        if (args.length >= 3 && args[1].toLowerCase() === 'buy') {
            const itemId = args[2].toLowerCase();
            const amount = args[3] ? parseInt(args[3]) : 1;
            return await handlePurchase(message, userId, itemId, amount);
        }

        // Display specific category
        if (SHOP_ITEMS[category]) {
            return await displayCategory(message, category);
        }

        // Invalid category
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid category! Use `%shop` to see all categories.')
                    .setColor(0xff0000)
            ]
        });
    }
};

async function displayShopCategories(message) {
    let description = '**Welcome to Floof\'s Armory & Supply Store!** 🏪\n\n';
    description += 'Choose a category to browse items:\n\n';
    
    let categoryIndex = 1;
    for (const [categoryId, category] of Object.entries(SHOP_ITEMS)) {
        const itemCount = Object.keys(category.items).length;
        description += `**${categoryIndex}.** ${category.emoji} **${category.name}** (${itemCount} items)\n`;
        description += `└ \`%s ${categoryId}\` or \`%s ${categoryIndex}\`\n\n`;
        categoryIndex++;
    }
    
    description += '💡 **Quick Buy Options:**\n';
    description += '• `%s buy <item> [amount]` - Buy by name\n';
    description += '• `%s <number> [amount]` - Buy by item number\n';
    description += '• `%s <category> <number>` - Buy from category\n\n';
    description += '💰 **Your Balance:** ' + getBalance(message.author.id).toLocaleString() + ' coins';

    const embed = new EmbedBuilder()
        .setTitle('🏪 Floof\'s Armory & Supply Store')
        .setDescription(description)
        .setColor(0x3498db)
        .setFooter({ text: 'All sales are final! Choose wisely.' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayCategory(message, categoryId) {
    const category = SHOP_ITEMS[categoryId];
    const userBalance = getBalance(message.author.id);
    
    let description = `**${category.name}**\n\n`;
    
    let itemIndex = 1;
    for (const [itemId, shopItem] of Object.entries(category.items)) {
        const itemInfo = getItemInfo(itemId);
        const canAfford = userBalance >= shopItem.price;
        const priceDisplay = canAfford ? `💰 ${shopItem.price.toLocaleString()}` : `❌ ${shopItem.price.toLocaleString()}`;
        
        description += `**${itemIndex}.** ${itemInfo.emoji} **${itemInfo.name}**\n`;
        description += `└ ${shopItem.description}\n`;
        description += `└ ${priceDisplay} coins`;
        
        if (shopItem.bundle) {
            description += ` (${shopItem.bundle}x)`;
        }
        
        description += `\n└ \`%s ${categoryId} ${itemIndex}\` or \`%s buy ${itemId}\`\n\n`;
        itemIndex++;
    }
    
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins`;

    const embed = new EmbedBuilder()
        .setTitle(`🏪 ${category.name}`)
        .setDescription(description)
        .setColor(0x3498db)
        .setFooter({ text: 'Use %s <category> <number> or %s buy <item> to purchase' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handlePurchase(message, userId, itemId, amount = 1) {
    if (amount <= 0 || amount > 100) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid amount! You can buy 1-100 items at a time.')
                    .setColor(0xff0000)
            ]
        });
    }

    // Find item in shop
    let shopItem = null;
    let categoryName = '';
    
    for (const [catId, category] of Object.entries(SHOP_ITEMS)) {
        if (category.items[itemId]) {
            shopItem = category.items[itemId];
            categoryName = category.name;
            break;
        }
    }

    if (!shopItem) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Item not found in shop! Use `%shop` to see available items.')
                    .setColor(0xff0000)
            ]
        });
    }

    const itemInfo = getItemInfo(itemId);
    const totalCost = shopItem.price * amount;
    const userBalance = getBalance(userId);

    if (userBalance < totalCost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n**${itemInfo.emoji} ${itemInfo.name}** x${amount}\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins\n❌ **Need:** ${(totalCost - userBalance).toLocaleString()} more coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if it's a weapon and user already owns one
    if (itemInfo.type === 'weapon') {
        const { hasItem } = require('./utils/inventory-manager');
        if (hasItem(userId, itemId, 1)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You already own a **${itemInfo.name}**!\n\nWeapons are limited to one per person. You can only buy ammo for weapons you own.`)
                        .setColor(0xff0000)
                ]
            });
        }
        
        // Weapons can only be bought one at a time
        if (amount > 1) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You can only buy **one** of each weapon!\n\nUse \`%shop ammo\` to buy ammunition instead.`)
                        .setColor(0xff0000)
                ]
            });
        }
    }

    // Process purchase
    subtractBalance(userId, totalCost);
    
    // Add items to inventory (handle bundles)
    let itemsReceived = amount;
    if (shopItem.bundle) {
        itemsReceived = amount * shopItem.bundle;
    }
    
    addItem(userId, itemId, itemsReceived);

    // Success message
    let successMsg = `🛒 **Purchase Successful!**\n\n`;
    successMsg += `${itemInfo.emoji} **${itemInfo.name}**`;
    
    if (shopItem.bundle) {
        successMsg += ` x${amount} (${itemsReceived} total)`;
    } else {
        successMsg += ` x${amount}`;
    }
    
    successMsg += `\n💰 **Cost:** ${totalCost.toLocaleString()} coins`;
    successMsg += `\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`;
    successMsg += `\n\n📦 Items have been added to your inventory!`;

    const embed = new EmbedBuilder()
        .setTitle('🛒 Purchase Complete')
        .setDescription(successMsg)
        .setColor(0x00ff00)
        .setFooter({ text: 'Use %inventory to view your items' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Handle numbered purchase from all items
async function handleNumberedPurchase(message, userId, itemNumber, amount = 1) {
    const allItems = [];
    
    // Build list of all items with their category
    for (const [categoryId, category] of Object.entries(SHOP_ITEMS)) {
        for (const [itemId, shopItem] of Object.entries(category.items)) {
            allItems.push({ itemId, shopItem, categoryId });
        }
    }
    
    if (itemNumber < 1 || itemNumber > allItems.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid item number! Choose 1-${allItems.length}.\nUse \`%s\` to see all items.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const selectedItem = allItems[itemNumber - 1];
    return await handlePurchase(message, userId, selectedItem.itemId, amount);
}

// Handle numbered purchase from specific category
async function handleCategoryNumberedPurchase(message, userId, categoryId, itemNumber, amount = 1) {
    const category = SHOP_ITEMS[categoryId];
    if (!category) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid category!')
                    .setColor(0xff0000)
            ]
        });
    }
    
    const items = Object.keys(category.items);
    
    if (itemNumber < 1 || itemNumber > items.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid item number! Choose 1-${items.length} for ${category.name}.\nUse \`%s ${categoryId}\` to see items.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const selectedItemId = items[itemNumber - 1];
    return await handlePurchase(message, userId, selectedItemId, amount);
}
