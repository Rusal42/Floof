const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    BLACKMARKET_ITEMS,
    getUserBlackmarketItems,
    buyBlackmarketItem,
    useBlackmarketItem,
    getActiveEffects,
    formatBlackmarketInventory,
    generateBlackmarketStock
} = require('./utils/blackmarket-manager');

// Blackmarket cooldowns
const blackmarketCooldowns = {};

module.exports = {
    name: 'blackmarket',
    description: 'Access the underground blackmarket for illegal goods',
    usage: '%blackmarket [buy/use/inventory] [item]',
    category: 'gambling',
    aliases: ['bm', 'underground', 'illegal', 'black', 'market'],
    cooldown: 10,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot access the blackmarket for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 10 * 1000; // 10 seconds
        
        if (blackmarketCooldowns[userId] && now < blackmarketCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((blackmarketCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ The dealer is busy! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            await displayBlackmarket(message, userId);
            return;
        }

        const action = args[0].toLowerCase();
        
        // Handle numbered selection: %bm 1, %bm 2 5
        if (!isNaN(parseInt(action))) {
            const itemNumber = parseInt(action);
            const amount = args[1] ? parseInt(args[1]) : 1;
            return await handleNumberedPurchase(message, userId, itemNumber, amount);
        }

        switch (action) {
            case 'buy':
            case 'purchase':
                return await handleBuyItem(message, userId, args.slice(1));
            case 'use':
            case 'consume':
                return await handleUseItem(message, userId, args.slice(1));
            case 'inventory':
            case 'stash':
            case 'inv':
                return await handleInventory(message, userId);
            case 'effects':
            case 'active':
                return await handleActiveEffects(message, userId);
            default:
                await displayBlackmarket(message, userId);
                return;
        }
    }
};

async function displayBlackmarket(message, userId, currentPage = 0) {
    const userBalance = getBalance(userId);
    const stock = generateBlackmarketStock();
    const stockItems = Object.entries(stock);
    
    const itemsPerPage = 12; // Fit more items per page
    const totalPages = Math.ceil(stockItems.length / itemsPerPage);
    
    // Ensure current page is valid
    if (currentPage >= totalPages) currentPage = 0;
    if (currentPage < 0) currentPage = totalPages - 1;
    
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, stockItems.length);
    const pageItems = stockItems.slice(startIndex, endIndex);
    
    let description = `**🏴‍☠️ Welcome to the Underground Blackmarket**\n\n`;
    description += `⚠️ *Psst... looking for something special? I got what you need...*\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**📦 Today's Stock (Page ${currentPage + 1}/${totalPages}):**\n\n`;
    
    pageItems.forEach(([itemId, stockInfo], index) => {
        const item = BLACKMARKET_ITEMS[itemId];
        const itemNumber = startIndex + index + 1;
        const canAfford = userBalance >= stockInfo.price;
        const priceDisplay = canAfford ? `💰 ${stockInfo.price.toLocaleString()}` : `❌ ${stockInfo.price.toLocaleString()}`;
        
        description += `**${itemNumber}.** ${item.emoji} **${item.name}** - ${priceDisplay}\n`;
        description += `└ *${item.description}*\n`;
        description += `└ 📦 **Stock:** ${stockInfo.stock} • ⚠️ **Risk:** ${Math.floor(item.risk * 100)}%\n`;
        description += `└ \`%bm ${itemNumber}\` or \`%bm buy ${itemId}\`\n\n`;
    });
    
    description += '⚠️ **Warning:** All purchases carry risk of police detection!\n';
    description += '🕐 **Stock refreshes daily at midnight**\n\n';
    description += '**📋 Commands:**\n';
    description += '• \`%bm inventory\` - View your stash\n';
    description += '• \`%bm use health pack\` - Consume items\n';
    description += '• \`%bm effects\` - View active effects';

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Underground Blackmarket')
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setFooter({ text: `Page ${currentPage + 1}/${totalPages} • What happens in the blackmarket, stays in the blackmarket...` })
        .setTimestamp();

    // Create navigation buttons
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`blackmarket_prev_${userId}_${currentPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`blackmarket_next_${userId}_${currentPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`blackmarket_refresh_${userId}`)
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Primary)
            );
        components.push(row);
    }

    return await sendAsFloofWebhook(message, { 
        embeds: [embed], 
        components: components 
    });
}

async function handleBuyItem(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify item to buy!\nExample: `%blackmarket buy weed`')
                    .setColor(0xff0000)
            ]
        });
    }

    const itemId = args[0].toLowerCase();
    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 10) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Quantity must be between 1 and 10!')
                    .setColor(0xff0000)
            ]
        });
    }

    const stock = generateBlackmarketStock();
    
    if (!stock[itemId]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ That item is not available today! Check back tomorrow.')
                    .setColor(0xff0000)
            ]
        });
    }

    if (stock[itemId].stock < quantity) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Not enough in stock! Only ${stock[itemId].stock} available.`)
                    .setColor(0xff0000)
            ]
        });
    }

    const totalCost = stock[itemId].price * quantity;
    const userBalance = getBalance(userId);

    if (userBalance < totalCost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Set cooldown
    blackmarketCooldowns[userId] = Date.now();

    const result = buyBlackmarketItem(userId, itemId, quantity);

    if (!result.success) {
        if (result.reason === 'caught') {
            // Use crime manager arrest function
            const { arrestUser } = require('./utils/crime-manager');
            const arrestDuration = result.arrest_time * 60 * 1000; // Convert to milliseconds
            arrestUser(userId, arrestDuration, 'Drug Purchase', result.bail_amount);
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🚨 BUSTED!')
                        .setDescription(`**POLICE RAID!** You were caught buying illegal items!\n\n🚔 **ARRESTED** for ${result.arrest_time} minutes!\n💸 **Bail Amount:** ${result.bail_amount.toLocaleString()} coins\n\n*The cops were watching the blackmarket...*\n\nUse \`%bail\` to pay bail or wait for help!`)
                        .setColor(0xff0000)
                        .setTimestamp()
                ]
            });
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Purchase failed!')
                    .setColor(0xff0000)
            ]
        });
    }

    // Successful purchase
    subtractBalance(userId, totalCost);
    
    // Update stock
    const data = require('fs').readFileSync(require('path').join(__dirname, '../../../blackmarket-data.json'), 'utf8');
    const blackmarketData = JSON.parse(data);
    blackmarketData.daily_stock[itemId].stock -= quantity;
    require('fs').writeFileSync(require('path').join(__dirname, '../../../blackmarket-data.json'), JSON.stringify(blackmarketData, null, 2));

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Purchase Successful!')
        .setDescription(`*The dealer slides you the goods in a dark alley...*\n\n${result.item.emoji} Successfully purchased **${quantity}x ${result.item.name}**!\n\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n💡 Use \`%blackmarket use ${itemId}\` to consume the item!`)
        .setColor(0x2c2c2c)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleUseItem(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify item to use!\nExample: `%blackmarket use beer`')
                    .setColor(0xff0000)
            ]
        });
    }

    const itemId = args[0].toLowerCase();
    const result = useBlackmarketItem(userId, itemId);

    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have any ${BLACKMARKET_ITEMS[itemId]?.name || itemId}!`)
                    .setColor(0xff0000)
            ]
        });
    }

    let effectMsg = `${result.item.emoji} You consumed **${result.item.name}**!\n\n`;
    
    // Describe effects
    if (result.effects.luck_boost) {
        effectMsg += `🍀 **Luck Boost:** +${result.effects.luck_boost}% for ${result.effects.duration} minutes\n`;
    }
    if (result.effects.speed_boost) {
        effectMsg += `💨 **Speed Boost:** +${result.effects.speed_boost}% for ${result.effects.duration} minutes\n`;
    }
    if (result.effects.cooldown_reduction) {
        effectMsg += `⏰ **Cooldown Reduction:** -${result.effects.cooldown_reduction}% for ${result.effects.duration} minutes\n`;
    }
    if (result.effects.xp_multiplier) {
        effectMsg += `⭐ **XP Multiplier:** x${result.effects.xp_multiplier} for ${result.effects.duration} minutes\n`;
    }
    if (result.effects.damage_immunity) {
        effectMsg += `🛡️ **Damage Immunity:** -${result.effects.damage_immunity}% damage for ${result.effects.duration} minutes\n`;
    }
    if (result.effects.attack_boost) {
        effectMsg += `⚔️ **Attack Boost:** +${result.effects.attack_boost}% for ${result.effects.duration} minutes\n`;
    }
    if (result.effects.defense_boost) {
        effectMsg += `🛡️ **Defense Boost:** +${result.effects.defense_boost}% for ${result.effects.duration} minutes\n`;
    }
    if (result.effects.cooldown_reset) {
        effectMsg += `🔄 **All cooldowns have been reset!**\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle('💊 Item Consumed!')
        .setDescription(effectMsg)
        .setColor(0x9b59b6)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleInventory(message, userId) {
    const inventoryDisplay = formatBlackmarketInventory(userId);
    
    const embed = new EmbedBuilder()
        .setTitle(`🏴‍☠️ ${message.author.username}'s Blackmarket Stash`)
        .setDescription(inventoryDisplay)
        .setColor(0x2c2c2c)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Use %blackmarket use health pack to consume items' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleActiveEffects(message, userId) {
    const activeEffects = getActiveEffects(userId);
    
    if (Object.keys(activeEffects).length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('💊 You have no active effects.')
                    .setColor(0x95a5a6)
            ]
        });
    }

    let effectsMsg = '**⚡ Your Active Effects:**\n\n';
    
    Object.entries(activeEffects).forEach(([effectId, effect]) => {
        const item = BLACKMARKET_ITEMS[effectId];
        const timeLeft = Math.ceil((effect.expires_at - Date.now()) / 60000);
        effectsMsg += `${item.emoji} **${item.name}**\n`;
        effectsMsg += `└ ⏱️ ${timeLeft} minutes remaining\n`;
        effectsMsg += `└ ${item.description}\n\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('⚡ Active Effects')
        .setDescription(effectsMsg)
        .setColor(0x9b59b6)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Handle numbered purchase from blackmarket
async function handleNumberedPurchase(message, userId, itemNumber, amount = 1) {
    const stock = generateBlackmarketStock();
    const stockItems = Object.entries(stock);
    
    if (itemNumber < 1 || itemNumber > stockItems.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid item number! Choose 1-${stockItems.length}.\nUse \`%bm\` to see today's stock.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const [selectedItemId] = stockItems[itemNumber - 1];
    return await handleBuyItem(message, userId, [selectedItemId, amount.toString()]);
}

// Export functions for interaction handlers
module.exports.displayBlackmarket = displayBlackmarket;
