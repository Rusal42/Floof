const fs = require('fs');
const path = require('path');

const PET_DATA_FILE = path.join(__dirname, '../../../pet-data.json');

// Pet types and their stats
const PET_TYPES = {
    cat: {
        name: 'Cat',
        emoji: '🐱',
        price: 5000,
        base_stats: { attack: 15, defense: 10, speed: 20, health: 80 },
        growth_rate: { attack: 2, defense: 1.5, speed: 2.5, health: 8 },
        favorite_foods: ['fish', 'milk', 'treats'],
        description: 'Independent and agile, cats are excellent hunters.',
        defense_message: 'The cat hisses and swipes with razor-sharp claws!'
    },
    dog: {
        name: 'Dog',
        emoji: '🐶',
        price: 4500,
        base_stats: { attack: 18, defense: 15, speed: 15, health: 100 },
        growth_rate: { attack: 2.5, defense: 2, speed: 1.5, health: 10 },
        favorite_foods: ['bone', 'treats', 'meat'],
        description: 'Loyal and strong, dogs are reliable companions.',
        defense_message: 'The dog barks fiercely and lunges to protect its owner!'
    },
    bird: {
        name: 'Bird',
        emoji: '🐦',
        price: 3000,
        base_stats: { attack: 12, defense: 8, speed: 25, health: 60 },
        growth_rate: { attack: 1.5, defense: 1, speed: 3, health: 6 },
        favorite_foods: ['seeds', 'berries', 'nectar'],
        description: 'Fast and nimble, birds excel in speed and agility.',
        defense_message: 'The bird swoops down with talons extended!'
    },
    rabbit: {
        name: 'Rabbit',
        emoji: '🐰',
        price: 2500,
        base_stats: { attack: 10, defense: 12, speed: 22, health: 70 },
        growth_rate: { attack: 1.5, defense: 1.5, speed: 2.5, health: 7 },
        favorite_foods: ['carrot', 'lettuce', 'hay'],
        description: 'Quick and cute, rabbits are great for beginners.',
        defense_message: 'The rabbit kicks with powerful hind legs!'
    },
    dragon: {
        name: 'Dragon',
        emoji: '🐉',
        price: 50000,
        base_stats: { attack: 35, defense: 30, speed: 18, health: 150 },
        growth_rate: { attack: 4, defense: 3, speed: 2, health: 15 },
        favorite_foods: ['gold', 'gems', 'magic_food'],
        defense_message: 'The dragon breathes fire and roars menacingly!',
        description: 'Legendary and powerful, dragons are the ultimate pets.'
    },
    wolf: {
        name: 'Wolf',
        emoji: '🐺',
        price: 15000,
        base_stats: { attack: 25, defense: 18, speed: 20, health: 120 },
        growth_rate: { attack: 3, defense: 2.5, speed: 2, health: 12 },
        favorite_foods: ['meat', 'bone', 'wild_berries'],
        description: 'Fierce and wild, wolves are powerful pack hunters.',
        defense_message: 'The wolf growls menacingly and bares its fangs!'
    }
};

// Pet items and their effects
const PET_ITEMS = {
    // Food items
    fish: { name: 'Fish', emoji: '🐟', price: 50, type: 'food', hunger: 30, happiness: 10, favorite_for: ['cat'] },
    milk: { name: 'Milk', emoji: '🥛', price: 25, type: 'food', hunger: 15, happiness: 5, favorite_for: ['cat'] },
    bone: { name: 'Bone', emoji: '🦴', price: 75, type: 'food', hunger: 40, happiness: 15, favorite_for: ['dog', 'wolf'] },
    meat: { name: 'Meat', emoji: '🥩', price: 100, type: 'food', hunger: 50, happiness: 20, favorite_for: ['dog', 'wolf'] },
    seeds: { name: 'Seeds', emoji: '🌱', price: 20, type: 'food', hunger: 20, happiness: 5, favorite_for: ['bird'] },
    berries: { name: 'Berries', emoji: '🫐', price: 30, type: 'food', hunger: 25, happiness: 8, favorite_for: ['bird'] },
    carrot: { name: 'Carrot', emoji: '🥕', price: 15, type: 'food', hunger: 20, happiness: 10, favorite_for: ['rabbit'] },
    treats: { name: 'Pet Treats', emoji: '🍖', price: 80, type: 'food', hunger: 35, happiness: 25, favorite_for: ['cat', 'dog'] },
    gold: { name: 'Gold Coins', emoji: '🪙', price: 500, type: 'food', hunger: 60, happiness: 40, favorite_for: ['dragon'] },
    gems: { name: 'Precious Gems', emoji: '💎', price: 1000, type: 'food', hunger: 80, happiness: 50, favorite_for: ['dragon'] },
    
    // Toys and accessories
    ball: { name: 'Ball', emoji: '⚽', price: 200, type: 'toy', happiness: 30, training_bonus: 5 },
    rope: { name: 'Rope Toy', emoji: '🪢', price: 150, type: 'toy', happiness: 25, training_bonus: 3 },
    feather: { name: 'Feather Toy', emoji: '🪶', price: 100, type: 'toy', happiness: 20, training_bonus: 8, favorite_for: ['cat', 'bird'] },
    collar: { name: 'Collar', emoji: '🦮', price: 300, type: 'accessory', defense_bonus: 5, happiness: 15 },
    crown: { name: 'Pet Crown', emoji: '👑', price: 2000, type: 'accessory', attack_bonus: 10, defense_bonus: 10, happiness: 50 },
    
    // Training items
    dumbbell: { name: 'Pet Dumbbell', emoji: '🏋️', price: 400, type: 'training', attack_training: 15 },
    shield: { name: 'Training Shield', emoji: '🛡️', price: 350, type: 'training', defense_training: 12 },
    treadmill: { name: 'Pet Treadmill', emoji: '🏃', price: 500, type: 'training', speed_training: 20 }
};

// Load pet data
function loadPetData() {
    try {
        if (fs.existsSync(PET_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(PET_DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading pet data:', error);
    }
    return {};
}

// Save pet data
function savePetData(data) {
    try {
        fs.writeFileSync(PET_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving pet data:', error);
    }
}

// Get user's pets
function getUserPets(userId) {
    const data = loadPetData();
    return data[userId] || { pets: [], active_pet: null, pet_items: {} };
}

// Save user's pets
function saveUserPets(userId, petData) {
    const data = loadPetData();
    data[userId] = petData;
    savePetData(data);
}

// Buy a pet
function buyPet(userId, petType, petName) {
    if (!PET_TYPES[petType]) {
        return { success: false, reason: 'invalid_type' };
    }

    const userData = getUserPets(userId);
    
    // Check if user already has 5 pets (limit)
    if (userData.pets.length >= 5) {
        return { success: false, reason: 'pet_limit' };
    }

    // Check if name is already taken
    if (userData.pets.some(pet => pet.name.toLowerCase() === petName.toLowerCase())) {
        return { success: false, reason: 'name_taken' };
    }

    const petInfo = PET_TYPES[petType];
    const newPet = {
        id: Date.now().toString(),
        name: petName,
        type: petType,
        level: 1,
        xp: 0,
        stats: { ...petInfo.base_stats },
        hunger: 100,
        happiness: 100,
        last_fed: Date.now(),
        last_played: Date.now(),
        battles_won: 0,
        battles_lost: 0,
        training_sessions: 0,
        accessories: [],
        created_at: Date.now()
    };

    userData.pets.push(newPet);
    
    // Set as active pet if it's the first one
    if (userData.pets.length === 1) {
        userData.active_pet = newPet.id;
    }

    saveUserPets(userId, userData);
    return { success: true, pet: newPet, cost: petInfo.price };
}

// Get pet by ID
function getPet(userId, petId) {
    const userData = getUserPets(userId);
    return userData.pets.find(pet => pet.id === petId);
}

// Get active pet
function getActivePet(userId) {
    const userData = getUserPets(userId);
    if (!userData.active_pet) return null;
    return userData.pets.find(pet => pet.id === userData.active_pet);
}

// Set active pet
function setActivePet(userId, petId) {
    const userData = getUserPets(userId);
    const pet = userData.pets.find(p => p.id === petId);
    
    if (!pet) {
        return { success: false, reason: 'pet_not_found' };
    }

    userData.active_pet = petId;
    saveUserPets(userId, userData);
    return { success: true, pet };
}

// Feed pet
function feedPet(userId, petId, foodType) {
    const userData = getUserPets(userId);
    const pet = userData.pets.find(p => p.id === petId);
    const food = PET_ITEMS[foodType];

    if (!pet || !food || food.type !== 'food') {
        return { success: false, reason: 'invalid' };
    }

    // Check if user has the food item
    if (!userData.pet_items[foodType] || userData.pet_items[foodType] < 1) {
        return { success: false, reason: 'no_food' };
    }

    // Calculate bonuses for favorite food
    let hungerBonus = food.hunger;
    let happinessBonus = food.happiness;
    
    const petInfo = PET_TYPES[pet.type];
    if (petInfo.favorite_foods.includes(foodType)) {
        hungerBonus = Math.floor(hungerBonus * 1.5);
        happinessBonus = Math.floor(happinessBonus * 1.5);
    }

    // Apply effects
    pet.hunger = Math.min(100, pet.hunger + hungerBonus);
    pet.happiness = Math.min(100, pet.happiness + happinessBonus);
    pet.last_fed = Date.now();

    // Consume food item
    userData.pet_items[foodType]--;
    if (userData.pet_items[foodType] <= 0) {
        delete userData.pet_items[foodType];
    }

    saveUserPets(userId, userData);
    return { success: true, pet, hunger_gained: hungerBonus, happiness_gained: happinessBonus };
}

// Train pet
function trainPet(userId, petId, statType) {
    const userData = getUserPets(userId);
    const pet = userData.pets.find(p => p.id === petId);

    if (!pet) {
        return { success: false, reason: 'pet_not_found' };
    }

    // Check if pet is happy enough to train (needs at least 30 happiness)
    if (pet.happiness < 30) {
        return { success: false, reason: 'unhappy' };
    }

    // Check if pet is fed enough (needs at least 20 hunger)
    if (pet.hunger < 20) {
        return { success: false, reason: 'hungry' };
    }

    const validStats = ['attack', 'defense', 'speed', 'health'];
    if (!validStats.includes(statType)) {
        return { success: false, reason: 'invalid_stat' };
    }

    const petInfo = PET_TYPES[pet.type];
    const baseGain = petInfo.growth_rate[statType];
    
    // Calculate training gain (affected by happiness)
    const happinessMultiplier = pet.happiness / 100;
    const gain = Math.floor(baseGain * happinessMultiplier * (0.8 + Math.random() * 0.4));

    // Apply training
    pet.stats[statType] += gain;
    pet.xp += 10;
    pet.happiness = Math.max(0, pet.happiness - 15);
    pet.hunger = Math.max(0, pet.hunger - 10);
    pet.training_sessions++;

    // Check for level up
    const xpNeeded = pet.level * 100;
    if (pet.xp >= xpNeeded) {
        pet.level++;
        pet.xp -= xpNeeded;
        
        // Level up stat bonus
        Object.keys(pet.stats).forEach(stat => {
            pet.stats[stat] += Math.floor(petInfo.growth_rate[stat] * 0.5);
        });
    }

    saveUserPets(userId, userData);
    return { 
        success: true, 
        pet, 
        stat_gained: gain, 
        stat_type: statType,
        leveled_up: pet.xp < 10 // If XP was reset, they leveled up
    };
}

// Buy pet item
function buyPetItem(userId, itemType, quantity = 1) {
    const item = PET_ITEMS[itemType];
    if (!item) {
        return { success: false, reason: 'invalid_item' };
    }

    const userData = getUserPets(userId);
    if (!userData.pet_items[itemType]) {
        userData.pet_items[itemType] = 0;
    }
    
    userData.pet_items[itemType] += quantity;
    saveUserPets(userId, userData);
    
    return { success: true, item, quantity, total_cost: item.price * quantity };
}

// Get pet items inventory
function getPetItems(userId) {
    const userData = getUserPets(userId);
    return userData.pet_items || {};
}

// Update pet status (hunger/happiness decay over time)
function updatePetStatus(pet) {
    const now = Date.now();
    const hoursSinceLastFed = (now - pet.last_fed) / (1000 * 60 * 60);
    const hoursSinceLastPlayed = (now - pet.last_played) / (1000 * 60 * 60);

    // Hunger decreases over time
    const hungerDecay = Math.floor(hoursSinceLastFed * 2);
    pet.hunger = Math.max(0, pet.hunger - hungerDecay);

    // Happiness decreases over time
    const happinessDecay = Math.floor(hoursSinceLastPlayed * 1.5);
    pet.happiness = Math.max(0, pet.happiness - happinessDecay);

    return pet;
}

// Check if user is AFK (no messages in last 30 minutes)
function isUserAFK(userId) {
    const data = loadPetData();
    const userData = data[userId];
    if (!userData || !userData.last_activity) return false;
    
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    return (now - userData.last_activity) > thirtyMinutes;
}

// Update user activity
function updateUserActivity(userId) {
    const data = loadPetData();
    if (!data[userId]) {
        data[userId] = { pets: [], active_pet: null, pet_items: {} };
    }
    data[userId].last_activity = Date.now();
    savePetData(data);
}

// Pet attack another user
function petAttackUser(attackerId, targetId) {
    const attackerPet = getActivePet(attackerId);
    const targetPet = getActivePet(targetId);
    
    if (!attackerPet) {
        return { success: false, reason: 'no_attacker_pet' };
    }

    // Update pet status
    updatePetStatus(attackerPet);
    
    // Check if pet is in good condition
    if (attackerPet.hunger < 30 || attackerPet.happiness < 30) {
        return { success: false, reason: 'pet_unfit', pet: attackerPet };
    }

    // Check if target is AFK and has a defending pet
    const targetIsAFK = isUserAFK(targetId);
    let defenseResult = null;
    
    if (targetIsAFK && targetPet) {
        updatePetStatus(targetPet);
        
        // Pet defends if in good condition
        if (targetPet.hunger >= 20 && targetPet.happiness >= 20) {
            defenseResult = simulatePetDefense(attackerPet, targetPet);
        }
    }

    // Calculate damage and coin steal
    const attackerStats = calculateEffectiveStats(attackerPet);
    const baseDamage = attackerStats.attack;
    const coinSteal = Math.floor(Math.random() * (baseDamage * 15)) + (baseDamage * 5);

    // Reduce pet condition from attacking
    attackerPet.hunger = Math.max(0, attackerPet.hunger - 10);
    attackerPet.happiness = Math.max(0, attackerPet.happiness - 5);
    
    const attackerData = getUserPets(attackerId);
    saveUserPets(attackerId, attackerData);

    return {
        success: true,
        attacker_pet: attackerPet,
        target_pet: targetPet,
        target_afk: targetIsAFK,
        defense_result: defenseResult,
        coin_steal: coinSteal,
        damage: baseDamage
    };
}

// Simulate pet defense against attack
function simulatePetDefense(pet, weapon, ownerId) {
    if (!pet) return { defended: false };
    
    updatePetStatus(pet);
    
    // Pet must be healthy and happy to defend effectively
    if (pet.hunger < 30 || pet.happiness < 30) {
        return { defended: false, defense_chance: 0 };
    }
    
    // Calculate defense chance based on pet stats and level
    const baseDefense = pet.stats.defense + pet.stats.speed;
    const levelBonus = pet.level * 2;
    const weaponPenalty = weapon.damage * 0.5;
    
    const defenseScore = baseDefense + levelBonus - weaponPenalty;
    const defenseChance = Math.min(0.7, Math.max(0.1, defenseScore / 100)); // 10-70% chance
    
    const defended = Math.random() < defenseChance;
    
    if (defended) {
        // Pet gains XP for successful defense
        pet.xp += 5;
        checkLevelUp(pet);
        
        // Reduce hunger and happiness slightly
        pet.hunger = Math.max(0, pet.hunger - 5);
        pet.happiness = Math.max(0, pet.happiness - 3);
        
        // Save pet data after defense
        const userData = getUserPets(ownerId);
        saveUserPets(ownerId, userData);
    }
    
    return { defended, defense_chance: Math.floor(defenseChance * 100) };
}

// Calculate effective stats based on pet condition
function calculateEffectiveStats(pet) {
    const conditionMultiplier = (pet.hunger + pet.happiness) / 200;
    
    return {
        attack: Math.floor(pet.stats.attack * conditionMultiplier),
        defense: Math.floor(pet.stats.defense * conditionMultiplier),
        speed: Math.floor(pet.stats.speed * conditionMultiplier),
        health: pet.stats.health
    };
}

// Format pet display
function formatPetDisplay(userId, petId = null) {
    const userData = getUserPets(userId);
    
    if (petId) {
        const pet = userData.pets.find(p => p.id === petId);
        if (!pet) return 'Pet not found!';
        
        updatePetStatus(pet);
        const petInfo = PET_TYPES[pet.type];
        
        let display = `${petInfo.emoji} **${pet.name}** (Level ${pet.level} ${petInfo.name})\n\n`;
        display += `**Stats:**\n`;
        display += `⚔️ Attack: ${pet.stats.attack}\n`;
        display += `🛡️ Defense: ${pet.stats.defense}\n`;
        display += `💨 Speed: ${pet.stats.speed}\n`;
        display += `❤️ Health: ${pet.stats.health}\n\n`;
        display += `**Status:**\n`;
        display += `🍽️ Hunger: ${pet.hunger}/100 ${getStatusBar(pet.hunger)}\n`;
        display += `😊 Happiness: ${pet.happiness}/100 ${getStatusBar(pet.happiness)}\n`;
        display += `⭐ XP: ${pet.xp}/${pet.level * 100}\n\n`;
        display += `**Record:**\n`;
        display += `🏆 Battles Won: ${pet.battles_won}\n`;
        display += `💔 Battles Lost: ${pet.battles_lost}\n`;
        display += `🏋️ Training Sessions: ${pet.training_sessions}`;
        
        return display;
    } else {
        if (userData.pets.length === 0) {
            return 'You don\'t have any pets yet! Use `%pet buy <type> <name>` to get your first pet.';
        }
        
        let display = `**Your Pets:**\n\n`;
        userData.pets.forEach(pet => {
            updatePetStatus(pet);
            const petInfo = PET_TYPES[pet.type];
            const isActive = pet.id === userData.active_pet ? '⭐ ' : '';
            display += `${isActive}${petInfo.emoji} **${pet.name}** (Lv.${pet.level} ${petInfo.name})\n`;
            display += `└ 🍽️${pet.hunger}/100 😊${pet.happiness}/100\n\n`;
        });
        
        if (userData.active_pet) {
            const activePet = userData.pets.find(p => p.id === userData.active_pet);
            display += `**Active Pet:** ${PET_TYPES[activePet.type].emoji} ${activePet.name}`;
        }
        
        return display;
    }
}

function getStatusBar(value) {
    const bars = Math.floor(value / 10);
    const filled = '█'.repeat(bars);
    const empty = '░'.repeat(10 - bars);
    return `${filled}${empty}`;
}

// Check if pet should level up and apply level up bonuses
function checkLevelUp(pet) {
    const xpNeeded = pet.level * 100;
    if (pet.xp >= xpNeeded) {
        pet.level++;
        pet.xp -= xpNeeded;
        
        // Level up stat bonus
        const petInfo = PET_TYPES[pet.type];
        Object.keys(pet.stats).forEach(stat => {
            pet.stats[stat] += Math.floor(petInfo.growth_rate[stat] * 0.5);
        });
        
        return true;
    }
    return false;
}

module.exports = {
    PET_TYPES,
    PET_ITEMS,
    getUserPets,
    saveUserPets,
    buyPet,
    getPet,
    getActivePet,
    setActivePet,
    feedPet,
    trainPet,
    buyPetItem,
    getPetItems,
    formatPetDisplay,
    updatePetStatus,
    isUserAFK,
    updateUserActivity,
    petAttackUser,
    simulatePetDefense,
    calculateEffectiveStats
};
