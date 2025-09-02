const { EmbedBuilder } = require('discord.js');
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
    formatPetDisplay 
} = require('./utils/pet-manager');

module.exports = {
    name: 'pet',
    description: 'Manage your virtual pets - buy, feed, train, and battle!',
    usage: '%pet [buy/feed/train/shop/battle/switch/info] [options]',
    category: 'gambling',
    aliases: ['pets', 'animal'],
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
                        .setDescription(`🚔 You are currently under arrest! You cannot manage pets for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length === 0) {
            return await displayPetOverview(message, userId);
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
            case 'shop':
            case 'store':
                return await handlePetShop(message, userId, args.slice(1));
            case 'battle':
            case 'fight':
                return await handlePetBattle(message, userId, args.slice(1));
            case 'switch':
            case 'active':
                return await handleSwitchPet(message, userId, args.slice(1));
            case 'info':
            case 'stats':
                return await handlePetInfo(message, userId, args.slice(1));
            case 'inventory':
            case 'items':
                return await handlePetInventory(message, userId);
            case 'types':
            case 'list':
                return await displayPetTypes(message);
            default:
                return await displayPetOverview(message, userId);
        }
    }
};

async function displayPetOverview(message, userId) {
    const petDisplay = formatPetDisplay(userId);
    const userBalance = getBalance(userId);
    
    const embed = new EmbedBuilder()
        .setTitle(`🐾 ${message.author.username}'s Pet Collection`)
        .setDescription(petDisplay)
        .setColor(0xe91e63)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '💰 Balance', value: `${userBalance.toLocaleString()} coins`, inline: true },
            { name: '📋 Commands', value: '`%pet buy` • `%pet feed` • `%pet train`\n`%pet shop` • `%pet battle` • `%pet info`', inline: true }
        )
        .setFooter({ text: 'Use %pet types to see available pet types!' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
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

    if (petName.length > 20) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Pet name must be 20 characters or less!')
                    .setColor(0xff0000)
            ]
        });
    }

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
                    .setDescription(`❌ Insufficient funds!\n\n${petInfo.emoji} **${petInfo.name}**\n💰 **Cost:** ${petInfo.price.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins\n❌ **Need:** ${(petInfo.price - userBalance).toLocaleString()} more coins`)
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

    // Deduct cost
    subtractBalance(userId, result.cost);

    const embed = new EmbedBuilder()
        .setTitle('🎉 Pet Purchased!')
        .setDescription(`Congratulations! You bought ${petInfo.emoji} **${petName}** the ${petInfo.name}!\n\n${petInfo.description}\n\n💰 **Cost:** ${result.cost.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n🍽️ Don't forget to feed and train your new pet!`)
        .setColor(0x00ff00)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleFeedPet(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify food type!\nExample: `%pet feed fish`\nUse `%pet shop food` to see available food.')
                    .setColor(0xff0000)
            ]
        });
    }

    const foodType = args[0].toLowerCase();
    const activePet = getActivePet(userId);

    if (!activePet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You don\'t have an active pet! Buy a pet first with `%pet buy <type> <name>`.')
                    .setColor(0xff0000)
            ]
        });
    }

    const result = feedPet(userId, activePet.id, foodType);

    if (!result.success) {
        let errorMsg = '';
        switch (result.reason) {
            case 'no_food':
                errorMsg = `❌ You don't have any ${PET_ITEMS[foodType]?.name || foodType}! Buy some from \`%pet shop food\`.`;
                break;
            case 'invalid':
                errorMsg = '❌ Invalid food type! Use `%pet shop food` to see available food.';
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

    const food = PET_ITEMS[foodType];
    const petInfo = PET_TYPES[result.pet.type];
    const isFavorite = petInfo.favorite_foods.includes(foodType);

    let feedbackMsg = `${petInfo.emoji} **${result.pet.name}** enjoyed the ${food.emoji} ${food.name}!\n\n`;
    feedbackMsg += `🍽️ **Hunger:** +${result.hunger_gained} (${result.pet.hunger}/100)\n`;
    feedbackMsg += `😊 **Happiness:** +${result.happiness_gained} (${result.pet.happiness}/100)`;
    
    if (isFavorite) {
        feedbackMsg += `\n\n⭐ **Favorite Food Bonus!** ${result.pet.name} loves ${food.name}!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🍽️ Pet Fed Successfully!')
        .setDescription(feedbackMsg)
        .setColor(isFavorite ? 0xffd700 : 0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleTrainPet(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify training type!\nExample: `%pet train attack`\nOptions: `attack`, `defense`, `speed`, `health`')
                    .setColor(0xff0000)
            ]
        });
    }

    const statType = args[0].toLowerCase();
    const activePet = getActivePet(userId);

    if (!activePet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You don\'t have an active pet! Buy a pet first with `%pet buy <type> <name>`.')
                    .setColor(0xff0000)
            ]
        });
    }

    const result = trainPet(userId, activePet.id, statType);

    if (!result.success) {
        let errorMsg = '';
        switch (result.reason) {
            case 'unhappy':
                errorMsg = `❌ ${activePet.name} is too unhappy to train! (${activePet.happiness}/100)\nFeed them or play with toys to increase happiness.`;
                break;
            case 'hungry':
                errorMsg = `❌ ${activePet.name} is too hungry to train! (${activePet.hunger}/100)\nFeed them first.`;
                break;
            case 'invalid_stat':
                errorMsg = '❌ Invalid training type! Options: `attack`, `defense`, `speed`, `health`';
                break;
            default:
                errorMsg = '❌ Training failed.';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    const petInfo = PET_TYPES[result.pet.type];
    let trainingMsg = `${petInfo.emoji} **${result.pet.name}** completed ${statType} training!\n\n`;
    trainingMsg += `📈 **${statType.charAt(0).toUpperCase() + statType.slice(1)}:** +${result.stat_gained} (${result.pet.stats[result.stat_type]})\n`;
    trainingMsg += `⭐ **XP:** +10 (${result.pet.xp}/${result.pet.level * 100})\n`;
    trainingMsg += `🍽️ **Hunger:** ${result.pet.hunger}/100\n`;
    trainingMsg += `😊 **Happiness:** ${result.pet.happiness}/100`;

    if (result.leveled_up) {
        trainingMsg += `\n\n🎉 **LEVEL UP!** ${result.pet.name} is now level ${result.pet.level}!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🏋️ Training Complete!')
        .setDescription(trainingMsg)
        .setColor(result.leveled_up ? 0xffd700 : 0x3498db)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handlePetShop(message, userId, args) {
    const category = args[0]?.toLowerCase() || 'all';
    const userBalance = getBalance(userId);
    
    if (args.length >= 2 && args[0].toLowerCase() === 'buy') {
        return await handleBuyPetItem(message, userId, args.slice(1));
    }

    let items = Object.entries(PET_ITEMS);
    
    if (category !== 'all') {
        items = items.filter(([id, item]) => item.type === category);
    }

    if (items.length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid category! Available: `food`, `toy`, `accessory`, `training`, `all`')
                    .setColor(0xff0000)
            ]
        });
    }

    let description = `**🛒 Pet Shop - ${category.charAt(0).toUpperCase() + category.slice(1)}**\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;

    items.forEach(([id, item]) => {
        const canAfford = userBalance >= item.price;
        const priceDisplay = canAfford ? `💰 ${item.price.toLocaleString()}` : `❌ ${item.price.toLocaleString()}`;
        
        description += `${item.emoji} **${item.name}** - ${priceDisplay}\n`;
        if (item.type === 'food') {
            description += `└ 🍽️ +${item.hunger} hunger, 😊 +${item.happiness} happiness\n`;
        } else if (item.type === 'toy') {
            description += `└ 😊 +${item.happiness} happiness, 🏋️ +${item.training_bonus} training\n`;
        }
        description += `└ \`%pet shop buy ${id}\`\n\n`;
    });

    description += '**Categories:** `food` • `toy` • `accessory` • `training` • `all`';

    const embed = new EmbedBuilder()
        .setTitle('🛒 Pet Shop')
        .setDescription(description)
        .setColor(0x9b59b6)
        .setFooter({ text: 'Use %pet shop buy <item> to purchase items!' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleBuyPetItem(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify item to buy!\nExample: `%pet shop buy fish`')
                    .setColor(0xff0000)
            ]
        });
    }

    const itemType = args[0].toLowerCase();
    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 50) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Quantity must be between 1 and 50!')
                    .setColor(0xff0000)
            ]
        });
    }

    const item = PET_ITEMS[itemType];
    if (!item) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid item! Use `%pet shop` to see available items.')
                    .setColor(0xff0000)
            ]
        });
    }

    const totalCost = item.price * quantity;
    const userBalance = getBalance(userId);

    if (userBalance < totalCost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n${item.emoji} **${item.name}** x${quantity}\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins\n❌ **Need:** ${(totalCost - userBalance).toLocaleString()} more coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    const result = buyPetItem(userId, itemType, quantity);
    
    if (result.success) {
        subtractBalance(userId, totalCost);
        
        const embed = new EmbedBuilder()
            .setTitle('🛒 Purchase Successful!')
            .setDescription(`Successfully purchased ${item.emoji} **${quantity}x ${item.name}**!\n\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
}

async function handlePetBattle(message, userId, args) {
    // This will be implemented later - placeholder for now
    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setDescription('🚧 Pet battles are coming soon! Train your pets and get them ready for epic battles!')
                .setColor(0xffa500)
        ]
    });
}

async function handleSwitchPet(message, userId, args) {
    if (args.length < 1) {
        const userData = getUserPets(userId);
        if (userData.pets.length === 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You don\'t have any pets! Use `%pet buy <type> <name>` to get your first pet.')
                        .setColor(0xff0000)
                ]
            });
        }

        let petList = '**Your Pets:**\n\n';
        userData.pets.forEach((pet, index) => {
            const petInfo = PET_TYPES[pet.type];
            const isActive = pet.id === userData.active_pet ? '⭐ ' : '';
            petList += `${index + 1}. ${isActive}${petInfo.emoji} **${pet.name}** (Lv.${pet.level} ${petInfo.name})\n`;
        });
        petList += '\nUse `%pet switch <pet name>` to switch active pet.';

        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('🔄 Switch Active Pet')
                    .setDescription(petList)
                    .setColor(0x3498db)
            ]
        });
    }

    const petName = args.join(' ');
    const userData = getUserPets(userId);
    const pet = userData.pets.find(p => p.name.toLowerCase() === petName.toLowerCase());

    if (!pet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have a pet named "${petName}"!`)
                    .setColor(0xff0000)
            ]
        });
    }

    const result = setActivePet(userId, pet.id);
    
    if (result.success) {
        const petInfo = PET_TYPES[pet.type];
        const embed = new EmbedBuilder()
            .setTitle('🔄 Active Pet Changed!')
            .setDescription(`${petInfo.emoji} **${pet.name}** is now your active pet!`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
}

async function handlePetInfo(message, userId, args) {
    const petName = args.join(' ');
    let pet;

    if (petName) {
        const userData = getUserPets(userId);
        pet = userData.pets.find(p => p.name.toLowerCase() === petName.toLowerCase());
        
        if (!pet) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You don't have a pet named "${petName}"!`)
                        .setColor(0xff0000)
                ]
            });
        }
    } else {
        pet = getActivePet(userId);
        
        if (!pet) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You don\'t have an active pet! Use `%pet switch <name>` to set one.')
                        .setColor(0xff0000)
                ]
            });
        }
    }

    const petDisplay = formatPetDisplay(userId, pet.id);
    
    const embed = new EmbedBuilder()
        .setTitle(`🐾 Pet Information`)
        .setDescription(petDisplay)
        .setColor(0xe91e63)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handlePetInventory(message, userId) {
    const items = getPetItems(userId);
    
    if (Object.keys(items).length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('📦 Your pet inventory is empty! Use `%pet shop` to buy items for your pets.')
                    .setColor(0x95a5a6)
            ]
        });
    }

    let description = '**📦 Pet Inventory**\n\n';
    
    Object.entries(items).forEach(([itemId, quantity]) => {
        const item = PET_ITEMS[itemId];
        if (item && quantity > 0) {
            description += `${item.emoji} **${item.name}** x${quantity}\n`;
        }
    });

    const embed = new EmbedBuilder()
        .setTitle('📦 Pet Inventory')
        .setDescription(description)
        .setColor(0x9b59b6)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayPetTypes(message) {
    let description = '**🐾 Available Pet Types**\n\n';
    
    Object.entries(PET_TYPES).forEach(([type, info]) => {
        description += `${info.emoji} **${info.name}** - ${info.price.toLocaleString()} coins\n`;
        description += `└ ${info.description}\n`;
        description += `└ \`%pet buy ${type} <name>\`\n\n`;
    });

    description += '**💡 Tips:**\n';
    description += '• Each pet type has different stats and growth rates\n';
    description += '• Feed pets their favorite foods for bonus effects\n';
    description += '• Train regularly to increase stats and level up\n';
    description += '• Keep pets happy and fed for best training results';

    const embed = new EmbedBuilder()
        .setTitle('🐾 Pet Types')
        .setDescription(description)
        .setColor(0xe91e63)
        .setFooter({ text: 'Choose wisely - each pet type has unique strengths!' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}
