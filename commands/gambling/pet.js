const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    PET_TYPES, 
    PET_ITEMS, 
    getUserPets, 
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
    updateUserActivity
} = require('./utils/pet-manager');

// Pet hunting cooldowns
const huntingCooldowns = {};

module.exports = {
    name: 'pet',
    description: 'Manage your virtual pets - buy, feed, train, hunt, and defend!',
    usage: '%pet [buy/feed/train/hunt/info] [options]',
    category: 'gambling',
    aliases: ['pets', 'animal'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Update user activity for pet system
        updateUserActivity(userId);
        
        if (args.length === 0) {
            return await displayPetList(message, userId);
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'buy':
            case 'purchase':
                return await handleBuyPet(message, userId, args.slice(1));
            case 'feed':
                return await handleFeedPet(message, userId, args.slice(1));
            case 'train':
            case 'training':
                return await handleTrainPet(message, userId, args.slice(1));
            case 'hunt':
            case 'hunting':
                return await handlePetHunt(message, userId);
            case 'info':
            case 'stats':
                return await handlePetInfo(message, userId, args.slice(1));
            case 'switch':
            case 'active':
                return await handleSwitchPet(message, userId, args.slice(1));
            case 'types':
            case 'list':
                return await displayPetTypes(message);
            default:
                return await displayPetList(message, userId);
        }
    }
};

async function displayPetList(message, userId) {
    const userData = getUserPets(userId);
    const userBalance = getBalance(userId);
    
    if (userData.pets.length === 0) {
        let description = `**💰 Balance:** ${userBalance.toLocaleString()} coins\n\n`;
        description += `**🐾 Your Pet Collection:**\n`;
        description += `❌ **No pets owned**\n\n`;
        description += `**💡 Get Started:**\n`;
        description += `• Use \`%pet types\` to see available pets\n`;
        description += `• Use \`%pet buy <type> <name>\` to adopt your first pet\n`;
        description += `• Example: \`%pet buy cat Fluffy\``;

        const embed = new EmbedBuilder()
            .setTitle(`🐾 ${message.author.username}'s Pet Collection`)
            .setDescription(description)
            .setColor(0xe91e63)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }

    let description = `**💰 Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**🐾 Your Pet Collection:**\n\n`;
    
    userData.pets.forEach((pet, index) => {
        updatePetStatus(pet);
        const petInfo = PET_TYPES[pet.type];
        const isActive = pet.id === userData.active_pet ? '⭐ **ACTIVE**' : '';
        const healthBar = getStatusBar(pet.hunger);
        const happinessBar = getStatusBar(pet.happiness);
        
        description += `**${index + 1}.** ${petInfo.emoji} **${pet.name}** ${isActive}\n`;
        description += `└ 📊 **Level ${pet.level}** ${petInfo.name} • XP: ${pet.xp}/${pet.level * 100}\n`;
        description += `└ 🍽️ Hunger: ${pet.hunger}/100 ${healthBar}\n`;
        description += `└ 😊 Happy: ${pet.happiness}/100 ${happinessBar}\n`;
        description += `└ ⚔️ ${pet.stats.attack} ATK • 🛡️ ${pet.stats.defense} DEF • 💨 ${pet.stats.speed} SPD\n\n`;
    });
    
    description += `**📋 Commands:**\n`;
    description += `• \`%pet feed <food>\` - Feed active pet\n`;
    description += `• \`%pet train <stat>\` - Train active pet\n`;
    description += `• \`%pet hunt\` - Send pet hunting for loot\n`;
    description += `• \`%pet switch <name>\` - Change active pet`;

    const embed = new EmbedBuilder()
        .setTitle(`🐾 ${message.author.username}'s Pet Collection`)
        .setDescription(description)
        .setColor(0xe91e63)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleBuyPet(message, userId, args) {
    if (args.length < 2) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify pet type and name!\nExample: `%pet buy cat Fluffy`\nUse `%pet types` to see available pets.')
                    .setColor(0xff0000)
            ]
        });
    }

    const petType = args[0].toLowerCase();
    const petName = args.slice(1).join(' ');
    
    if (!PET_TYPES[petType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid pet type! Use `%pet types` to see available pets.')
                    .setColor(0xff0000)
            ]
        });
    }

    const petInfo = PET_TYPES[petType];
    const userBalance = getBalance(userId);
    
    if (userBalance < petInfo.price) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You need **${petInfo.price.toLocaleString()}** coins to buy a ${petInfo.name}!\nYou have **${userBalance.toLocaleString()}** coins.`)
                    .setColor(0xff0000)
            ]
        });
    }

    const result = buyPet(userId, petType, petName);
    
    if (!result.success) {
        let errorMsg = '';
        switch (result.reason) {
            case 'pet_limit':
                errorMsg = '❌ You can only have 5 pets maximum!';
                break;
            case 'name_taken':
                errorMsg = '❌ You already have a pet with that name!';
                break;
            default:
                errorMsg = '❌ Failed to buy pet.';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    subtractBalance(userId, result.cost);
    
    const embed = new EmbedBuilder()
        .setTitle('🎉 Pet Adopted!')
        .setDescription(`You've successfully adopted **${result.pet.name}** the ${petInfo.emoji} ${petInfo.name}!\n\n**Stats:**\n⚔️ Attack: ${result.pet.stats.attack}\n🛡️ Defense: ${result.pet.stats.defense}\n💨 Speed: ${result.pet.stats.speed}\n❤️ Health: ${result.pet.stats.health}\n\n💰 **Cost:** ${result.cost.toLocaleString()} coins\n💳 **Remaining Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handlePetHunt(message, userId) {
    const activePet = getActivePet(userId);
    
    if (!activePet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You need an active pet to hunt! Use `%pet buy` to get a pet first.')
                    .setColor(0xff0000)
            ]
        });
    }

    // Check cooldown
    const now = Date.now();
    const lastHunt = huntingCooldowns[userId];
    if (lastHunt && now - lastHunt < 1800000) { // 30 minute cooldown
        const remaining = Math.ceil((1800000 - (now - lastHunt)) / 60000);
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`⏰ ${activePet.name} is still resting from the last hunt! Wait **${remaining}** more minutes.`)
                    .setColor(0xffa500)
            ]
        });
    }

    updatePetStatus(activePet);
    
    // Check if pet is in good condition to hunt
    if (activePet.hunger < 40) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`🍽️ ${activePet.name} is too hungry to hunt! Feed your pet first. (Needs 40+ hunger)`)
                    .setColor(0xff0000)
            ]
        });
    }

    if (activePet.happiness < 30) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`😢 ${activePet.name} is too sad to hunt! Play with your pet first. (Needs 30+ happiness)`)
                    .setColor(0xff0000)
            ]
        });
    }

    huntingCooldowns[userId] = now;
    
    // Calculate hunting success based on pet stats
    const petInfo = PET_TYPES[activePet.type];
    const huntingPower = activePet.stats.speed + activePet.stats.attack + (activePet.level * 5);
    const successChance = Math.min(0.85, Math.max(0.4, huntingPower / 100));
    
    const huntSuccess = Math.random() < successChance;
    
    // Reduce pet condition from hunting
    activePet.hunger = Math.max(0, activePet.hunger - 20);
    activePet.happiness = Math.max(0, activePet.happiness - 10);
    activePet.xp += 8;
    
    // Check for level up
    const xpNeeded = activePet.level * 100;
    let leveledUp = false;
    if (activePet.xp >= xpNeeded) {
        activePet.level++;
        activePet.xp -= xpNeeded;
        leveledUp = true;
        
        // Level up stat bonus
        Object.keys(activePet.stats).forEach(stat => {
            activePet.stats[stat] += Math.floor(petInfo.growth_rate[stat] * 0.5);
        });
    }
    
    // Save pet data
    const userData = getUserPets(userId);
    const petIndex = userData.pets.findIndex(p => p.id === activePet.id);
    userData.pets[petIndex] = activePet;
    const { saveUserPets } = require('./utils/pet-manager');
    saveUserPets(userId, userData);
    
    if (!huntSuccess) {
        let description = `${petInfo.emoji} **${activePet.name}** went hunting but came back empty-handed!\n\n`;
        description += `🎯 **Hunt Success:** ${Math.floor(successChance * 100)}%\n`;
        description += `📉 **Condition:** -20 hunger, -10 happiness\n`;
        description += `⭐ **XP Gained:** +8`;
        
        if (leveledUp) {
            description += `\n\n🎉 **LEVEL UP!** ${activePet.name} is now level ${activePet.level}!`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🦴 Hunt Failed')
            .setDescription(description)
            .setColor(0xffa500)
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }

    // Successful hunt - generate random loot
    const loot = generateHuntingLoot(activePet);
    
    // Add loot to inventory
    const { addItemToInventory } = require('./utils/inventory-manager');
    loot.items.forEach(item => {
        try {
            addItemToInventory(userId, item.id, item.quantity);
        } catch (error) {
            console.log('Inventory system not fully implemented yet');
        }
    });
    
    // Add coins
    if (loot.coins > 0) {
        addBalance(userId, loot.coins);
    }
    
    let description = `${petInfo.emoji} **${activePet.name}** went hunting and returned with treasure!\n\n`;
    description += `🎯 **Hunt Success:** ${Math.floor(successChance * 100)}%\n`;
    description += `📉 **Condition:** -20 hunger, -10 happiness\n`;
    description += `⭐ **XP Gained:** +8\n\n`;
    description += `**🎁 Loot Found:**\n`;
    
    if (loot.coins > 0) {
        description += `💰 ${loot.coins.toLocaleString()} coins\n`;
    }
    
    loot.items.forEach(item => {
        description += `${item.emoji} ${item.name} x${item.quantity}\n`;
    });
    
    if (leveledUp) {
        description += `\n🎉 **LEVEL UP!** ${activePet.name} is now level ${activePet.level}!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🏹 Successful Hunt!')
        .setDescription(description)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

function generateHuntingLoot(pet) {
    const loot = { coins: 0, items: [] };
    const petInfo = PET_TYPES[pet.type];
    
    // Base loot chance affected by pet level and stats
    const lootPower = pet.level + (pet.stats.speed / 10) + (pet.stats.attack / 15);
    
    // Coins (always some chance)
    const coinChance = Math.random();
    if (coinChance < 0.7) {
        loot.coins = Math.floor(Math.random() * (lootPower * 50)) + (pet.level * 25);
    }
    
    // Items based on pet type and level
    const possibleItems = [
        { id: 'fish', emoji: '🐟', name: 'Fish', weight: pet.type === 'cat' ? 3 : 1 },
        { id: 'meat', emoji: '🥩', name: 'Raw Meat', weight: ['dog', 'wolf'].includes(pet.type) ? 3 : 1 },
        { id: 'berries', emoji: '🫐', name: 'Wild Berries', weight: pet.type === 'bird' ? 3 : 1 },
        { id: 'carrot', emoji: '🥕', name: 'Wild Carrot', weight: pet.type === 'rabbit' ? 3 : 1 },
        { id: 'bone', emoji: '🦴', name: 'Old Bone', weight: ['dog', 'wolf'].includes(pet.type) ? 2 : 1 },
        { id: 'feather', emoji: '🪶', name: 'Rare Feather', weight: pet.type === 'bird' ? 2 : 0.5 },
        { id: 'gems', emoji: '💎', name: 'Shiny Gem', weight: pet.type === 'dragon' ? 2 : 0.3 },
        { id: 'gold', emoji: '🪙', name: 'Gold Piece', weight: pet.type === 'dragon' ? 2 : 0.2 },
        // Random useful items
        { id: 'rope', emoji: '🪢', name: 'Rope', weight: 0.5 },
        { id: 'stick', emoji: '🪵', name: 'Sturdy Stick', weight: 1 },
        { id: 'stone', emoji: '🪨', name: 'Smooth Stone', weight: 1 },
        { id: 'herb', emoji: '🌿', name: 'Healing Herb', weight: 0.7 }
    ];
    
    // Roll for 1-3 items
    const itemCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < itemCount; i++) {
        const totalWeight = possibleItems.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const item of possibleItems) {
            random -= item.weight;
            if (random <= 0) {
                const quantity = Math.floor(Math.random() * 3) + 1;
                loot.items.push({
                    id: item.id,
                    emoji: item.emoji,
                    name: item.name,
                    quantity: quantity
                });
                break;
            }
        }
    }
    
    return loot;
}

function getStatusBar(value) {
    const bars = Math.floor(value / 10);
    const filled = '█'.repeat(bars);
    const empty = '░'.repeat(10 - bars);
    return `${filled}${empty}`;
}

async function handleFeedPet(message, userId, args) {
    const activePet = getActivePet(userId);
    
    if (!activePet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You need an active pet to feed! Use `%pet buy` to get a pet first.')
                    .setColor(0xff0000)
            ]
        });
    }

    if (args.length === 0) {
        const userData = getUserPets(userId);
        const petItems = userData.pet_items || {};
        
        let description = `**🍽️ Feed ${activePet.name}**\n\n`;
        description += `**Current Status:**\n`;
        description += `🍽️ Hunger: ${activePet.hunger}/100\n`;
        description += `😊 Happiness: ${activePet.happiness}/100\n\n`;
        description += `**Available Food:**\n`;
        
        const foodItems = Object.entries(PET_ITEMS).filter(([id, item]) => item.type === 'food');
        let hasFood = false;
        
        for (const [foodId, foodInfo] of foodItems) {
            const quantity = petItems[foodId] || 0;
            if (quantity > 0) {
                hasFood = true;
                const petInfo = PET_TYPES[activePet.type];
                const isFavorite = petInfo.favorite_foods.includes(foodId) ? '⭐' : '';
                description += `${foodInfo.emoji} **${foodInfo.name}** x${quantity} ${isFavorite}\n`;
                description += `└ +${foodInfo.hunger} hunger, +${foodInfo.happiness} happiness\n`;
            }
        }
        
        if (!hasFood) {
            description += `❌ No food items available!\n\n`;
            description += `💡 **Buy food from the pet shop:**\n`;
            description += `Use \`%petshop\` to buy food items for your pet.`;
        } else {
            description += `\n💡 **Usage:** \`%pet feed <food_name>\``;
        }

        const embed = new EmbedBuilder()
            .setTitle('🍽️ Pet Feeding')
            .setDescription(description)
            .setColor(0xe91e63)
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }

    const foodType = args[0].toLowerCase();
    const result = feedPet(userId, activePet.id, foodType);
    
    if (!result.success) {
        let errorMsg = '';
        switch (result.reason) {
            case 'invalid':
                errorMsg = '❌ Invalid food item! Use `%pet feed` to see available food.';
                break;
            case 'no_food':
                errorMsg = `❌ You don't have any ${foodType}! Buy some from the pet shop with \`%petshop\`.`;
                break;
            default:
                errorMsg = '❌ Failed to feed pet.';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    const foodInfo = PET_ITEMS[foodType];
    const petInfo = PET_TYPES[activePet.type];
    const isFavorite = petInfo.favorite_foods.includes(foodType);
    
    let description = `${petInfo.emoji} **${activePet.name}** enjoyed the ${foodInfo.emoji} **${foodInfo.name}**!\n\n`;
    description += `**Effects:**\n`;
    description += `🍽️ Hunger: +${result.hunger_gained} (now ${result.pet.hunger}/100)\n`;
    description += `😊 Happiness: +${result.happiness_gained} (now ${result.pet.happiness}/100)\n`;
    
    if (isFavorite) {
        description += `\n⭐ **Favorite Food Bonus!** Effects increased by 50%!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🍽️ Pet Fed Successfully!')
        .setDescription(description)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleTrainPet(message, userId, args) {
    const activePet = getActivePet(userId);
    
    if (!activePet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You need an active pet to train! Use `%pet buy` to get a pet first.')
                    .setColor(0xff0000)
            ]
        });
    }

    updatePetStatus(activePet);

    if (args.length === 0) {
        let description = `**🏋️ Train ${activePet.name}**\n\n`;
        description += `**Current Status:**\n`;
        description += `🍽️ Hunger: ${activePet.hunger}/100 (needs 20+)\n`;
        description += `😊 Happiness: ${activePet.happiness}/100 (needs 30+)\n\n`;
        description += `**Current Stats:**\n`;
        description += `⚔️ Attack: ${activePet.stats.attack}\n`;
        description += `🛡️ Defense: ${activePet.stats.defense}\n`;
        description += `💨 Speed: ${activePet.stats.speed}\n`;
        description += `❤️ Health: ${activePet.stats.health}\n\n`;
        description += `**Available Training:**\n`;
        description += `⚔️ \`%pet train attack\` - Increase attack power\n`;
        description += `🛡️ \`%pet train defense\` - Increase defense\n`;
        description += `💨 \`%pet train speed\` - Increase speed\n`;
        description += `❤️ \`%pet train health\` - Increase health\n\n`;
        description += `💡 Training costs 15 happiness and 10 hunger!`;

        const embed = new EmbedBuilder()
            .setTitle('🏋️ Pet Training')
            .setDescription(description)
            .setColor(0xe91e63)
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }

    const statType = args[0].toLowerCase();
    const result = trainPet(userId, activePet.id, statType);
    
    if (!result.success) {
        let errorMsg = '';
        switch (result.reason) {
            case 'pet_not_found':
                errorMsg = '❌ Pet not found!';
                break;
            case 'unhappy':
                errorMsg = `😢 ${activePet.name} is too sad to train! Feed them or play to increase happiness (needs 30+).`;
                break;
            case 'hungry':
                errorMsg = `🍽️ ${activePet.name} is too hungry to train! Feed them first (needs 20+).`;
                break;
            case 'invalid_stat':
                errorMsg = '❌ Invalid stat! Choose: attack, defense, speed, or health.';
                break;
            default:
                errorMsg = '❌ Failed to train pet.';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    const petInfo = PET_TYPES[activePet.type];
    let description = `${petInfo.emoji} **${activePet.name}** completed ${statType} training!\n\n`;
    description += `**Training Results:**\n`;
    description += `📈 ${statType.charAt(0).toUpperCase() + statType.slice(1)}: +${result.stat_gained} (now ${result.pet.stats[statType]})\n`;
    description += `⭐ XP: +10 (now ${result.pet.xp}/${result.pet.level * 100})\n`;
    description += `🍽️ Hunger: -10 (now ${result.pet.hunger}/100)\n`;
    description += `😊 Happiness: -15 (now ${result.pet.happiness}/100)\n`;
    
    if (result.leveled_up) {
        description += `\n🎉 **LEVEL UP!** ${activePet.name} is now level ${result.pet.level}!\n`;
        description += `All stats increased from leveling up!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🏋️ Training Complete!')
        .setDescription(description)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handlePetInfo(message, userId, args) {
    let targetPet;
    
    if (args.length === 0) {
        targetPet = getActivePet(userId);
        if (!targetPet) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You need an active pet! Use `%pet buy` to get a pet first.')
                        .setColor(0xff0000)
                ]
            });
        }
    } else {
        const petName = args.join(' ');
        const userData = getUserPets(userId);
        targetPet = userData.pets.find(pet => pet.name.toLowerCase() === petName.toLowerCase());
        
        if (!targetPet) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have a pet named "${petName}"!`)
                        .setColor(0xff0000)
                ]
            });
        }
    }

    updatePetStatus(targetPet);
    const petInfo = PET_TYPES[targetPet.type];
    const userData = getUserPets(userId);
    const isActive = targetPet.id === userData.active_pet;
    
    let description = `${petInfo.emoji} **${targetPet.name}** ${isActive ? '⭐ **ACTIVE**' : ''}\n`;
    description += `**${petInfo.name}** • Level ${targetPet.level}\n\n`;
    
    description += `**📊 Stats:**\n`;
    description += `⚔️ Attack: ${targetPet.stats.attack}\n`;
    description += `🛡️ Defense: ${targetPet.stats.defense}\n`;
    description += `💨 Speed: ${targetPet.stats.speed}\n`;
    description += `❤️ Health: ${targetPet.stats.health}\n\n`;
    
    description += `**🎯 Status:**\n`;
    const hungerBar = getStatusBar(targetPet.hunger);
    const happinessBar = getStatusBar(targetPet.happiness);
    description += `🍽️ Hunger: ${targetPet.hunger}/100 ${hungerBar}\n`;
    description += `😊 Happiness: ${targetPet.happiness}/100 ${happinessBar}\n`;
    description += `⭐ XP: ${targetPet.xp}/${targetPet.level * 100}\n\n`;
    
    description += `**🏆 Record:**\n`;
    description += `🥇 Battles Won: ${targetPet.battles_won}\n`;
    description += `💔 Battles Lost: ${targetPet.battles_lost}\n`;
    description += `🏋️ Training Sessions: ${targetPet.training_sessions}\n\n`;
    
    description += `**💡 Favorite Foods:**\n`;
    const favoriteEmojis = petInfo.favorite_foods.map(food => {
        const foodItem = PET_ITEMS[food];
        return foodItem ? foodItem.emoji : '❓';
    }).join(' ');
    description += favoriteEmojis;

    const embed = new EmbedBuilder()
        .setTitle(`🐾 Pet Information`)
        .setDescription(description)
        .setColor(0xe91e63)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleSwitchPet(message, userId, args) {
    if (args.length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify which pet to make active!\nExample: `%pet switch Fluffy`')
                    .setColor(0xff0000)
            ]
        });
    }

    const petName = args.join(' ');
    const userData = getUserPets(userId);
    const targetPet = userData.pets.find(pet => pet.name.toLowerCase() === petName.toLowerCase());
    
    if (!targetPet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have a pet named "${petName}"!\n\nYour pets: ${userData.pets.map(p => p.name).join(', ')}`)
                    .setColor(0xff0000)
            ]
        });
    }

    if (targetPet.id === userData.active_pet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${targetPet.name} is already your active pet!`)
                    .setColor(0xff0000)
            ]
        });
    }

    const result = setActivePet(userId, targetPet.id);
    
    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Failed to switch active pet!')
                    .setColor(0xff0000)
            ]
        });
    }

    const petInfo = PET_TYPES[targetPet.type];
    const embed = new EmbedBuilder()
        .setTitle('⭐ Active Pet Changed!')
        .setDescription(`${petInfo.emoji} **${targetPet.name}** is now your active pet!\n\nUse \`%pet info\` to see their stats.`)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayPetTypes(message) {
    let description = '**🐾 Available Pet Types**\n\n';
    
    for (const [petId, petInfo] of Object.entries(PET_TYPES)) {
        description += `${petInfo.emoji} **${petInfo.name}** - ${petInfo.price.toLocaleString()} coins\n`;
        description += `└ ${petInfo.description}\n\n`;
    }
    
    description += `💡 **How to buy:** \`%pet buy <type> <name>\`\n`;
    description += `Example: \`%pet buy cat Fluffy\``;

    const embed = new EmbedBuilder()
        .setTitle('🐾 Pet Types')
        .setDescription(description)
        .setColor(0xe91e63)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}