const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Helper function to format time ago
function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}

module.exports = {
    name: 'snipe',
    aliases: ['s'],
    description: 'Shows the most recently deleted message in this channel',
    async execute(message, args) {
        // Access the deleted messages from the client's global storage
        const deletedMessages = message.client.deletedMessages?.get(message.channel.id) || [];
        
        if (deletedMessages.length === 0) {
            return message.reply('No deleted messages found in this channel.');
        }
        
        const deletedMsg = deletedMessages[0];
        const author = deletedMsg.author || { tag: 'Unknown User', displayAvatarURL: () => null };
        const authorTag = deletedMsg.authorTag || author.tag || 'Unknown User';
        const authorAvatar = deletedMsg.authorAvatar || (author.displayAvatarURL ? author.displayAvatarURL() : null);
        
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: authorTag,
                iconURL: authorAvatar
            })
            .setDescription(deletedMsg.content || '*No text content*')
            .setColor(0xff6b6b)
            .setFooter({ 
                text: `Deleted ${deletedMsg.bulkDeleted ? '(bulk deleted) ' : ''}${getTimeAgo(deletedMsg.deletedAt || deletedMsg.timestamp || Date.now())}` 
            })
            .setTimestamp(deletedMsg.deletedAt || deletedMsg.timestamp);
        
        // Add attachment info if present
        if (deletedMsg.attachments && deletedMsg.attachments.length > 0) {
            const attachmentText = deletedMsg.attachments
                .filter(att => att && att.name && att.url)
                .map(att => `[${att.name}](${att.url})`)
                .join('\n');
            if (attachmentText) {
                embed.addFields({ name: 'Attachments', value: attachmentText });
            }
        }
        
        // Add navigation buttons if there are multiple deleted messages
        if (deletedMessages.length > 1) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`snipe_prev_${message.channel.id}_0`)
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`snipe_next_${message.channel.id}_0`)
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(deletedMessages.length <= 1),
                    new ButtonBuilder()
                        .setCustomId(`snipe_info_${message.channel.id}`)
                        .setLabel(`1/${deletedMessages.length}`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );
            
            return message.reply({ embeds: [embed], components: [row] });
        }
        
        message.reply({ embeds: [embed] });
    }
};
