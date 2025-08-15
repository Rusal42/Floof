const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'clearsnipe',
    aliases: ['cs'],
    description: 'Clears all stored deleted messages for this channel',
    async execute(message, args) {
        // Check if user has manage messages permission
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('❌ You need the `Manage Messages` permission to use this command.');
        }
        
        // Clear the deleted messages from the client's global storage
        if (message.client.deletedMessages) {
            message.client.deletedMessages.delete(message.channel.id);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Snipe Cache Cleared')
            .setDescription('All deleted messages for this channel have been cleared from memory.')
            .setColor(0x00ff00)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
};
