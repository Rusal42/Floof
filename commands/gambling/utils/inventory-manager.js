const fs = require('fs');
const path = require('path');

const inventoryDir = path.resolve(__dirname, '../../../data');
const INVENTORY_FILE = path.join(inventoryDir, 'inventories.json');

let userInventories = {};

// Item types and their properties
const ITEM_TYPES = {
    // Weapons
    'pistol': { type: 'weapon', damage: 25, ammo_type: 'bullets', name: 'Pistol', emoji: '🔫' },
    'rifle': { type: 'weapon', damage: 45, ammo_type: 'bullets', name: 'Rifle', emoji: '🔫' },
    'crossbow': { type: 'weapon', damage: 35, ammo_type: 'arrows', name: 'Crossbow', emoji: '🏹' },
    'flamethrower': { type: 'weapon', damage: 60, ammo_type: 'fuel', name: 'Flamethrower', emoji: '🔥' },
    'laser': { type: 'weapon', damage: 80, ammo_type: 'energy', name: 'Laser Gun', emoji: '⚡' },
    'speaker': { type: 'weapon', damage: 20, ammo_type: 'sound', name: 'Sound Blaster', emoji: '🔊' },
    
    // Ammo
    'bullets': { type: 'ammo', name: 'Bullets', emoji: '🔸' },
    'arrows': { type: 'ammo', name: 'Arrows', emoji: '➡️' },
    'fuel': { type: 'ammo', name: 'Fuel Canisters', emoji: '⛽' },
    'energy': { type: 'ammo', name: 'Energy Cells', emoji: '🔋' },
    'sound': { type: 'ammo', name: 'Sound Waves', emoji: '🌊' },
    
    // Protection
    'armor': { type: 'protection', defense: 15, name: 'Body Armor', emoji: '🛡️' },
    'helmet': { type: 'protection', defense: 8, name: 'Combat Helmet', emoji: '⛑️' },
    'shield': { type: 'protection', defense: 20, name: 'Riot Shield', emoji: '🛡️' },
    
    // Consumables
    'health_pack': { type: 'consumable', heal: 50, name: 'Health Pack', emoji: '🩹' },
    'energy_drink': { type: 'consumable', boost: 'energy', name: 'Energy Drink', emoji: '⚡' },
    'beer': { type: 'consumable', boost: 'cooldown_reset', name: 'Beer', emoji: '🍺' },
    
    // Special Items
    'briefcase': { type: 'special', name: 'Briefcase', emoji: '💼' },
    'lockpick': { type: 'tool', name: 'Lockpick', emoji: '🔓' },
    'smoke_grenade': { type: 'tool', name: 'Smoke Grenade', emoji: '💨' }
};

function loadInventories() {
    try {
        if (!fs.existsSync(inventoryDir)) {
            fs.mkdirSync(inventoryDir, { recursive: true });
        }
        if (fs.existsSync(INVENTORY_FILE)) {
            const data = fs.readFileSync(INVENTORY_FILE, 'utf8');
            userInventories = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading inventories.json:', err);
        userInventories = {};
    }
    return userInventories;
}

function saveInventories() {
    try {
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify(userInventories, null, 2));
    } catch (err) {
        console.error('Error saving inventories.json:', err);
    }
}

function getInventory(userId) {
    if (!userInventories[userId]) {
        userInventories[userId] = {
            items: {},
            equipped_weapon: null,
            equipped_protection: [],
            stats: {
                health: 100,
                max_health: 100,
                energy: 100,
                max_energy: 100
            }
        };
        saveInventories();
    }
    return userInventories[userId];
}

function addItem(userId, itemId, quantity = 1) {
    const inventory = getInventory(userId);
    if (!inventory.items[itemId]) {
        inventory.items[itemId] = 0;
    }
    inventory.items[itemId] += quantity;
    saveInventories();
    return inventory.items[itemId];
}

function removeItem(userId, itemId, quantity = 1) {
    const inventory = getInventory(userId);
    if (!inventory.items[itemId] || inventory.items[itemId] < quantity) {
        return false;
    }
    inventory.items[itemId] -= quantity;
    if (inventory.items[itemId] <= 0) {
        delete inventory.items[itemId];
    }
    saveInventories();
    return true;
}

function hasItem(userId, itemId, quantity = 1) {
    const inventory = getInventory(userId);
    return inventory.items[itemId] >= quantity;
}

function getItemCount(userId, itemId) {
    const inventory = getInventory(userId);
    return inventory.items[itemId] || 0;
}

function equipWeapon(userId, weaponId) {
    const inventory = getInventory(userId);
    if (!hasItem(userId, weaponId) || ITEM_TYPES[weaponId]?.type !== 'weapon') {
        return false;
    }
    inventory.equipped_weapon = weaponId;
    saveInventories();
    return true;
}

function getEquippedWeapon(userId) {
    const inventory = getInventory(userId);
    return inventory.equipped_weapon;
}

function equipProtection(userId, protectionId) {
    const inventory = getInventory(userId);
    if (!hasItem(userId, protectionId) || ITEM_TYPES[protectionId]?.type !== 'protection') {
        return false;
    }
    if (!inventory.equipped_protection.includes(protectionId)) {
        inventory.equipped_protection.push(protectionId);
        saveInventories();
        return true;
    }
    return false;
}

function unequipProtection(userId, protectionId) {
    const inventory = getInventory(userId);
    const index = inventory.equipped_protection.indexOf(protectionId);
    if (index > -1) {
        inventory.equipped_protection.splice(index, 1);
        saveInventories();
        return true;
    }
    return false;
}

function getEquippedProtection(userId) {
    const inventory = getInventory(userId);
    return inventory.equipped_protection || [];
}

function updateStats(userId, health = null, energy = null) {
    const inventory = getInventory(userId);
    if (health !== null) {
        inventory.stats.health = Math.max(0, Math.min(inventory.stats.max_health, health));
    }
    if (energy !== null) {
        inventory.stats.energy = Math.max(0, Math.min(inventory.stats.max_energy, energy));
    }
    saveInventories();
    return inventory.stats;
}

function getStats(userId) {
    const inventory = getInventory(userId);
    return inventory.stats;
}

function getItemInfo(itemId) {
    return ITEM_TYPES[itemId] || null;
}

function getAllItemTypes() {
    return ITEM_TYPES;
}

function formatInventoryDisplay(userId) {
    const inventory = getInventory(userId);
    const stats = inventory.stats;
    let display = `**📊 Stats:**\n❤️ Health: ${stats.health}/${stats.max_health}\n⚡ Energy: ${stats.energy}/${stats.max_energy}\n\n`;
    
    if (inventory.equipped_weapon) {
        const weaponInfo = ITEM_TYPES[inventory.equipped_weapon];
        display += `**🔫 Equipped Weapon:** ${weaponInfo.emoji} ${weaponInfo.name}\n`;
    }
    
    if (inventory.equipped_protection.length > 0) {
        display += `**🛡️ Equipped Protection:** `;
        display += inventory.equipped_protection.map(p => {
            const info = ITEM_TYPES[p];
            return `${info.emoji} ${info.name}`;
        }).join(', ') + '\n';
    }
    
    display += '\n**🎒 Inventory:**\n';
    
    const categories = {
        'Weapons': [],
        'Ammo': [],
        'Protection': [],
        'Consumables': [],
        'Tools': []
    };
    
    for (const [itemId, count] of Object.entries(inventory.items)) {
        const itemInfo = ITEM_TYPES[itemId];
        if (!itemInfo) continue;
        
        const itemDisplay = `${itemInfo.emoji} ${itemInfo.name} (${count})`;
        
        switch (itemInfo.type) {
            case 'weapon':
                categories.Weapons.push(itemDisplay);
                break;
            case 'ammo':
                categories.Ammo.push(itemDisplay);
                break;
            case 'protection':
                categories.Protection.push(itemDisplay);
                break;
            case 'consumable':
                categories.Consumables.push(itemDisplay);
                break;
            default:
                categories.Tools.push(itemDisplay);
        }
    }
    
    for (const [category, items] of Object.entries(categories)) {
        if (items.length > 0) {
            display += `\n**${category}:**\n${items.join('\n')}\n`;
        }
    }
    
    if (Object.keys(inventory.items).length === 0) {
        display += 'Your inventory is empty! Visit the shop to buy items.';
    }
    
    return display;
}

// Load inventories on startup
loadInventories();

module.exports = {
    getInventory,
    addItem,
    removeItem,
    hasItem,
    getItemCount,
    equipWeapon,
    getEquippedWeapon,
    equipProtection,
    unequipProtection,
    getEquippedProtection,
    updateStats,
    getStats,
    getItemInfo,
    getAllItemTypes,
    formatInventoryDisplay,
    saveInventories,
    loadInventories,
    ITEM_TYPES
};
