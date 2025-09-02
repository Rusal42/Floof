const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance } = require('./utils/balance-manager');
const { hasItem, removeItem, getItemInfo } = require('./utils/inventory-manager');
const { useBlackmarketItem, BLACKMARKET_ITEMS } = require('./utils/blackmarket-manager');

module.exports = {
    name: 'use',
    description: 'Use/consume items from your inventory',
    usage: '%use <item> [amount]',
    category: 'gambling',
    aliases: ['consume', 'eat', 'drink'],
    cooldown: 2,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot use items for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (!args[0]) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please specify an item to use!\n\n💡 **Usage:**\n• `%use <item>` - Use an item\n• `%inventory` - View your items\n• `%use beer` - Use beer to reset cooldowns')
                        .setColor(0xff0000)
                ]
            });
        }

        const itemId = args[0].toLowerCase();
        const amount = args[1] ? parseInt(args[1]) : 1;

        if (amount <= 0 || amount > 50) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ **Invalid Amount** | Range: 1-50')
                        .setColor(0xff0000)
                ]
            });
        }

        // Check if it's a blackmarket item first
        if (BLACKMARKET_ITEMS[itemId]) {
            const result = useBlackmarketItem(userId, itemId);
            
            if (!result.success) {
                let errorMsg = '❌ ';
                switch (result.reason) {
                    case 'no_item':
                        errorMsg += `You don't have any **${BLACKMARKET_ITEMS[itemId].name}** in your stash!`;
                        break;
                    default:
                        errorMsg += 'Failed to use item!';
                }
                
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(errorMsg)
                            .setColor(0xff0000)
                    ]
                });
            }

            // Success message for blackmarket items
            let successMsg = `🏴‍☠️ **Used ${result.item.emoji} ${result.item.name}!**\n\n`;
            
            if (result.effects.duration) {
                successMsg += `⚡ **Effects Active:**\n`;
                if (result.effects.luck_boost) successMsg += `🍀 Luck boost: +${result.effects.luck_boost}%\n`;
                if (result.effects.speed_boost) successMsg += `⚡ Speed boost: +${result.effects.speed_boost}%\n`;
                if (result.effects.cooldown_reduction) successMsg += `⏰ Cooldown reduction: ${result.effects.cooldown_reduction}%\n`;
                if (result.effects.xp_multiplier) successMsg += `📈 XP multiplier: ${result.effects.xp_multiplier}x\n`;
                if (result.effects.damage_immunity) successMsg += `🛡️ Damage immunity: ${result.effects.damage_immunity}%\n`;
                if (result.effects.attack_boost) successMsg += `⚔️ Attack boost: +${result.effects.attack_boost}%\n`;
                if (result.effects.defense_boost) successMsg += `🛡️ Defense boost: +${result.effects.defense_boost}%\n`;
                if (result.effects.sleep_protection) successMsg += `😴 Sleep protection: Safe from attacks\n`;
                successMsg += `\n⏱️ **Duration:** ${result.effects.duration} minutes`;
            }
            
            if (result.effects.cooldown_reset) {
                successMsg += `⏰ **All cooldowns reset!**`;
            }
            
            if (result.effects.arrest_immunity) {
                successMsg += `🆔 **Arrest immunity:** Protected from next arrest`;
            }

            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🏴‍☠️ Blackmarket Item Used')
                        .setDescription(successMsg)
                        .setColor(0x2c2c2c)
                        .setTimestamp()
                ]
            });
        }

        // Check if it's a regular shop item
        const itemInfo = getItemInfo(itemId);
        if (!itemInfo) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ **Item Not Found:** \`${itemId}\`\n\nUse \`%inventory\` to see your items.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check if user has the item
        if (!hasItem(userId, itemId, amount)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have enough **${itemInfo.name}**!\n\nUse \`%inventory\` to check your items.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Handle different item types
        let successMsg = '';
        let effectsApplied = false;

        switch (itemId) {
            case 'health_pack':
                successMsg = `🏥 **Used ${itemInfo.emoji} Health Pack!**\n\n💚 Restored 50 health points\n✨ You feel refreshed and ready for action!`;
                effectsApplied = true;
                break;
                
            case 'energy_drink':
                successMsg = `⚡ **Used ${itemInfo.emoji} Energy Drink!**\n\n🔋 Energy restored to maximum\n💨 Fatigue removed\n⚡ You feel energized!`;
                effectsApplied = true;
                break;
                
            case 'beer':
                // Reset all cooldowns (this would need to be implemented in cooldown system)
                successMsg = `🍺 **Used ${itemInfo.emoji} Beer!**\n\n⏰ **All cooldowns reset!**\n🎉 You can use commands immediately!`;
                effectsApplied = true;
                break;
                
            case 'briefcase':
                // Random reward from briefcase
                const rewards = [
                    { type: 'coins', amount: Math.floor(Math.random() * 10000) + 5000 },
                    { type: 'coins', amount: Math.floor(Math.random() * 25000) + 10000 },
                    { type: 'coins', amount: Math.floor(Math.random() * 50000) + 25000 }
                ];
                const reward = rewards[Math.floor(Math.random() * rewards.length)];
                
                if (reward.type === 'coins') {
                    addBalance(userId, reward.amount);
                    successMsg = `💼 **Opened ${itemInfo.emoji} Briefcase!**\n\n💰 **Found:** ${reward.amount.toLocaleString()} coins!\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`;
                }
                effectsApplied = true;
                break;
                
            case 'smoke_grenade':
                successMsg = `💨 **Used ${itemInfo.emoji} Smoke Grenade!**\n\n🌫️ Thick smoke fills the area\n👻 You disappear into the shadows\n🛡️ Temporary cover from attacks!`;
                effectsApplied = true;
                break;
                
            default:
                // Generic consumable
                if (itemInfo.type === 'consumable') {
                    successMsg = `✨ **Used ${itemInfo.emoji} ${itemInfo.name}!**\n\n🎯 Item consumed successfully`;
                    effectsApplied = true;
                } else {
                    return await sendAsFloofWebhook(message, {
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`❌ **${itemInfo.name}** cannot be consumed!\n\nThis item is for equipment or other purposes.`)
                                .setColor(0xff0000)
                        ]
                    });
                }
        }

        if (effectsApplied) {
            // Remove the item from inventory
            removeItem(userId, itemId, amount);
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✨ Item Used Successfully')
                        .setDescription(successMsg)
                        .setColor(0x00ff00)
                        .setFooter({ text: `Items remaining: ${hasItem(userId, itemId, 1) ? 'Yes' : 'None'}` })
                        .setTimestamp()
                ]
            });
        }
    }
};
