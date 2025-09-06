const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance } = require('./utils/balance-manager');

module.exports = {
    name: 'inventory',
    description: 'View your inventory and assets',
    usage: '%inventory [category]',
    category: 'gambling',
    aliases: ['inv', 'items', 'bag', 'i'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        const userBalance = getBalance(userId);
        
        let description = `**💰 Balance:** ${userBalance.toLocaleString()} coins\n\n`;
        description += `**🎒 Your Inventory:**\n`;
        description += `Your inventory is currently empty!\n\n`;
        description += `**💡 Get Started:**\n`;
        description += `• Use \`%shop\` to buy weapons and items\n`;
        description += `• Use \`%business\` to start your empire\n`;
        description += `• Use \`%pet buy\` to adopt pets\n`;
        description += `• Use \`%blackmarket\` for special items`;

        const embed = new EmbedBuilder()
            .setTitle(`🎒 ${message.author.username}'s Inventory`)
            .setDescription(description)
            .setColor(0x3498db)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`inventory_refresh_${userId}`)
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await sendAsFloofWebhook(message, {
            embeds: [embed],
            components: [row]
        });
    }
};