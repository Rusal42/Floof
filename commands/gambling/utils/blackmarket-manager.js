const fs = require('fs');
const path = require('path');

const BLACKMARKET_DATA_FILE = path.join(__dirname, '../../../blackmarket-data.json');

// Blackmarket items and their effects
const BLACKMARKET_ITEMS = {
    // Drugs
    weed: {
        name: 'Cannabis',
        emoji: '🌿',
        price: { min: 800, max: 1500 },
        type: 'drug',
        effects: { luck_boost: 15, duration: 30 }, // 15% luck boost for 30 minutes
        description: 'Increases gambling luck temporarily',
        risk: 0.1 // 10% chance of getting caught
    },
    cocaine: {
        name: 'Cocaine',
        emoji: '❄️',
        price: { min: 2000, max: 4000 },
        type: 'drug',
        effects: { speed_boost: 25, cooldown_reduction: 50, duration: 20 },
        description: 'Reduces all cooldowns and increases speed',
        risk: 0.25
    },
    lsd: {
        name: 'LSD',
        emoji: '🌈',
        price: { min: 1500, max: 3000 },
        type: 'drug',
        effects: { xp_multiplier: 2, duration: 45 },
        description: 'Doubles XP gain from all activities',
        risk: 0.15
    },
    heroin: {
        name: 'Heroin',
        emoji: '💉',
        price: { min: 3000, max: 6000 },
        type: 'drug',
        effects: { damage_immunity: 50, duration: 25 },
        description: 'Reduces damage taken by 50%',
        risk: 0.35
    },
    sleeping_pills: {
        name: 'Sleeping Pills',
        emoji: '😴',
        price: { min: 500, max: 1000 },
        type: 'drug',
        effects: { sleep_protection: true, duration: 60 },
        description: 'Sleep safely for 1 hour - immune to attacks but cannot gamble',
        risk: 0.05
    },
    opioids: {
        name: 'Opioids',
        emoji: '💊',
        price: { min: 1200, max: 2500 },
        type: 'drug',
        effects: { pain_immunity: 75, attack_boost: 30, duration: 15 },
        description: 'Immune to pain, increased attack damage - inspired by %beatup',
        risk: 0.2
    },
    steroids: {
        name: 'Steroids',
        emoji: '💪',
        price: { min: 2500, max: 4500 },
        type: 'drug',
        effects: { attack_boost: 50, damage_immunity: 25, duration: 30 },
        description: 'Massive attack boost and damage reduction',
        risk: 0.3
    },
    adrenaline: {
        name: 'Adrenaline Shot',
        emoji: '⚡',
        price: { min: 1800, max: 3200 },
        type: 'drug',
        effects: { speed_boost: 40, attack_boost: 25, cooldown_reduction: 75, duration: 10 },
        description: 'Short burst of extreme combat enhancement',
        risk: 0.15
    },
    
    // Alcohol
    beer: {
        name: 'Beer',
        emoji: '🍺',
        price: { min: 200, max: 400 },
        type: 'alcohol',
        effects: { cooldown_reset: true },
        description: 'Instantly resets all command cooldowns',
        risk: 0.02
    },
    whiskey: {
        name: 'Whiskey',
        emoji: '🥃',
        price: { min: 500, max: 800 },
        type: 'alcohol',
        effects: { attack_boost: 20, duration: 60 },
        description: 'Increases attack damage by 20%',
        risk: 0.05
    },
    vodka: {
        name: 'Vodka',
        emoji: '🍸',
        price: { min: 600, max: 1000 },
        type: 'alcohol',
        effects: { defense_boost: 25, duration: 45 },
        description: 'Increases defense by 25%',
        risk: 0.05
    },
    
    // Illegal items
    counterfeit_money: {
        name: 'Counterfeit Money',
        emoji: '💵',
        price: { min: 1000, max: 2000 },
        type: 'illegal',
        effects: { fake_balance: true },
        description: 'Fake money that might fool some commands',
        risk: 0.4
    },
    stolen_goods: {
        name: 'Stolen Goods',
        emoji: '💎',
        price: { min: 1500, max: 3500 },
        type: 'illegal',
        effects: { resell_value: 1.5 },
        description: 'Hot items that can be resold for profit',
        risk: 0.3
    },
    lockpick: {
        name: 'Lockpick Set',
        emoji: '🔓',
        price: { min: 800, max: 1200 },
        type: 'tool',
        effects: { vault_break_chance: 15 },
        description: 'Attempt to break into other users\' vaults',
        risk: 0.2
    },
    
    // Special items
    fake_id: {
        name: 'Fake ID',
        emoji: '🆔',
        price: { min: 2500, max: 4000 },
        type: 'special',
        effects: { arrest_immunity: 1 },
        description: 'Protects from arrest once',
        risk: 0.15
    },
    police_scanner: {
        name: 'Police Scanner',
        emoji: '📻',
        price: { min: 1800, max: 2800 },
        type: 'tool',
        effects: { raid_warning: true, duration: 120 },
        description: 'Warns of incoming police raids',
        risk: 0.1
    },
    
    // Bodyguards for hire
    basic_bodyguard: {
        name: 'Basic Bodyguard',
        emoji: '👨‍💼',
        price: { min: 5000, max: 7000 },
        type: 'bodyguard',
        effects: { protection_level: 1, attack_reduction: 0.20 },
        description: 'Basic personal protection - reduces attack damage by 20%',
        risk: 0.05
    },
    professional_bodyguard: {
        name: 'Professional Bodyguard',
        emoji: '🕴️',
        price: { min: 15000, max: 20000 },
        type: 'bodyguard',
        effects: { protection_level: 2, attack_reduction: 0.40 },
        description: 'Experienced security professional - reduces attack damage by 40%',
        risk: 0.08
    },
    elite_bodyguard: {
        name: 'Elite Bodyguard',
        emoji: '🥷',
        price: { min: 50000, max: 70000 },
        type: 'bodyguard',
        effects: { protection_level: 3, attack_reduction: 0.60 },
        description: 'Military-trained protection specialist - reduces attack damage by 60%',
        risk: 0.12
    }
};

// Load blackmarket data
function loadBlackmarketData() {
    try {
        if (fs.existsSync(BLACKMARKET_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(BLACKMARKET_DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading blackmarket data:', error);
    }
    return {};
}

// Save blackmarket data
function saveBlackmarketData(data) {
    try {
        fs.writeFileSync(BLACKMARKET_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving blackmarket data:', error);
    }
}

// Get user's blackmarket inventory
function getUserBlackmarketItems(userId) {
    const data = loadBlackmarketData();
    return data[userId] || { items: {}, active_effects: {}, last_purchase: 0 };
}

// Save user's blackmarket data
function saveUserBlackmarketData(userId, userData) {
    const data = loadBlackmarketData();
    data[userId] = userData;
    saveBlackmarketData(data);
}

// Generate random blackmarket prices
function getRandomPrice(item) {
    return Math.floor(Math.random() * (item.price.max - item.price.min + 1)) + item.price.min;
}

// Buy blackmarket item
function buyBlackmarketItem(userId, itemId, quantity = 1) {
    const item = BLACKMARKET_ITEMS[itemId];
    if (!item) return { success: false, reason: 'invalid_item' };
    
    const { getBalance } = require('./balance-manager');
    const userBalance = getBalance(userId);
    const stock = generateBlackmarketStock();
    const stockInfo = stock[itemId];
    if (!stockInfo) return { success: false, reason: 'not_in_stock' };
    
    const totalCost = stockInfo.price * quantity;
    
    if (userBalance < totalCost) {
        return { success: false, reason: 'insufficient_funds' };
    }
    
    // Check if caught by police
    if (Math.random() < item.risk) {
        // Calculate arrest time and bail for blackmarket purchase
        const arrestTime = 1 + Math.floor(Math.random() * 4); // 1-5 minutes
        const bailAmount = Math.floor(totalCost * 2 + Math.random() * 5000); // 2x cost + random
        
        return { 
            success: false, 
            reason: 'caught',
            arrest_time: arrestTime,
            bail_amount: bailAmount
        };
    }
    
    // Add to user inventory
    const userData = getUserBlackmarketItems(userId);
    if (!userData.items[itemId]) {
        userData.items[itemId] = 0;
    }
    userData.items[itemId] += quantity;
    userData.last_purchase = Date.now();
    saveUserBlackmarketData(userId, userData);
    
    return { success: true, item, quantity, cost: totalCost };
}

// Use/consume blackmarket item
function useBlackmarketItem(userId, itemId) {
    const item = BLACKMARKET_ITEMS[itemId];
    const userData = getUserBlackmarketItems(userId);
    
    if (!item || !userData.items[itemId] || userData.items[itemId] < 1) {
        return { success: false, reason: 'no_item' };
    }

    // Consume item
    userData.items[itemId]--;
    if (userData.items[itemId] <= 0) {
        delete userData.items[itemId];
    }

    // Apply effects
    if (item.effects.duration) {
        const effectEnd = Date.now() + (item.effects.duration * 60 * 1000);
        userData.active_effects[itemId] = {
            ...item.effects,
            expires_at: effectEnd
        };
    }

    saveUserBlackmarketData(userId, userData);
    return { success: true, item, effects: item.effects };
}

// Check active effects
function getActiveEffects(userId) {
    const userData = getUserBlackmarketItems(userId);
    const now = Date.now();
    
    // Clean up expired effects
    Object.keys(userData.active_effects).forEach(effectId => {
        if (userData.active_effects[effectId].expires_at <= now) {
            delete userData.active_effects[effectId];
        }
    });
    
    saveUserBlackmarketData(userId, userData);
    return userData.active_effects;
}

// Check if user has specific effect active
function hasActiveEffect(userId, effectType) {
    const effects = getActiveEffects(userId);
    return Object.values(effects).some(effect => effect[effectType]);
}

// Check if user is sleeping (protected but cannot gamble)
function isUserSleeping(userId) {
    const effects = getActiveEffects(userId);
    return Object.values(effects).some(effect => effect.sleep_protection);
}

// Get effect multiplier
function getEffectMultiplier(userId, effectType) {
    const effects = getActiveEffects(userId);
    let multiplier = 1;
    
    Object.values(effects).forEach(effect => {
        if (effect[effectType]) {
            multiplier *= effect[effectType];
        }
    });
    
    return multiplier;
}

// Format blackmarket inventory display
function formatBlackmarketInventory(userId) {
    const userData = getUserBlackmarketItems(userId);
    
    if (Object.keys(userData.items).length === 0) {
        return 'Your blackmarket stash is empty. Visit the blackmarket to buy illegal goods!';
    }
    
    let display = '**🏴‍☠️ Your Blackmarket Stash:**\n\n';
    
    Object.entries(userData.items).forEach(([itemId, quantity]) => {
        const item = BLACKMARKET_ITEMS[itemId];
        if (item && quantity > 0) {
            display += `${item.emoji} **${item.name}** x${quantity}\n`;
            display += `└ ${item.description}\n\n`;
        }
    });
    
    // Show active effects
    const activeEffects = getActiveEffects(userId);
    if (Object.keys(activeEffects).length > 0) {
        display += '**⚡ Active Effects:**\n';
        Object.entries(activeEffects).forEach(([effectId, effect]) => {
            const item = BLACKMARKET_ITEMS[effectId];
            const timeLeft = Math.ceil((effect.expires_at - Date.now()) / 60000);
            display += `${item.emoji} ${item.name} (${timeLeft}m remaining)\n`;
        });
    }
    
    return display;
}

// Generate blackmarket stock (changes daily)
function generateBlackmarketStock() {
    const today = new Date().toDateString();
    const data = loadBlackmarketData();
    
    if (data.last_stock_update === today) {
        return data.daily_stock;
    }
    
    // Generate new stock
    const availableItems = Object.keys(BLACKMARKET_ITEMS);
    const stockSize = Math.floor(Math.random() * 4) + 4; // 4-7 items
    const stock = {};
    
    for (let i = 0; i < stockSize; i++) {
        const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
        if (!stock[randomItem]) {
            stock[randomItem] = {
                price: getRandomPrice(BLACKMARKET_ITEMS[randomItem]),
                stock: Math.floor(Math.random() * 10) + 5 // 5-14 in stock
            };
        }
    }
    
    data.last_stock_update = today;
    data.daily_stock = stock;
    saveBlackmarketData(data);
    
    return stock;
}

module.exports = {
    BLACKMARKET_ITEMS,
    getUserBlackmarketItems,
    buyBlackmarketItem,
    useBlackmarketItem,
    getActiveEffects,
    hasActiveEffect,
    isUserSleeping,
    getEffectMultiplier,
    formatBlackmarketInventory,
    generateBlackmarketStock,
    getRandomPrice
};
