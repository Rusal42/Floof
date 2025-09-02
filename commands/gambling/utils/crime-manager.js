const fs = require('fs');
const path = require('path');

const CRIME_DATA_FILE = path.join(__dirname, '../../../crime-data.json');

// Bank types with different security levels and payouts
const BANKS = {
    local_credit_union: {
        name: 'Local Credit Union',
        emoji: '🏪',
        security_level: 1,
        payout: { min: 5000, max: 15000 },
        arrest_chance: 0.15,
        description: 'Small local bank with basic security'
    },
    community_bank: {
        name: 'Community Bank',
        emoji: '🏦',
        security_level: 2,
        payout: { min: 12000, max: 30000 },
        arrest_chance: 0.25,
        description: 'Mid-tier bank with moderate security'
    },
    national_bank: {
        name: 'National Bank',
        emoji: '🏛️',
        security_level: 3,
        payout: { min: 25000, max: 60000 },
        arrest_chance: 0.35,
        description: 'Major bank with advanced security systems'
    },
    federal_reserve: {
        name: 'Federal Reserve',
        emoji: '🏢',
        security_level: 4,
        payout: { min: 50000, max: 150000 },
        arrest_chance: 0.50,
        description: 'Maximum security government bank'
    }
};

// Business types for robbery
const BUSINESSES = {
    convenience_store: {
        name: 'Convenience Store',
        emoji: '🏪',
        payout: { min: 500, max: 2000 },
        arrest_chance: 0.10,
        description: 'Quick cash from a corner store'
    },
    gas_station: {
        name: 'Gas Station',
        emoji: '⛽',
        payout: { min: 800, max: 3000 },
        arrest_chance: 0.12,
        description: 'Rob the register and safe'
    },
    jewelry_store: {
        name: 'Jewelry Store',
        emoji: '💎',
        payout: { min: 8000, max: 25000 },
        arrest_chance: 0.30,
        description: 'High-value items but heavy security'
    },
    electronics_store: {
        name: 'Electronics Store',
        emoji: '📱',
        payout: { min: 3000, max: 12000 },
        arrest_chance: 0.20,
        description: 'Expensive gadgets and cash'
    },
    casino: {
        name: 'Casino',
        emoji: '🎰',
        payout: { min: 15000, max: 50000 },
        arrest_chance: 0.40,
        description: 'Massive cash reserves but armed security'
    }
};

// NPC drug dealers with different risk/reward profiles
const DRUG_DEALERS = {
    sketchy_steve: {
        name: 'Sketchy Steve',
        emoji: '🕴️',
        location: 'Dark Alley',
        arrest_chance: 0.20,
        prices: { weed: 0.8, cocaine: 0.9 }, // 20% cheaper weed, 10% cheaper cocaine
        description: 'Nervous dealer in a hoodie'
    },
    big_mike: {
        name: 'Big Mike',
        emoji: '👨‍🦲',
        location: 'Abandoned Warehouse',
        arrest_chance: 0.15,
        prices: { weed: 0.7, cocaine: 0.8, lsd: 0.9 },
        description: 'Experienced dealer with connections'
    },
    crazy_carla: {
        name: 'Crazy Carla',
        emoji: '👩‍🦳',
        location: 'Under the Bridge',
        arrest_chance: 0.30,
        prices: { weed: 0.6, cocaine: 0.7, lsd: 0.8, heroin: 0.9 },
        description: 'Unpredictable but has the best prices'
    },
    smooth_sam: {
        name: 'Smooth Sam',
        emoji: '🕺',
        location: 'Nightclub Parking Lot',
        arrest_chance: 0.10,
        prices: { weed: 0.9, cocaine: 0.95, lsd: 0.95 },
        description: 'Professional dealer, safer but pricier'
    }
};

// NPC friends who can bail you out
const NPC_FRIENDS = {
    loyal_larry: {
        name: 'Loyal Larry',
        emoji: '👨‍💼',
        bail_chance: 0.80,
        max_bail: 10000,
        friendship_required: 50,
        description: 'Your reliable business partner'
    },
    rich_rachel: {
        name: 'Rich Rachel',
        emoji: '👩‍💼',
        bail_chance: 0.60,
        max_bail: 50000,
        friendship_required: 75,
        description: 'Wealthy socialite with connections'
    },
    corrupt_cop_charlie: {
        name: 'Corrupt Cop Charlie',
        emoji: '👮‍♂️',
        bail_chance: 0.90,
        max_bail: 25000,
        friendship_required: 100,
        description: 'Police officer who owes you favors'
    }
};

// Load crime data
function loadCrimeData() {
    try {
        if (fs.existsSync(CRIME_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(CRIME_DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading crime data:', error);
    }
    return {};
}

// Save crime data
function saveCrimeData(data) {
    try {
        fs.writeFileSync(CRIME_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving crime data:', error);
    }
}

// Get user crime data
function getUserCrimeData(userId) {
    const data = loadCrimeData();
    return data[userId] || {
        crime_level: 1,
        total_crimes: 0,
        successful_crimes: 0,
        times_arrested: 0,
        npc_friendships: {},
        businesses_owned: {},
        employees: {},
        bodyguards: {},
        last_crime: 0
    };
}

// Save user crime data
function saveUserCrimeData(userId, crimeData) {
    const data = loadCrimeData();
    data[userId] = crimeData;
    saveCrimeData(data);
}

// Calculate arrest time based on crime severity and history
function calculateArrestTime(crimeType, userCrimeData) {
    let baseTime = 15; // 15 minutes base
    
    // Crime type multipliers
    const crimeMultipliers = {
        business: 1.0,
        bank: 1.5,
        drug_deal: 0.8
    };
    
    baseTime *= (crimeMultipliers[crimeType] || 1.0);
    
    // Repeat offender penalty
    const arrestHistory = userCrimeData.times_arrested || 0;
    baseTime += arrestHistory * 5; // +5 minutes per previous arrest
    
    // Random variation (±25%)
    const variation = 0.75 + (Math.random() * 0.5);
    baseTime *= variation;
    
    return Math.max(1, Math.min(5, Math.floor(baseTime))); // Minimum 1 minute, maximum 5 minutes
}

// Calculate bail amount
function calculateBailAmount(arrestTime, crimeType) {
    let baseBail = arrestTime * 100; // $100 per minute
    
    const crimeMultipliers = {
        business: 1.0,
        bank: 2.0,
        drug_deal: 0.7
    };
    
    baseBail *= (crimeMultipliers[crimeType] || 1.0);
    
    // Random variation
    const variation = 0.8 + (Math.random() * 0.4);
    return Math.floor(baseBail * variation);
}

// Attempt a crime (bank robbery or business robbery)
function attemptCrime(userId, crimeType, targetId) {
    const userCrimeData = getUserCrimeData(userId);
    let target, baseSuccessChance, basePayout;
    
    if (crimeType === 'bank') {
        target = BANKS[targetId];
        if (!target) return { success: false, reason: 'invalid_target' };
        
        baseSuccessChance = target.success_chance;
        basePayout = { min: target.min_payout, max: target.max_payout };
    } else if (crimeType === 'business') {
        target = BUSINESSES[targetId];
        if (!target) return { success: false, reason: 'invalid_target' };
        
        baseSuccessChance = target.success_chance;
        basePayout = { min: target.min_payout, max: target.max_payout };
        
        // Check if this business is owned by someone and has security
        const { canRobBusiness } = require('./business-manager');
        const { canTargetUser } = require('./user-preferences');
        const robberyCheck = canRobBusiness(target.id);
        
        // Check if business owner allows robberies
        if (robberyCheck.owner_id && !canTargetUser(robberyCheck.owner_id, 'robbery')) {
            return { 
                success: false, 
                reason: 'owner_disabled_robberies',
                owner_id: robberyCheck.owner_id
            };
        }
        
        if (!robberyCheck.can_rob && robberyCheck.has_security) {
            // Reduce success chance significantly if business has security
            baseSuccessChance = Math.max(0.1, baseSuccessChance * 0.3); // 70% reduction
        }
    } else {
        return { success: false, reason: 'invalid_crime_type' };
    }
    
    // Calculate success chance based on crime level
    const crimeLevel = userCrimeData.crime_level || 1;
    const levelBonus = Math.min(0.15, (crimeLevel - 1) * 0.01); // Max 15% bonus at level 16
    const finalSuccessChance = Math.min(0.85, baseSuccessChance + levelBonus); // Cap at 85%
    
    const success = Math.random() < finalSuccessChance;
    
    if (success) {
        // Calculate payout
        const payout = Math.floor(Math.random() * (basePayout.max - basePayout.min + 1)) + basePayout.min;
        
        // Add to user balance
        const { addBalance } = require('./balance-manager');
        addBalance(userId, payout);
        
        // Increase crime XP and level
        userCrimeData.crime_xp = (userCrimeData.crime_xp || 0) + target.xp_reward;
        const newLevel = Math.floor(userCrimeData.crime_xp / 100) + 1;
        if (newLevel > userCrimeData.crime_level) {
            userCrimeData.crime_level = newLevel;
        }
        
        // Update crime stats
        if (!userCrimeData.crimes_committed) userCrimeData.crimes_committed = {};
        userCrimeData.crimes_committed[crimeType] = (userCrimeData.crimes_committed[crimeType] || 0) + 1;
        
        saveUserCrimeData(userId, userCrimeData);
        
        return {
            success: true,
            payout,
            target,
            crime_level: userCrimeData.crime_level,
            xp_gained: target.xp_reward
        };
    } else {
        // Failed - calculate arrest time and bail
        const arrestTime = calculateArrestTime(target.min_jail_time, target.max_jail_time, userCrimeData);
        const bailAmount = calculateBailAmount(arrestTime, crimeType);
        
        // Update arrest history
        userCrimeData.arrest_history = (userCrimeData.arrest_history || 0) + 1;
        saveUserCrimeData(userId, userCrimeData);
        
        return {
            success: false,
            reason: 'arrested',
            target,
            arrest_time: arrestTime,
            bail_amount: bailAmount
        };
    }
}

// Buy drugs from NPC dealer
function buyFromDealer(userId, dealerId, drugType, quantity = 1) {
    const dealer = DRUG_DEALERS[dealerId];
    if (!dealer) return { success: false, reason: 'invalid_dealer' };
    
    const userCrimeData = getUserCrimeData(userId);
    
    // Check if dealer has the drug
    if (!dealer.prices[drugType]) {
        return { success: false, reason: 'drug_not_available' };
    }
    
    // Check if caught by police
    if (Math.random() < dealer.arrest_chance) {
        userCrimeData.times_arrested++;
        const arrestTime = calculateArrestTime('drug_deal', userCrimeData);
        const bailAmount = calculateBailAmount(arrestTime, 'drug_deal');
        
        saveUserCrimeData(userId, userCrimeData);
        
        return {
            success: false,
            reason: 'arrested',
            arrest_time: arrestTime,
            bail_amount: bailAmount,
            dealer
        };
    }
    
    // Calculate discounted price
    const { BLACKMARKET_ITEMS } = require('./blackmarket-manager');
    const baseDrug = BLACKMARKET_ITEMS[drugType];
    if (!baseDrug) return { success: false, reason: 'invalid_drug' };
    
    const discountedPrice = Math.floor(baseDrug.price.min * dealer.prices[drugType]);
    const totalCost = discountedPrice * quantity;
    
    return {
        success: true,
        dealer,
        drug: baseDrug,
        price_per_unit: discountedPrice,
        total_cost: totalCost,
        quantity
    };
}

// Attempt NPC friend bail
function attemptNPCBail(userId, bailAmount) {
    const userCrimeData = getUserCrimeData(userId);
    const friendships = userCrimeData.npc_friendships || {};
    
    // Check each friend's willingness to bail you out
    for (const [friendId, friendship] of Object.entries(friendships)) {
        const friend = NPC_FRIENDS[friendId];
        if (!friend) continue;
        
        // Check friendship level requirement
        if (friendship.level < friend.friendship_required) continue;
        
        // Check if friend can afford bail
        if (bailAmount > friend.max_bail) continue;
        
        // Check if friend is willing (random chance)
        if (Math.random() < friend.bail_chance) {
            return {
                success: true,
                friend,
                friendship_level: friendship.level
            };
        }
    }
    
    return { success: false };
}

// Arrest user with crime manager integration
function arrestUser(userId, duration, reason, bailAmount = null) {
    const { arrestUser: beatupArrest } = require('../beatup');
    
    // Calculate bail if not provided
    if (!bailAmount) {
        const userCrimeData = getUserCrimeData(userId);
        const arrestTimeMinutes = Math.ceil(duration / (60 * 1000));
        bailAmount = calculateBailAmount(arrestTimeMinutes, 'general');
    }
    
    // Use existing arrest system but store additional crime data
    beatupArrest(userId, duration, reason);
    
    // Store bail amount in arrest info
    const { arrestedUsers } = require('../beatup');
    if (arrestedUsers[userId]) {
        arrestedUsers[userId].bailAmount = bailAmount;
        arrestedUsers[userId].reason = reason;
    }
    
    return { arrested: true, duration, bailAmount, reason };
}

// Increase NPC friendship
function increaseFriendship(userId, friendId, amount = 1) {
    const userCrimeData = getUserCrimeData(userId);
    
    if (!userCrimeData.npc_friendships) {
        userCrimeData.npc_friendships = {};
    }
    
    if (!userCrimeData.npc_friendships[friendId]) {
        userCrimeData.npc_friendships[friendId] = { level: 0, interactions: 0 };
    }
    
    userCrimeData.npc_friendships[friendId].level += amount;
    userCrimeData.npc_friendships[friendId].interactions++;
    
    saveUserCrimeData(userId, userCrimeData);
    
    return userCrimeData.npc_friendships[friendId];
}

// Format crime stats display
function formatCrimeStats(userId) {
    const crimeData = getUserCrimeData(userId);
    
    let display = `**🔫 Crime Statistics:**\n\n`;
    display += `🎯 **Crime Level:** ${crimeData.crime_level}\n`;
    display += `📊 **Total Crimes:** ${crimeData.total_crimes}\n`;
    display += `✅ **Successful:** ${crimeData.successful_crimes}\n`;
    display += `🚔 **Times Arrested:** ${crimeData.times_arrested}\n`;
    
    const successRate = crimeData.total_crimes > 0 ? 
        Math.floor((crimeData.successful_crimes / crimeData.total_crimes) * 100) : 0;
    display += `📈 **Success Rate:** ${successRate}%\n\n`;
    
    // Show NPC friendships
    if (crimeData.npc_friendships && Object.keys(crimeData.npc_friendships).length > 0) {
        display += `**👥 NPC Friendships:**\n`;
        Object.entries(crimeData.npc_friendships).forEach(([friendId, friendship]) => {
            const friend = NPC_FRIENDS[friendId];
            if (friend) {
                display += `${friend.emoji} **${friend.name}:** Level ${friendship.level}\n`;
            }
        });
    }
    
    return display;
}

module.exports = {
    BANKS,
    BUSINESSES,
    DRUG_DEALERS,
    NPC_FRIENDS,
    getUserCrimeData,
    saveUserCrimeData,
    attemptCrime,
    buyFromDealer,
    attemptNPCBail,
    arrestUser,
    increaseFriendship,
    formatCrimeStats,
    calculateArrestTime,
    calculateBailAmount
};
