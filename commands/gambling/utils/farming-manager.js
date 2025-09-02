const fs = require('fs');
const path = require('path');

const FARMING_DATA_FILE = path.join(__dirname, '../../../farming-data.json');

// Crop types and their properties
const CROP_TYPES = {
    cannabis: {
        name: 'Cannabis',
        emoji: '🌿',
        seed_price: 500,
        grow_time: 120, // 2 hours in minutes
        base_yield: { min: 2, max: 5 },
        sell_price: { min: 800, max: 1500 },
        xp_reward: 25,
        description: 'High-value illegal crop',
        risk: 0.15, // 15% chance of police raid
        water_interval: 30 // needs water every 30 minutes
    },
    opium: {
        name: 'Opium Poppy',
        emoji: '🌺',
        seed_price: 800,
        grow_time: 180, // 3 hours
        base_yield: { min: 1, max: 3 },
        sell_price: { min: 2000, max: 4000 },
        xp_reward: 40,
        description: 'Extremely valuable but very risky',
        risk: 0.25,
        water_interval: 45
    },
    tobacco: {
        name: 'Tobacco',
        emoji: '🚬',
        seed_price: 300,
        grow_time: 90, // 1.5 hours
        base_yield: { min: 3, max: 6 },
        sell_price: { min: 400, max: 800 },
        xp_reward: 15,
        description: 'Legal but regulated crop',
        risk: 0.05,
        water_interval: 25
    },
    cotton: {
        name: 'Cotton',
        emoji: '☁️',
        seed_price: 200,
        grow_time: 60, // 1 hour
        base_yield: { min: 4, max: 8 },
        sell_price: { min: 250, max: 500 },
        xp_reward: 10,
        description: 'Safe legal crop with steady profits',
        risk: 0,
        water_interval: 20
    },
    linen: {
        name: 'Flax (Linen)',
        emoji: '🌾',
        seed_price: 250,
        grow_time: 75, // 1.25 hours
        base_yield: { min: 3, max: 7 },
        sell_price: { min: 350, max: 700 },
        xp_reward: 12,
        description: 'Textile crop with good returns',
        risk: 0,
        water_interval: 22
    },
    corn: {
        name: 'Corn',
        emoji: '🌽',
        seed_price: 150,
        grow_time: 45, // 45 minutes
        base_yield: { min: 5, max: 10 },
        sell_price: { min: 180, max: 350 },
        xp_reward: 8,
        description: 'Fast-growing staple crop',
        risk: 0,
        water_interval: 15
    }
};

// Farm equipment and upgrades
const FARM_EQUIPMENT = {
    basic_plot: {
        name: 'Basic Farm Plot',
        emoji: '🟫',
        price: 0,
        max_crops: 1,
        description: 'A small patch of land'
    },
    small_farm: {
        name: 'Small Farm',
        emoji: '🚜',
        price: 5000,
        max_crops: 3,
        description: 'Expanded farming operation'
    },
    large_farm: {
        name: 'Large Farm',
        emoji: '🏭',
        price: 15000,
        max_crops: 6,
        description: 'Industrial farming facility'
    },
    mega_farm: {
        name: 'Mega Farm',
        emoji: '🏗️',
        price: 50000,
        max_crops: 12,
        description: 'Massive agricultural empire'
    },
    
    // Equipment
    sprinkler: {
        name: 'Sprinkler System',
        emoji: '💧',
        price: 2000,
        effect: 'auto_water',
        description: 'Automatically waters crops'
    },
    fertilizer: {
        name: 'Premium Fertilizer',
        emoji: '🧪',
        price: 800,
        effect: 'growth_boost',
        boost: 0.25, // 25% faster growth
        description: 'Speeds up crop growth by 25%'
    },
    greenhouse: {
        name: 'Greenhouse',
        emoji: '🏠',
        price: 10000,
        effect: 'weather_protection',
        description: 'Protects crops from weather events'
    },
    security_system: {
        name: 'Security System',
        emoji: '📹',
        price: 8000,
        effect: 'theft_protection',
        description: 'Reduces chance of crop theft'
    }
};

// Load farming data
function loadFarmingData() {
    try {
        if (fs.existsSync(FARMING_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(FARMING_DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading farming data:', error);
    }
    return {};
}

// Save farming data
function saveFarmingData(data) {
    try {
        fs.writeFileSync(FARMING_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving farming data:', error);
    }
}

// Get user's farm data
function getUserFarmData(userId) {
    const data = loadFarmingData();
    return data[userId] || {
        farm_level: 'basic_plot',
        crops: {},
        equipment: [],
        farming_xp: 0,
        total_harvests: 0,
        last_water: 0
    };
}

// Save user's farm data
function saveUserFarmData(userId, farmData) {
    const data = loadFarmingData();
    data[userId] = farmData;
    saveFarmingData(data);
}

// Plant a crop
function plantCrop(userId, cropType, plotId = 1) {
    const crop = CROP_TYPES[cropType];
    if (!crop) {
        return { success: false, reason: 'invalid_crop' };
    }

    const farmData = getUserFarmData(userId);
    const farmLevel = FARM_EQUIPMENT[farmData.farm_level];
    
    // Check if plot is available
    if (plotId > farmLevel.max_crops) {
        return { success: false, reason: 'no_plot' };
    }

    // Check if plot is occupied
    if (farmData.crops[plotId] && farmData.crops[plotId].status !== 'harvested') {
        return { success: false, reason: 'plot_occupied' };
    }

    const now = Date.now();
    let growTime = crop.grow_time * 60 * 1000; // Convert to milliseconds
    
    // Apply fertilizer boost if available
    if (farmData.equipment.includes('fertilizer')) {
        growTime *= (1 - FARM_EQUIPMENT.fertilizer.boost);
    }

    farmData.crops[plotId] = {
        type: cropType,
        planted_at: now,
        ready_at: now + growTime,
        last_watered: now,
        status: 'growing',
        health: 100
    };

    saveUserFarmData(userId, farmData);
    return { success: true, crop, plot: plotId, ready_time: growTime };
}

// Water crops
function waterCrops(userId) {
    const farmData = getUserFarmData(userId);
    const now = Date.now();
    let wateredCount = 0;

    Object.keys(farmData.crops).forEach(plotId => {
        const crop = farmData.crops[plotId];
        if (crop.status === 'growing') {
            crop.last_watered = now;
            crop.health = Math.min(100, crop.health + 10);
            wateredCount++;
        }
    });

    farmData.last_water = now;
    saveUserFarmData(userId, farmData);
    return { watered: wateredCount };
}

// Check crop status and update health
function updateCropStatus(userId) {
    const farmData = getUserFarmData(userId);
    const now = Date.now();
    let updates = [];

    Object.keys(farmData.crops).forEach(plotId => {
        const crop = farmData.crops[plotId];
        const cropType = CROP_TYPES[crop.type];
        
        if (crop.status === 'growing') {
            // Check if ready to harvest
            if (now >= crop.ready_at) {
                crop.status = 'ready';
                updates.push({ plot: plotId, type: 'ready', crop: cropType });
            } else {
                // Check water status
                const timeSinceWater = (now - crop.last_watered) / (60 * 1000); // minutes
                if (timeSinceWater > cropType.water_interval) {
                    const healthLoss = Math.floor(timeSinceWater / cropType.water_interval) * 5;
                    crop.health = Math.max(0, crop.health - healthLoss);
                    
                    if (crop.health <= 0) {
                        crop.status = 'dead';
                        updates.push({ plot: plotId, type: 'died', crop: cropType });
                    } else if (crop.health <= 30) {
                        updates.push({ plot: plotId, type: 'wilting', crop: cropType });
                    }
                }
            }
        }
    });

    saveUserFarmData(userId, farmData);
    return updates;
}

// Harvest crops
function harvestCrop(userId, plotId) {
    const farmData = getUserFarmData(userId);
    const crop = farmData.crops[plotId];
    
    if (!crop || crop.status !== 'ready') {
        return { success: false, reason: 'not_ready' };
    }

    const cropType = CROP_TYPES[crop.type];
    
    // Calculate yield based on health
    const healthMultiplier = crop.health / 100;
    const baseYield = Math.floor(Math.random() * (cropType.base_yield.max - cropType.base_yield.min + 1)) + cropType.base_yield.min;
    const actualYield = Math.max(1, Math.floor(baseYield * healthMultiplier));
    
    // Calculate sell value
    const pricePerUnit = Math.floor(Math.random() * (cropType.sell_price.max - cropType.sell_price.min + 1)) + cropType.sell_price.min;
    const totalValue = actualYield * pricePerUnit;
    
    // Add to farming XP
    farmData.farming_xp += cropType.xp_reward;
    farmData.total_harvests++;
    
    // Clear the plot
    delete farmData.crops[plotId];
    
    saveUserFarmData(userId, farmData);
    
    return {
        success: true,
        crop: cropType,
        yield: actualYield,
        value: totalValue,
        xp_gained: cropType.xp_reward,
        health: crop.health
    };
}

// Get farming level
function getFarmingLevel(userId) {
    const farmData = getUserFarmData(userId);
    const xp = farmData.farming_xp;
    
    if (xp >= 10000) return { level: 5, name: 'Agricultural Tycoon', next_xp: null };
    if (xp >= 5000) return { level: 4, name: 'Master Farmer', next_xp: 10000 };
    if (xp >= 2000) return { level: 3, name: 'Experienced Farmer', next_xp: 5000 };
    if (xp >= 500) return { level: 2, name: 'Novice Farmer', next_xp: 2000 };
    return { level: 1, name: 'Beginner Farmer', next_xp: 500 };
}

// Buy farm equipment
function buyFarmEquipment(userId, equipmentId) {
    const equipment = FARM_EQUIPMENT[equipmentId];
    if (!equipment) {
        return { success: false, reason: 'invalid_equipment' };
    }

    const farmData = getUserFarmData(userId);
    
    // Check if upgrading farm
    if (['basic_plot', 'small_farm', 'large_farm', 'mega_farm'].includes(equipmentId)) {
        farmData.farm_level = equipmentId;
    } else {
        // Adding equipment
        if (!farmData.equipment.includes(equipmentId)) {
            farmData.equipment.push(equipmentId);
        } else {
            return { success: false, reason: 'already_owned' };
        }
    }

    saveUserFarmData(userId, farmData);
    return { success: true, equipment, price: equipment.price };
}

// Format farm display
function formatFarmDisplay(userId) {
    const farmData = getUserFarmData(userId);
    const farmLevel = FARM_EQUIPMENT[farmData.farm_level];
    const level = getFarmingLevel(userId);
    
    let display = `**🚜 ${farmLevel.name}**\n`;
    display += `📊 **Level ${level.level}:** ${level.name}\n`;
    display += `⭐ **XP:** ${farmData.farming_xp.toLocaleString()}`;
    if (level.next_xp) {
        display += ` / ${level.next_xp.toLocaleString()}`;
    }
    display += `\n🌾 **Total Harvests:** ${farmData.total_harvests}\n\n`;
    
    // Show plots
    display += '**🌱 Your Plots:**\n';
    for (let i = 1; i <= farmLevel.max_crops; i++) {
        const crop = farmData.crops[i];
        if (!crop) {
            display += `**Plot ${i}:** 🟫 Empty\n`;
        } else {
            const cropType = CROP_TYPES[crop.type];
            const now = Date.now();
            
            if (crop.status === 'ready') {
                display += `**Plot ${i}:** ${cropType.emoji} **${cropType.name}** - ✅ Ready to harvest!\n`;
            } else if (crop.status === 'dead') {
                display += `**Plot ${i}:** 💀 **Dead ${cropType.name}** - Clear plot to replant\n`;
            } else {
                const timeLeft = Math.ceil((crop.ready_at - now) / (60 * 1000));
                const healthIcon = crop.health > 70 ? '💚' : crop.health > 30 ? '💛' : '❤️';
                display += `**Plot ${i}:** ${cropType.emoji} **${cropType.name}** - ${timeLeft}m left ${healthIcon}\n`;
            }
        }
    }
    
    // Show equipment
    if (farmData.equipment.length > 0) {
        display += '\n**🔧 Equipment:**\n';
        farmData.equipment.forEach(equipId => {
            const equip = FARM_EQUIPMENT[equipId];
            display += `${equip.emoji} ${equip.name}\n`;
        });
    }
    
    return display;
}

// Check for police raids
function checkPoliceRaid(userId) {
    const farmData = getUserFarmData(userId);
    const illegalCrops = Object.values(farmData.crops).filter(crop => 
        crop.status === 'growing' && CROP_TYPES[crop.type].risk > 0
    );
    
    if (illegalCrops.length === 0) return { raided: false };
    
    // Calculate raid chance based on illegal crops
    let totalRisk = 0;
    illegalCrops.forEach(crop => {
        totalRisk += CROP_TYPES[crop.type].risk;
    });
    
    // Security system reduces risk
    if (farmData.equipment.includes('security_system')) {
        totalRisk *= 0.5;
    }
    
    const raided = Math.random() < totalRisk;
    
    if (raided) {
        // Destroy all illegal crops
        Object.keys(farmData.crops).forEach(plotId => {
            const crop = farmData.crops[plotId];
            if (CROP_TYPES[crop.type].risk > 0) {
                delete farmData.crops[plotId];
            }
        });
        
        // Calculate arrest time and bail for illegal farming
        const arrestTime = Math.min(5, 2 + (illegalCrops.length * 1)); // 2-5 minutes max based on crop count
        const bailAmount = 5000 + (illegalCrops.length * 2000); // 5k-25k based on crop count
        
        saveUserFarmData(userId, farmData);
        return { 
            raided: true, 
            crops_destroyed: illegalCrops.length,
            arrest_time: arrestTime,
            bail_amount: bailAmount
        };
    }
    
    return { raided: false };
}

// Clear dead crops
function clearPlot(userId, plotId) {
    const farmData = getUserFarmData(userId);
    const crop = farmData.crops[plotId];
    
    if (!crop) {
        return { success: false, reason: 'no_crop' };
    }
    
    delete farmData.crops[plotId];
    saveUserFarmData(userId, farmData);
    
    return { success: true, crop_type: CROP_TYPES[crop.type] };
}

// Get market prices (fluctuate daily)
function getMarketPrices() {
    const today = new Date().toDateString();
    const data = loadFarmingData();
    
    if (data.market_update === today && data.market_prices) {
        return data.market_prices;
    }
    
    // Generate new market prices
    const prices = {};
    Object.keys(CROP_TYPES).forEach(cropId => {
        const crop = CROP_TYPES[cropId];
        const fluctuation = 0.8 + (Math.random() * 0.4); // 80% - 120% of base price
        prices[cropId] = {
            min: Math.floor(crop.sell_price.min * fluctuation),
            max: Math.floor(crop.sell_price.max * fluctuation)
        };
    });
    
    data.market_update = today;
    data.market_prices = prices;
    saveFarmingData(data);
    
    return prices;
}

module.exports = {
    CROP_TYPES,
    FARM_EQUIPMENT,
    getUserFarmData,
    plantCrop,
    waterCrops,
    updateCropStatus,
    harvestCrop,
    getFarmingLevel,
    buyFarmEquipment,
    formatFarmDisplay,
    checkPoliceRaid,
    clearPlot,
    getMarketPrices
};
