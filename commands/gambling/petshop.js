const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    PET_TYPES, 
    PET_ITEMS, 
    getUserPets, 
    buyPet, 
    buyPetItem, 
    getPetItems 
} = require('./utils/pet-manager');

module.exports = {
    name: 'petshop',
    description: 'Buy pets and pet items',
    usage: '%petshop [buy] [pet/item] | %ps [buy] [pet/item]',
    category: 'gambling',
    aliases: ['ps', 'petstore'],
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
                        .setDescription(`🚔 You are currently under arrest! You cannot access the pet shop for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length === 0) {
            return await displayPetShop(message, userId);
        }

        // Handle buy with number: %petshop buy 1
        if (args[0].toLowerCase() === 'buy' && args[1] && !isNaN(parseInt(args[1]))) {
            const itemNumber = parseInt(args[1]);
            const amount = args[2] ? parseInt(args[2]) : 1;
            return await handleNumberedPurchase(message, userId, itemNumber, amount);
        }

        // Handle numbered selection: %petshop 1
        if (!isNaN(parseInt(args[0]))) {
            const itemNumber = parseInt(args[0]);
            const amount = args[1] ? parseInt(args[1]) : 1;
            return await handleNumberedPurchase(message, userId, itemNumber, amount);
        }

        // Handle buy with name: %petshop buy dog
        if (args[0].toLowerCase() === 'buy' && args[1]) {
            const itemId = args[1].toLowerCase();
            const amount = args[2] ? parseInt(args[2]) : 1;
            return await handlePetPurchase(message, userId, itemId, amount);
        }

        return await displayPetShop(message, userId);
    }
};

async function displayPetShop(message, userId, currentPage = 0) {
    const userBalance = getBalance(userId);
    const userData = getUserPets(userId);
    const userPets = userData.pets || [];
    
    // Collect all items
    const allItems = [];
    
    // Add pets
    for (const [petId, petInfo] of Object.entries(PET_TYPES)) {
        const owned = userPets.some(pet => pet.type === petId);
        allItems.push({
            id: petId,
            info: petInfo,
            type: 'pet',
            owned: owned
        });
    }
    
    // Add pet items
    for (const [itemId, itemInfo] of Object.entries(PET_ITEMS)) {
        allItems.push({
            id: itemId,
            info: itemInfo,
            type: 'item',
            owned: false
        });
    }
    
    const itemsPerPage = 8;
    const totalPages = Math.ceil(allItems.length / itemsPerPage);
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = allItems.slice(startIndex, endIndex);
    
    let description = '🐾 **Welcome to the Pet Shop!**\n\n';
    
    let itemIndex = startIndex + 1;
    for (const item of pageItems) {
        const categoryIcon = item.type === 'pet' ? '🐕' : '🎁';
        const status = item.owned ? '✅ Owned' : `💰 ${item.info.price.toLocaleString()} coins`;
        const affordable = userBalance >= item.info.price && !item.owned ? '✅' : '❌';
        
        description += `**${itemIndex}.** ${item.info.emoji} **${item.info.name}** ${affordable}\n`;
        description += `└ ${item.info.description}\n`;
        description += `└ ${status}\n\n`;
        itemIndex++;
    }
    
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n`;
    description += `📄 **Page ${currentPage + 1}/${totalPages}**\n\n`;
    description += `💡 **Quick Buy:** \`%ps <number>\` or \`%ps buy <name>\``;

    const embed = new EmbedBuilder()
        .setTitle('🐾 Pet Shop')
        .setDescription(description)
        .setColor(0xff69b4)
        .setTimestamp();

    // Create navigation buttons
    const row = new ActionRowBuilder();
    
    if (currentPage > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`petshop_prev_${currentPage}_${userId}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Primary)
        );
    }
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`petshop_refresh_${currentPage}_${userId}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary)
    );
    
    if (currentPage < totalPages - 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`petshop_next_${currentPage}_${userId}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Primary)
        );
    }

    await sendAsFloofWebhook(message, { embeds: [embed], components: [row] });
}

async function handleNumberedPurchase(message, userId, itemNumber, amount = 1) {
    const allItems = [];
    
    // Add pets to selection
    for (const [petId, petInfo] of Object.entries(PET_TYPES)) {
        allItems.push({ id: petId, info: petInfo, type: 'pet' });
    }
    
    // Add pet items to selection
    for (const [itemId, itemInfo] of Object.entries(PET_ITEMS)) {
        allItems.push({ id: itemId, info: itemInfo, type: 'item' });
    }
    
    if (itemNumber < 1 || itemNumber > allItems.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid selection! Choose a number between 1 and ${allItems.length}.\n\nUse \`%petshop\` to see available options.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const selectedItem = allItems[itemNumber - 1];
    
    if (selectedItem.type === 'pet') {
        return await handlePetPurchase(message, userId, selectedItem.id, 1);
    } else {
        return await handlePetItemPurchase(message, userId, selectedItem.id, amount);
    }
}

async function handlePetPurchase(message, userId, petId, amount = 1) {
    const petInfo = PET_TYPES[petId];
    if (!petInfo) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Pet not found! Use `%petshop` to see available pets.')
                    .setColor(0xff0000)
            ]
        });
    }

    const userPets = getUserPets(userId);
    const alreadyOwned = userPets.pets.some(pet => pet.type === petId);
    
    if (alreadyOwned) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You already own a **${petInfo.name}**!\n\nYou can only have one of each pet type.`)
                    .setColor(0xff0000)
            ]
        });
    }

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

    // Purchase pet
    const result = buyPet(userId, petId);
    if (result.success) {
        subtractBalance(userId, petInfo.price);
        
        const embed = new EmbedBuilder()
            .setTitle('🐾 Pet Purchased!')
            .setDescription(`${petInfo.emoji} **${result.pet.name}** the ${petInfo.name} is now yours!\n\n💰 **Cost:** ${petInfo.price.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n🎉 Use \`%pet info\` to see your new pet!`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    } else {
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${result.message}`)
                    .setColor(0xff0000)
            ]
        });
    }
}

async function handlePetItemPurchase(message, userId, itemId, amount = 1) {
    const itemInfo = PET_ITEMS[itemId];
    if (!itemInfo) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Pet item not found! Use `%petshop` to see available items.')
                    .setColor(0xff0000)
            ]
        });
    }

    const totalCost = itemInfo.price * amount;
    const userBalance = getBalance(userId);

    if (userBalance < totalCost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n${itemInfo.emoji} **${itemInfo.name}** x${amount}\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins\n❌ **Need:** ${(totalCost - userBalance).toLocaleString()} more coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Purchase pet item
    const result = buyPetItem(userId, itemId, amount);
    if (result.success) {
        subtractBalance(userId, totalCost);
        
        const embed = new EmbedBuilder()
            .setTitle('🛒 Pet Item Purchased!')
            .setDescription(`${itemInfo.emoji} **${itemInfo.name}** x${amount}\n\n💰 **Cost:** ${totalCost.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n📦 Items added to your pet inventory!`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    } else {
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${result.message}`)
                    .setColor(0xff0000)
            ]
        });
    }
}
