const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getUserInventory, getItemInfo } = require('./utils/inventory-manager');
const fs = require('fs');
const path = require('path');

// File to store selected weapons
const selectedWeaponsFile = path.join(__dirname, 'selected-weapons.json');

// Load selected weapons data
function loadSelectedWeapons() {
    try {
        if (fs.existsSync(selectedWeaponsFile)) {
            return JSON.parse(fs.readFileSync(selectedWeaponsFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading selected weapons:', error);
    }
    return {};
}

// Save selected weapons data
function saveSelectedWeapons(data) {
    try {
        fs.writeFileSync(selectedWeaponsFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving selected weapons:', error);
    }
}

// Get user's selected weapon
function getSelectedWeapon(userId) {
    const selectedWeapons = loadSelectedWeapons();
    return selectedWeapons[userId] || null;
}

// Set user's selected weapon
function setSelectedWeapon(userId, weaponId) {
    const selectedWeapons = loadSelectedWeapons();
    selectedWeapons[userId] = weaponId;
    saveSelectedWeapons(selectedWeapons);
}

module.exports = {
    name: 'select',
    description: 'Select a weapon for attacks or equip items',
    usage: '%select weapon [number] | %select [item] [number]',
    category: 'gambling',
    aliases: ['sel', 'choose', 'equip'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        if (!args[0]) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ **Usage:**\n• `%select weapon [number]` - Select weapon for attacks\n• `%select protection [number]` - Equip protection\n\n**Examples:**\n• `%select weapon 1`\n• `%select protection 2`')
                        .setColor(0xff0000)
                ]
            });
        }
        
        const itemType = args[0].toLowerCase();
        
        if (itemType === 'weapon') {
            return await handleWeaponSelection(message, userId, args);
        } else if (itemType === 'protection' || itemType === 'armor') {
            return await handleProtectionSelection(message, userId, args);
        } else {
            // Check for direct weapon/armor names
            return await handleDirectSelection(message, userId, itemType, args);
        }

    }
};

// Handle weapon selection
async function handleWeaponSelection(message, userId, args) {
    const { getInventory } = require('./utils/inventory-manager');
    const inventory = getInventory(userId);
    const weapons = [];
    
    // Find all weapons in inventory
    for (const [itemId, quantity] of Object.entries(inventory.items)) {
        const itemInfo = getItemInfo(itemId);
        if (itemInfo && itemInfo.type === 'weapon' && quantity > 0) {
            weapons.push({ id: itemId, info: itemInfo });
        }
    }
    
    if (weapons.length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You have no weapons! Visit the shop to buy some weapons first.\n\nUse `%shop` or `%s` to browse weapons.')
                    .setColor(0xff0000)
            ]
        });
    }

    // If no weapon number specified, show weapon list
    if (!args[1]) {
        let weaponList = '🗡️ **Select a weapon for attacks:**\n\n';
        weapons.forEach((weapon, index) => {
            weaponList += `**${index + 1}.** ${weapon.info.emoji} **${weapon.info.name}** - ${weapon.info.damage} damage\n`;
        });
        
        const currentSelected = getSelectedWeapon(userId);
        if (currentSelected) {
            const currentInfo = getItemInfo(currentSelected);
            weaponList += `\n🎯 **Currently Selected:** ${currentInfo.emoji} ${currentInfo.name}`;
        }
        
        weaponList += '\n\n💡 **Usage:** `%select weapon <number>`';
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(weaponList)
                    .setColor(0x4169e1)
                    .setTimestamp()
            ]
        });
    }

    // Select weapon by number
    const weaponNumber = parseInt(args[1]) - 1;
    
    if (isNaN(weaponNumber) || weaponNumber < 0 || weaponNumber >= weapons.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid weapon number! Choose a number between 1 and ${weapons.length}.\n\nUse \`%select weapon\` to see your weapons.`)
                    .setColor(0xff0000)
            ]
        });
    }

    const selectedWeapon = weapons[weaponNumber];
    setSelectedWeapon(userId, selectedWeapon.id);

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setDescription(`🎯 **Weapon Selected!**\n\n${selectedWeapon.info.emoji} **${selectedWeapon.info.name}** - ${selectedWeapon.info.damage} damage\n\nNow use \`%attack @user\` to attack with this weapon!`)
                .setColor(0x43b581)
                .setTimestamp()
        ]
    });
}

// Handle protection selection
async function handleProtectionSelection(message, userId, args) {
    const { getInventory, equipProtection, unequipProtection, getEquippedProtection } = require('./utils/inventory-manager');
    const inventory = getInventory(userId);
    const protectionItems = [];
    
    // Find all protection items in inventory
    for (const [itemId, quantity] of Object.entries(inventory.items)) {
        const itemInfo = getItemInfo(itemId);
        if (itemInfo && itemInfo.type === 'protection' && quantity > 0) {
            protectionItems.push({ id: itemId, info: itemInfo });
        }
    }
    
    if (protectionItems.length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You have no protection items! Visit the shop to buy some armor first.\n\nUse `%shop protection` to browse armor.')
                    .setColor(0xff0000)
            ]
        });
    }

    // If no item number specified, show protection list
    if (!args[1]) {
        let protectionList = '🛡️ **Select protection to equip/unequip:**\n\n';
        const equippedProtection = getEquippedProtection(userId);
        
        protectionItems.forEach((item, index) => {
            const isEquipped = equippedProtection.includes(item.id);
            const status = isEquipped ? '✅ **EQUIPPED**' : '⚪ Available';
            protectionList += `**${index + 1}.** ${item.info.emoji} **${item.info.name}** - ${item.info.defense} defense ${status}\n`;
        });
        
        protectionList += '\n\n💡 **Usage:** `%select protection <number>` to toggle equip/unequip';
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(protectionList)
                    .setColor(0x4169e1)
                    .setTimestamp()
            ]
        });
    }

    // Select protection by number
    const itemNumber = parseInt(args[1]) - 1;
    
    if (isNaN(itemNumber) || itemNumber < 0 || itemNumber >= protectionItems.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid item number! Choose a number between 1 and ${protectionItems.length}.\n\nUse \`%select protection\` to see your items.`)
                    .setColor(0xff0000)
            ]
        });
    }

    const selectedItem = protectionItems[itemNumber];
    const equippedProtection = getEquippedProtection(userId);
    const isEquipped = equippedProtection.includes(selectedItem.id);
    
    let success, message_text;
    
    if (isEquipped) {
        // Unequip the item
        success = unequipProtection(userId, selectedItem.id);
        message_text = success 
            ? `🛡️ **Unequipped:** ${selectedItem.info.emoji} ${selectedItem.info.name}`
            : `❌ Failed to unequip ${selectedItem.info.name}`;
    } else {
        // Equip the item
        success = equipProtection(userId, selectedItem.id);
        message_text = success 
            ? `🛡️ **Equipped:** ${selectedItem.info.emoji} ${selectedItem.info.name} (+${selectedItem.info.defense} defense)`
            : `❌ Failed to equip ${selectedItem.info.name}`;
    }

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setDescription(message_text)
                .setColor(success ? 0x43b581 : 0xff0000)
                .setTimestamp()
        ]
    });
}

// Handle direct item selection by name
async function handleDirectSelection(message, userId, itemName, args) {
    const { getInventory, equipProtection, unequipProtection, getEquippedProtection } = require('./utils/inventory-manager');
    const inventory = getInventory(userId);
    
    // Common weapon name mappings
    const weaponAliases = {
        'pistol': 'pistol',
        'rifle': 'rifle', 
        'laser': 'laser',
        'crossbow': 'crossbow',
        'flamethrower': 'flamethrower',
        'speaker': 'speaker'
    };
    
    // Common armor name mappings
    const armorAliases = {
        'vest': 'bulletproof_vest',
        'helmet': 'helmet',
        'shield': 'riot_shield',
        'armor': 'body_armor',
        'bulletproof': 'bulletproof_vest',
        'riot': 'riot_shield'
    };
    
    // Check if it's a weapon
    if (weaponAliases[itemName]) {
        const weaponId = weaponAliases[itemName];
        const itemInfo = getItemInfo(weaponId);
        
        if (!itemInfo || !inventory.items[weaponId] || inventory.items[weaponId] <= 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have a ${itemInfo ? itemInfo.name : itemName}! Buy one from the shop first.\n\nUse \`%shop weapons\` to browse weapons.`)
                        .setColor(0xff0000)
                ]
            });
        }
        
        setSelectedWeapon(userId, weaponId);
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`🎯 **Weapon Selected!**\n\n${itemInfo.emoji} **${itemInfo.name}** - ${itemInfo.damage} damage\n\nNow use \`%attack @user\` to attack with this weapon!`)
                    .setColor(0x43b581)
                    .setTimestamp()
            ]
        });
    }
    
    // Check if it's armor
    if (armorAliases[itemName]) {
        const armorId = armorAliases[itemName];
        const itemInfo = getItemInfo(armorId);
        
        if (!itemInfo || !inventory.items[armorId] || inventory.items[armorId] <= 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have ${itemInfo ? itemInfo.name : itemName}! Buy it from the shop first.\n\nUse \`%shop protection\` to browse armor.`)
                        .setColor(0xff0000)
                ]
            });
        }
        
        const equippedProtection = getEquippedProtection(userId);
        const isEquipped = equippedProtection.includes(armorId);
        
        let success, message_text;
        
        if (isEquipped) {
            success = unequipProtection(userId, armorId);
            message_text = success 
                ? `🛡️ **Unequipped:** ${itemInfo.emoji} ${itemInfo.name}`
                : `❌ Failed to unequip ${itemInfo.name}`;
        } else {
            success = equipProtection(userId, armorId);
            message_text = success 
                ? `🛡️ **Equipped:** ${itemInfo.emoji} ${itemInfo.name} (+${itemInfo.defense} defense)`
                : `❌ Failed to equip ${itemInfo.name}`;
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(message_text)
                    .setColor(success ? 0x43b581 : 0xff0000)
                    .setTimestamp()
            ]
        });
    }
    
    // If not found, show error
    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setDescription('❌ Invalid item! Use `weapon` or `protection` for categories, or try:\n\n**Weapons:** pistol, rifle, laser, crossbow, flamethrower, speaker\n**Armor:** vest, helmet, shield, armor\n\n**Examples:**\n• `%select laser`\n• `%select vest`')
                .setColor(0xff0000)
        ]
    });
}

// Export functions for use in other commands
module.exports.getSelectedWeapon = getSelectedWeapon;
module.exports.setSelectedWeapon = setSelectedWeapon;
