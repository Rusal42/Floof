const fs = require('fs');
const path = require('path');

const INVENTORY_FILE = path.join(__dirname, '../../../data/inventories.json');

// Load inventory data
function loadInventories() {
    try {
        if (fs.existsSync(INVENTORY_FILE)) {
            return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading inventory data:', error);
    }
    return {};
}

// Save inventory data
function saveInventories(data) {
    try {
        const dir = path.dirname(INVENTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving inventory data:', error);
    }
}

// Get user's inventory
function getUserInventory(userId) {
    const data = loadInventories();
    return data[userId] || {};
}

// Add item to user's inventory
function addItemToInventory(userId, itemId, quantity = 1) {
    const data = loadInventories();
    if (!data[userId]) {
        data[userId] = {};
    }
    
    if (!data[userId][itemId]) {
        data[userId][itemId] = 0;
    }
    
    data[userId][itemId] += quantity;
    saveInventories(data);
    
    return data[userId][itemId];
}

// Remove item from user's inventory
function removeItemFromInventory(userId, itemId, quantity = 1) {
    const data = loadInventories();
    if (!data[userId] || !data[userId][itemId]) {
        return false;
    }
    
    if (data[userId][itemId] < quantity) {
        return false;
    }
    
    data[userId][itemId] -= quantity;
    
    if (data[userId][itemId] <= 0) {
        delete data[userId][itemId];
    }
    
    saveInventories(data);
    return true;
}

// Check if user has item
function hasItem(userId, itemId, quantity = 1) {
    const data = loadInventories();
    if (!data[userId] || !data[userId][itemId]) {
        return false;
    }
    
    return data[userId][itemId] >= quantity;
}

// Get item quantity
function getItemQuantity(userId, itemId) {
    const data = loadInventories();
    if (!data[userId] || !data[userId][itemId]) {
        return 0;
    }
    
    return data[userId][itemId];
}

// Clear user's inventory
function clearInventory(userId) {
    const data = loadInventories();
    delete data[userId];
    saveInventories(data);
}

// Item definitions for the shop system
const ITEM_DEFINITIONS = {
    // Weapons
    pistol: { name: 'Pistol', emoji: '🔫', type: 'weapon', damage: 25, description: 'Basic sidearm with decent damage' },
    rifle: { name: 'Rifle', emoji: '🔫', type: 'weapon', damage: 45, description: 'High-damage long-range weapon' },
    crossbow: { name: 'Crossbow', emoji: '🏹', type: 'weapon', damage: 35, description: 'Silent and deadly projectile weapon' },
    flamethrower: { name: 'Flamethrower', emoji: '🔥', type: 'weapon', damage: 55, description: 'Area damage fire weapon' },
    laser: { name: 'Laser Gun', emoji: '⚡', type: 'weapon', damage: 65, description: 'High-tech energy weapon' },
    speaker: { name: 'Speaker', emoji: '🔊', type: 'weapon', damage: 15, description: 'Sonic weapon that stuns enemies' },
    
    // Ammunition
    bullets: { name: 'Bullets', emoji: '🔸', type: 'ammo', description: 'Standard ammunition for pistols and rifles' },
    arrows: { name: 'Arrows', emoji: '🏹', type: 'ammo', description: 'Sharp arrows for crossbows' },
    fuel: { name: 'Fuel', emoji: '⛽', type: 'ammo', description: 'Fuel canisters for flamethrowers' },
    energy: { name: 'Energy Cells', emoji: '🔋', type: 'ammo', description: 'Energy cells for laser weapons' },
    sound: { name: 'Sound Waves', emoji: '🌊', type: 'ammo', description: 'Sound waves for speakers' },
    
    // Protection
    armor: { name: 'Body Armor', emoji: '🦺', type: 'protection', defense: 25, description: 'Body armor that reduces damage' },
    helmet: { name: 'Helmet', emoji: '⛑️', type: 'protection', defense: 15, description: 'Head protection gear' },
    shield: { name: 'Riot Shield', emoji: '🛡️', type: 'protection', defense: 35, description: 'Riot shield for maximum defense' },
    
    // Consumables
    health_pack: { name: 'Health Pack', emoji: '🩹', type: 'consumable', heal: 50, description: 'Restores 50 health points' },
    energy_drink: { name: 'Energy Drink', emoji: '🥤', type: 'consumable', description: 'Boosts energy and removes fatigue' },
    beer: { name: 'Beer', emoji: '🍺', type: 'consumable', description: 'Removes all cooldowns when consumed' },
    
    // Tools
    lockpick: { name: 'Lockpick', emoji: '🔓', type: 'tool', description: 'Used for breaking into places' },
    briefcase: { name: 'Briefcase', emoji: '💼', type: 'tool', description: 'Stores and protects valuable items' },
    vault_key: { name: 'Vault Key', emoji: '🗝️', type: 'tool', description: 'Opens special vaults' }
};

// Get item information
function getItemInfo(itemId) {
    return ITEM_DEFINITIONS[itemId] || null;
}

// Get all item types
function getAllItemTypes() {
    const types = {};
    for (const [itemId, item] of Object.entries(ITEM_DEFINITIONS)) {
        if (!types[item.type]) {
            types[item.type] = [];
        }
        types[item.type].push({
            id: itemId,
            ...item
        });
    }
    return types;
}

// Add item (alias for addItemToInventory for compatibility)
function addItem(userId, itemId, quantity = 1) {
    return addItemToInventory(userId, itemId, quantity);
}

module.exports = {
    getUserInventory,
    addItemToInventory,
    removeItemFromInventory,
    hasItem,
    getItemQuantity,
    clearInventory,
    getItemInfo,
    getAllItemTypes,
    addItem,
    ITEM_DEFINITIONS
};