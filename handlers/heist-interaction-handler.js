const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { getBalance } = require('../commands/gambling/utils/balance-manager');
const { getInventory, hasItem } = require('../commands/gambling/utils/inventory-manager');

// Heist targets (copied from heist.js)
const HEIST_TARGETS = {
    convenience_store: {
        name: 'Convenience Store',
        emoji: '🏪',
        difficulty: 1,
        min_reward: 500,
        max_reward: 2000,
        risk: 0.15,
        required_items: [],
        description: 'Quick and easy target for beginners'
    },
    jewelry_store: {
        name: 'Jewelry Store',
        emoji: '💎',
        difficulty: 2,
        min_reward: 2000,
        max_reward: 8000,
        risk: 0.25,
        required_items: ['lockpicks'],
        description: 'Valuable gems but better security'
    },
    bank_vault: {
        name: 'Bank Vault',
        emoji: '🏦',
        difficulty: 3,
        min_reward: 8000,
        max_reward: 25000,
        risk: 0.35,
        required_items: ['explosives', 'hacking_device'],
        description: 'High-security target with massive payouts'
    },
    casino_vault: {
        name: 'Casino Vault',
        emoji: '🎰',
        difficulty: 4,
        min_reward: 15000,
        max_reward: 50000,
        risk: 0.45,
        required_items: ['keycard', 'thermal_drill'],
        description: 'Ultimate score but extremely dangerous'
    }
};

async function handleHeistInteraction(interaction) {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // Check if this is a heist button
    if (!customId.startsWith('heist_')) return;
    
    const parts = customId.split('_');
    const action = parts[1]; // prev, next, or refresh
    const targetUserId = parts[2];
    const currentPage = parseInt(parts[3]) || 0;
    
    // Only allow the original user to interact
    if (interaction.user.id !== targetUserId) {
        return await interaction.reply({
            content: '❌ This heist interface is not for you!',
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
    
    // Generate the updated heist display
    const userBalance = getBalance(targetUserId);
    
    // Get all heist targets
    const allTargets = Object.entries(HEIST_TARGETS);
    
    const itemsPerPage = 6;
    const totalPages = Math.ceil(allTargets.length / itemsPerPage);
    
    // Ensure new page is valid
    if (newPage >= totalPages) newPage = 0;
    if (newPage < 0) newPage = totalPages - 1;
    
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allTargets.length);
    const pageTargets = allTargets.slice(startIndex, endIndex);
    
    let description = '**🎯 Criminal Heist Operations:**\n\n';
    description += '*Plan carefully. Execute flawlessly. Escape clean.*\n\n';
    description += `💰 **Available Funds:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `**🎯 Available Targets (Page ${newPage + 1}/${totalPages}):**\n\n`;
    
    pageTargets.forEach(([heistId, heist], index) => {
        const targetNumber = startIndex + index + 1;
        const inventory = getInventory(targetUserId);
        const hasRequiredItems = heist.required_items.every(item => hasItem(targetUserId, item));
        const canAfford = userBalance >= (heist.investment || 0);
        const status = (canAfford && hasRequiredItems) ? '🎯 READY' : '❌ NOT READY';
        
        description += `**${targetNumber}.** ${heist.emoji} **${heist.name}** ${status}\n`;
        description += `└ *${heist.description}*\n`;
        description += `└ 💵 Expected Take: ${heist.min_reward.toLocaleString()} - ${heist.max_reward.toLocaleString()} coins\n`;
        description += `└ ⚠️ Risk Level: ${Math.floor(heist.risk * 100)}% • 🎲 Difficulty: ${heist.difficulty}/5\n`;
        description += `└ 🛠️ Required: ${heist.required_items.join(', ') || 'None'}\n`;
        description += `└ \`%heist plan ${heistId}\` or \`%heist ${targetNumber}\`\n\n`;
    });
    
    description += '**📋 Commands:**\n';
    description += '• `%heist plan <target>` - Plan a heist\n';
    description += '• `%heist execute` - Start planned heist\n';
    description += '• `%heist status` - Check active plans';

    const embed = new EmbedBuilder()
        .setTitle('🎯 Criminal Heist Network')
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setFooter({ text: `Page ${newPage + 1}/${totalPages} • High risk, high reward. Choose wisely.` })
        .setTimestamp();

    // Create updated navigation buttons
    const components = [];
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`heist_prev_${targetUserId}_${newPage}`)
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === 0),
                new ButtonBuilder()
                    .setCustomId(`heist_next_${targetUserId}_${newPage}`)
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`heist_refresh_${targetUserId}`)
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
            console.error('Failed to update heist interaction:', error.message);
        }
    }
}

module.exports = { handleHeistInteraction };
