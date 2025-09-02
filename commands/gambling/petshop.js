const { EmbedBuilder } = require('discord.js');
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

        // Handle numbered selection
        if (!isNaN(parseInt(args[0]))) {
            const itemNumber = parseInt(args[0]);
            const amount = args[1] ? parseInt(args[1]) : 1;
            return await handleNumberedPurchase(message, userId, itemNumber, amount);
        }

        if (args[0].toLowerCase() === 'buy' && args[1]) {
            const itemId = args[1].toLowerCase();
            const amount = args[2] ? parseInt(args[2]) : 1;
            return await handlePetPurchase(message, userId, itemId, amount);
        }

        return await displayPetShop(message, userId);
    }
};

async function displayPetShop(message, userId) {
    const userBalance = getBalance(userId);
    const userPets = getUserPets(userId);
    
    let description = '🐾 **Welcome to the Pet Shop!**\n\n';
    description += '**🐕 Available Pets:**\n';
    
    let itemIndex = 1;
    
    // Display pets
    for (const [petId, petInfo] of Object.entries(PET_TYPES)) {
        const owned = userPets.some(pet => pet.type === petId);
        const status = owned ? '✅ Owned' : `💰 ${petInfo.price.toLocaleString()} coins`;
        
        description += `**${itemIndex}.** ${petInfo.emoji} **${petInfo.name}** - ${status}\n`;
        description += `└ ${petInfo.description}\n`;
        itemIndex++;
    }
    
    description += '\n**🎁 Pet Items:**\n';
    
    // Display pet items
    for (const [itemId, itemInfo] of Object.entries(PET_ITEMS)) {
        description += `**${itemIndex}.** ${itemInfo.emoji} **${itemInfo.name}** - 💰 ${itemInfo.price.toLocaleString()} coins\n`;
        description += `└ ${itemInfo.description}\n`;
        itemIndex++;
    }
    
    description += `\n💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n`;
    description += `\n💡 **Quick Buy:** \`%ps <number>\` or \`%ps buy <name>\``;

    const embed = new EmbedBuilder()
        .setTitle('🐾 Pet Shop')
        .setDescription(description)
        .setColor(0xff69b4)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
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
    const alreadyOwned = userPets.some(pet => pet.type === petId);
    
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
