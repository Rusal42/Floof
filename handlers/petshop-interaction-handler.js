const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { getBalance } = require('../commands/gambling/utils/balance-manager');
const { 
    PET_TYPES, 
    PET_ITEMS, 
    getUserPets
} = require('../commands/gambling/utils/pet-manager');

async function handlePetshopInteraction(interaction) {
    const [action, direction, currentPageStr, originalUserId] = interaction.customId.split('_');
    
    // Check if the user clicking the button is the same as the one who invoked the command
    if (interaction.user.id !== originalUserId) {
        return await interaction.reply({
            content: '❌ You can only interact with your own petshop menu!',
            ephemeral: true
        });
    }

    let currentPage = parseInt(currentPageStr);
    
    if (direction === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
    } else if (direction === 'next') {
        currentPage = currentPage + 1;
    } else if (direction === 'refresh') {
        // Keep current page
    }

    // Generate updated petshop display
    const userId = interaction.user.id;
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
    
    // Ensure currentPage is within bounds
    currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));
    
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

    try {
        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error updating petshop interaction:', error);
        // Fallback: send as new message if update fails
        try {
            await interaction.followUp({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        } catch (followUpError) {
            console.error('Error with petshop followUp:', followUpError);
        }
    }
}

module.exports = { handlePetshopInteraction };
