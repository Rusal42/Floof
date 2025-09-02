const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { formatInventoryDisplay, equipWeapon, equipProtection, unequipProtection, getItemInfo, hasItem } = require('./utils/inventory-manager');

module.exports = {
    name: 'inventory',
    description: 'View your inventory and manage equipped items',
    usage: '%inventory [equip/unequip] [item] | %i [action] [item]',
    category: 'gambling',
    aliases: ['inv', 'items', 'bag', 'i'],
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
                        .setDescription(`🚔 You are currently under arrest! You cannot access your inventory for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Handle equip/unequip commands
        if (args.length >= 2) {
            const action = args[0].toLowerCase();
            const itemId = args[1].toLowerCase();
            
            if (action === 'equip') {
                return await handleEquip(message, userId, itemId);
            } else if (action === 'unequip') {
                return await handleUnequip(message, userId, itemId);
            }
        }

        // Display inventory
        try {
            const inventoryDisplay = formatInventoryDisplay(userId);
            
            const embed = new EmbedBuilder()
                .setTitle(`🎒 ${message.author.username}'s Inventory`)
                .setDescription(inventoryDisplay)
                .setColor(0x3498db)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Use %inventory equip <item> to equip weapons/protection' })
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });
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

async function handleEquip(message, userId, itemId) {
    const itemInfo = getItemInfo(itemId);
    
    if (!itemInfo) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid item! Check your inventory for available items.')
                    .setColor(0xff0000)
            ]
        });
    }
    
    if (!hasItem(userId, itemId)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have a ${itemInfo.name} in your inventory!`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    let success = false;
    let message_text = '';
    
    if (itemInfo.type === 'weapon') {
        success = equipWeapon(userId, itemId);
        message_text = success 
            ? `🔫 Successfully equipped **${itemInfo.name}**!`
            : `❌ Failed to equip **${itemInfo.name}**.`;
    } else if (itemInfo.type === 'protection') {
        success = equipProtection(userId, itemId);
        message_text = success 
            ? `🛡️ Successfully equipped **${itemInfo.name}**!`
            : `❌ **${itemInfo.name}** is already equipped or failed to equip.`;
    } else {
        message_text = `❌ **${itemInfo.name}** cannot be equipped.`;
    }
    
    await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setDescription(message_text)
                .setColor(success ? 0x00ff00 : 0xff0000)
        ]
    });
}

async function handleUnequip(message, userId, itemId) {
    const itemInfo = getItemInfo(itemId);
    
    if (!itemInfo) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid item!')
                    .setColor(0xff0000)
            ]
        });
    }
    
    let success = false;
    let message_text = '';
    
    if (itemInfo.type === 'weapon') {
        success = equipWeapon(userId, null);
        message_text = success 
            ? `🔫 Successfully unequipped **${itemInfo.name}**!`
            : `❌ No weapon equipped.`;
    } else if (itemInfo.type === 'protection') {
        success = unequipProtection(userId, itemId);
        message_text = success 
            ? `🛡️ Successfully unequipped **${itemInfo.name}**!`
            : `❌ **${itemInfo.name}** is not equipped.`;
    } else {
        message_text = `❌ **${itemInfo.name}** cannot be unequipped.`;
    }
    
    await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setDescription(message_text)
                .setColor(success ? 0x00ff00 : 0xff0000)
        ]
    });
}
