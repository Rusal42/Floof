const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'bulksnipe',
    aliases: ['bulks'],
    description: 'Shows multiple recently deleted messages in this channel',
    async execute(message, args) {
        // Access the deleted messages from the client's global storage
        const deletedMessages = message.client.deletedMessages?.get(message.channel.id) || [];
        
        if (deletedMessages.length === 0) {
            return message.reply('No deleted messages found in this channel.');
        }
        
        // Show up to 5 messages at once
        const messagesToShow = Math.min(5, deletedMessages.length);
        const embed = new EmbedBuilder()
            .setTitle(`🗑️ Last ${messagesToShow} Deleted Messages`)
            .setColor(0xff6b6b)
            .setFooter({ text: `${deletedMessages.length} total deleted messages stored` })
            .setTimestamp();
        
        for (let i = 0; i < messagesToShow; i++) {
            const deletedMsg = deletedMessages[i];
            let fieldValue = deletedMsg.content || '*No text content*';
            
            // Add attachment info
            if (deletedMsg.attachments && deletedMsg.attachments.length > 0) {
                const attachmentText = deletedMsg.attachments.map(att => `[${att.name}](${att.url})`).join(', ');
                fieldValue += `\n📎 ${attachmentText}`;
            }
            
            // Truncate if too long
            if (fieldValue.length > 1000) {
                fieldValue = fieldValue.substring(0, 997) + '...';
            }
            
            embed.addFields({
                name: `${i + 1}. ${deletedMsg.authorTag} - ${deletedMsg.deletedAt.toLocaleString()}`,
                value: fieldValue,
                inline: false
            });
        }
        
        // Add navigation buttons if there are more than 5 messages
        if (deletedMessages.length > 5) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`bulk_prev_${message.channel.id}_0`)
                        .setLabel('◀ Previous 5')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`bulk_next_${message.channel.id}_0`)
                        .setLabel('Next 5 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(deletedMessages.length <= 5),
                    new ButtonBuilder()
                        .setCustomId(`bulk_info_${message.channel.id}`)
                        .setLabel(`1-${messagesToShow}/${deletedMessages.length}`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );
            
            return message.reply({ embeds: [embed], components: [row] });
        }
        
        message.reply({ embeds: [embed] });
    }
};
