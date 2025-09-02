const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { getBalance } = require('../commands/gambling/utils/balance-manager');
const { 
    generateBlackmarketStock,
    BLACKMARKET_ITEMS
} = require('../commands/gambling/utils/blackmarket-manager');

async function handleBlackmarketInteraction(interaction) {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // Check if this is a blackmarket button
    if (!customId.startsWith('blackmarket_')) return;
    
    const parts = customId.split('_');
    const action = parts[1]; // prev, next, or refresh
    const targetUserId = parts[2];
    const currentPage = parseInt(parts[3]) || 0;
    
    // Only allow the original user to interact
    if (interaction.user.id !== targetUserId) {
        return await interaction.reply({
            content: '❌ This blackmarket interface is not for you!',
            ephemeral: true
        });
    }
    
    let newPage = currentPage;
    
    switch (action) {
        case 'prev':
            newPage = currentPage - 1;
            break;
        case 'next':
            newPage = currentPage + 1;
            break;
        case 'refresh':
            newPage = 0;
            break;
    }
    
    // Generate the updated blackmarket display
    const userBalance = getBalance(targetUserId);
    const stock = generateBlackmarketStock();
    const stockItems = Object.entries(stock);
    
    const itemsPerPage = 12; // Fit more items per page
    const totalPages = Math.ceil(stockItems.length / itemsPerPage);
    
    // Ensure new page is valid
    if (newPage >= totalPages) newPage = 0;
    if (newPage < 0) newPage = totalPages - 1;
    
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, stockItems.length);
    const pageItems = stockItems.slice(startIndex, endIndex);
    
    let description = `**🏴‍☠️ Welcome to the Underground Blackmarket**\n\n`;
    description += `⚠️ *Psst... looking for something special? I got what you need...*\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**📦 Today's Stock (Page ${newPage + 1}/${totalPages}):**\n\n`;
    
    pageItems.forEach(([itemId, stockInfo], index) => {
        const item = BLACKMARKET_ITEMS[itemId];
        const itemNumber = startIndex + index + 1;
        const canAfford = userBalance >= stockInfo.price;
        const priceDisplay = canAfford ? `💰 ${stockInfo.price.toLocaleString()}` : `❌ ${stockInfo.price.toLocaleString()}`;
        
        description += `**${itemNumber}.** ${item.emoji} **${item.name}** - ${priceDisplay}\n`;
        description += `└ *${item.description}*\n`;
        description += `└ 📦 **Stock:** ${stockInfo.stock} • ⚠️ **Risk:** ${Math.floor(item.risk * 100)}%\n`;
        description += `└ \`%bm ${itemNumber}\` or \`%bm buy ${itemId}\`\n\n`;
    });
    
    description += '⚠️ **Warning:** All purchases carry risk of police detection!\n';
    description += '🕐 **Stock refreshes daily at midnight**\n\n';
    description += '**📋 Commands:**\n';
    description += '• \`%bm inventory\` - View your stash\n';
    description += '• \`%bm use <item>\` - Consume items\n';
    description += '• \`%bm effects\` - View active effects';

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Underground Blackmarket')
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setFooter({ text: `Page ${newPage + 1}/${totalPages} • What happens in the blackmarket, stays in the blackmarket...` })
        .setTimestamp();

    // Create updated navigation buttons
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`blackmarket_prev_${targetUserId}_${newPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === 0),
                new ButtonBuilder()
                    .setCustomId(`blackmarket_next_${targetUserId}_${newPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`blackmarket_refresh_${targetUserId}`)
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Primary)
            );
        components.push(row);
    }

    // Update the message with error handling
    try {
        await interaction.update({
            embeds: [embed],
            components: components
        });
    } catch (error) {
        // If interaction expired, try to edit the original message
        try {
            await interaction.editReply({
                embeds: [embed],
                components: components
            });
        } catch (editError) {
            console.error('Failed to update blackmarket interaction:', error.message);
        }
    }
}

module.exports = { handleBlackmarketInteraction };
