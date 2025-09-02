const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getInventory, getItemInfo } = require('./utils/inventory-manager');
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
    description: 'Select a weapon for attacks',
    usage: '%select weapon [number] | %sel weapon [number]',
    category: 'gambling',
    aliases: ['sel', 'choose'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        if (!args[0] || args[0].toLowerCase() !== 'weapon') {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Use `%select weapon [number]` to select a weapon for attacks.\n\nExample: `%select weapon 1`')
                        .setColor(0xff0000)
                ]
            });
        }

        const inventory = getInventory(userId);
        const weapons = [];
        
        // Find all weapons in inventory
        for (const [itemId, quantity] of Object.entries(inventory)) {
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
};

// Export functions for use in other commands
module.exports.getSelectedWeapon = getSelectedWeapon;
module.exports.setSelectedWeapon = setSelectedWeapon;
