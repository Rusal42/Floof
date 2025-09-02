const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { addItem, hasItem, removeItem, getItemInfo } = require('./utils/inventory-manager');

// Briefcase tiers and their contents
const BRIEFCASE_TIERS = {
    common: {
        name: 'Common Briefcase',
        emoji: '💼',
        price: 2500,
        rewards: {
            coins: { min: 1000, max: 5000, weight: 40 },
            items: {
                health_pack: { amount: [1, 3], weight: 20 },
                energy_drink: { amount: [1, 2], weight: 15 },
                bullets: { amount: [10, 25], weight: 15 },
                arrows: { amount: [5, 15], weight: 10 }
            }
        }
    },
    rare: {
        name: 'Rare Briefcase',
        emoji: '💎',
        price: 7500,
        rewards: {
            coins: { min: 3000, max: 12000, weight: 35 },
            items: {
                pistol: { amount: 1, weight: 15 },
                armor: { amount: 1, weight: 12 },
                health_pack: { amount: [2, 5], weight: 15 },
                lockpick: { amount: [1, 2], weight: 10 },
                bullets: { amount: [20, 50], weight: 8 },
                fuel: { amount: [3, 8], weight: 5 }
            }
        }
    },
    epic: {
        name: 'Epic Briefcase',
        emoji: '🔥',
        price: 20000,
        rewards: {
            coins: { min: 8000, max: 30000, weight: 30 },
            items: {
                rifle: { amount: 1, weight: 15 },
                crossbow: { amount: 1, weight: 12 },
                shield: { amount: 1, weight: 10 },
                beer: { amount: [1, 3], weight: 10 },
                smoke_grenade: { amount: [2, 4], weight: 8 },
                energy: { amount: [5, 15], weight: 8 },
                briefcase: { amount: 1, weight: 7 } // Can contain another briefcase!
            }
        }
    },
    legendary: {
        name: 'Legendary Briefcase',
        emoji: '👑',
        price: 50000,
        rewards: {
            coins: { min: 20000, max: 75000, weight: 25 },
            items: {
                flamethrower: { amount: 1, weight: 12 },
                laser: { amount: 1, weight: 8 },
                helmet: { amount: 1, weight: 10 },
                armor: { amount: 1, weight: 10 },
                shield: { amount: 1, weight: 8 },
                beer: { amount: [2, 5], weight: 10 },
                briefcase: { amount: [1, 2], weight: 12 }, // Epic briefcases
                lockpick: { amount: [3, 6], weight: 5 }
            }
        }
    }
};

module.exports = {
    name: 'briefcase',
    description: 'Open mystery briefcases for random rewards',
    usage: '%briefcase [buy/open] [amount] | %bc [buy/open] [amount]',
    category: 'gambling',
    aliases: ['case', 'box', 'mystery', 'bc', 'loot'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot open briefcases for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length === 0) {
            return await displayBriefcaseInfo(message, userId);
        }

        const action = args[0].toLowerCase();
        
        if (action === 'buy' || action === 'purchase') {
            const tier = args[1]?.toLowerCase();
            return await handlePurchase(message, userId, tier);
        }
        
        if (action === 'open') {
            const tier = args[1]?.toLowerCase() || 'briefcase';
            return await handleOpen(message, userId, tier);
        }

        // Direct tier name (e.g., %briefcase common)
        if (BRIEFCASE_TIERS[action]) {
            return await handleOpen(message, userId, action);
        }

        return await displayBriefcaseInfo(message, userId);
    }
};

async function displayBriefcaseInfo(message, userId) {
    const userBalance = getBalance(userId);
    let description = '**🎁 Mystery Briefcase System**\n\n';
    description += 'Purchase and open briefcases for random rewards!\n\n';
    
    for (const [tier, info] of Object.entries(BRIEFCASE_TIERS)) {
        const canAfford = userBalance >= info.price;
        const priceDisplay = canAfford ? `💰 ${info.price.toLocaleString()}` : `❌ ${info.price.toLocaleString()}`;
        
        description += `${info.emoji} **${info.name}**\n`;
        description += `└ ${priceDisplay} coins\n`;
        description += `└ \`%briefcase buy ${tier}\`\n\n`;
    }
    
    // Show owned briefcases
    const ownedBriefcases = [];
    for (const tier of Object.keys(BRIEFCASE_TIERS)) {
        if (hasItem(userId, tier === 'common' ? 'briefcase' : `${tier}_briefcase`, 1)) {
            const count = hasItem(userId, tier === 'common' ? 'briefcase' : `${tier}_briefcase`);
            ownedBriefcases.push(`${BRIEFCASE_TIERS[tier].emoji} ${count}x ${BRIEFCASE_TIERS[tier].name}`);
        }
    }
    
    if (ownedBriefcases.length > 0) {
        description += '**📦 Your Briefcases:**\n';
        description += ownedBriefcases.join('\n') + '\n\n';
        description += '💡 Use `%briefcase open [tier]` to open them!\n\n';
    }
    
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins`;

    const embed = new EmbedBuilder()
        .setTitle('🎁 Mystery Briefcase System')
        .setDescription(description)
        .setColor(0x9b59b6)
        .setFooter({ text: 'Higher tier briefcases have better rewards!' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handlePurchase(message, userId, tier) {
    if (!tier || !BRIEFCASE_TIERS[tier]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid briefcase tier! Available: `common`, `rare`, `epic`, `legendary`')
                    .setColor(0xff0000)
            ]
        });
    }

    const briefcaseInfo = BRIEFCASE_TIERS[tier];
    const userBalance = getBalance(userId);
    
    if (userBalance < briefcaseInfo.price) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n${briefcaseInfo.emoji} **${briefcaseInfo.name}**\n💰 **Cost:** ${briefcaseInfo.price.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins\n❌ **Need:** ${(briefcaseInfo.price - userBalance).toLocaleString()} more coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Process purchase
    subtractBalance(userId, briefcaseInfo.price);
    const itemId = tier === 'common' ? 'briefcase' : `${tier}_briefcase`;
    addItem(userId, itemId, 1);

    const embed = new EmbedBuilder()
        .setTitle('🛒 Briefcase Purchased!')
        .setDescription(`Successfully purchased ${briefcaseInfo.emoji} **${briefcaseInfo.name}**!\n\n💰 **Cost:** ${briefcaseInfo.price.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n📦 Use \`%briefcase open ${tier}\` to open it!`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleOpen(message, userId, tier) {
    // Handle generic "briefcase" -> "common"
    if (tier === 'briefcase') {
        tier = 'common';
    }
    
    if (!BRIEFCASE_TIERS[tier]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid briefcase tier! Available: `common`, `rare`, `epic`, `legendary`')
                    .setColor(0xff0000)
            ]
        });
    }

    const itemId = tier === 'common' ? 'briefcase' : `${tier}_briefcase`;
    
    if (!hasItem(userId, itemId, 1)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have any ${BRIEFCASE_TIERS[tier].name}s!\nUse \`%briefcase buy ${tier}\` to purchase one.`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Remove briefcase from inventory
    removeItem(userId, itemId, 1);
    
    // Generate rewards
    const rewards = generateRewards(tier);
    
    // Apply rewards
    let rewardText = '';
    let totalCoins = 0;
    
    for (const reward of rewards) {
        if (reward.type === 'coins') {
            totalCoins += reward.amount;
            rewardText += `💰 **${reward.amount.toLocaleString()}** coins\n`;
        } else {
            addItem(userId, reward.item, reward.amount);
            const itemInfo = getItemInfo(reward.item);
            rewardText += `${itemInfo.emoji} **${reward.amount}x ${itemInfo.name}**\n`;
        }
    }
    
    if (totalCoins > 0) {
        addBalance(userId, totalCoins);
    }

    const briefcaseInfo = BRIEFCASE_TIERS[tier];
    const embed = new EmbedBuilder()
        .setTitle(`🎁 ${briefcaseInfo.name} Opened!`)
        .setDescription(`${briefcaseInfo.emoji} You opened a **${briefcaseInfo.name}** and received:\n\n${rewardText}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(getColorForTier(tier))
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

function generateRewards(tier) {
    const briefcaseInfo = BRIEFCASE_TIERS[tier];
    const rewards = [];
    
    // Create weighted pool
    const pool = [];
    
    // Add coins to pool
    for (let i = 0; i < briefcaseInfo.rewards.coins.weight; i++) {
        pool.push({ type: 'coins' });
    }
    
    // Add items to pool
    for (const [itemId, itemData] of Object.entries(briefcaseInfo.rewards.items)) {
        for (let i = 0; i < itemData.weight; i++) {
            pool.push({ type: 'item', item: itemId, data: itemData });
        }
    }
    
    // Generate 1-3 rewards
    const numRewards = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numRewards; i++) {
        const selected = pool[Math.floor(Math.random() * pool.length)];
        
        if (selected.type === 'coins') {
            const amount = Math.floor(Math.random() * (briefcaseInfo.rewards.coins.max - briefcaseInfo.rewards.coins.min + 1)) + briefcaseInfo.rewards.coins.min;
            rewards.push({ type: 'coins', amount });
        } else {
            let amount = selected.data.amount;
            if (Array.isArray(amount)) {
                amount = Math.floor(Math.random() * (amount[1] - amount[0] + 1)) + amount[0];
            }
            rewards.push({ type: 'item', item: selected.item, amount });
        }
    }
    
    return rewards;
}

function getColorForTier(tier) {
    const colors = {
        common: 0x95a5a6,
        rare: 0x3498db,
        epic: 0x9b59b6,
        legendary: 0xf1c40f
    };
    return colors[tier] || 0x95a5a6;
}
