const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');

module.exports = {
    name: 'purge',
    description: 'Delete a specified number of messages in the current channel',
    usage: '%purge <amount> [@user]',
    permissions: [PermissionFlagsBits.ManageMessages],
    async execute(message, args) {
        // Check if user has permission to manage messages
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need the `Manage Messages` permission to use this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if bot has permission to manage messages
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ I need the `Manage Messages` permission to execute this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const amount = parseInt(args[0]);
        const targetUser = message.mentions.users.first();

        // Validate the amount
        if (isNaN(amount) || amount < 1 || amount > 500) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please provide a valid number between 1 and 500.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        try {
            let messages = await message.channel.messages.fetch({ limit: amount });
            
            // Filter messages by user if specified
            if (targetUser) {
                messages = messages.filter(msg => msg.author.id === targetUser.id);
            }

            // Store messages in client.deletedMessages before deleting
            const now = Date.now();
            messages.forEach(msg => {
                if (!message.client.deletedMessages.has(msg.channel.id)) {
                    message.client.deletedMessages.set(msg.channel.id, []);
                }
                message.client.deletedMessages.get(msg.channel.id).unshift({
                    content: msg.content,
                    author: msg.author,
                    timestamp: msg.createdTimestamp,
                    bulkDeleted: true,
                    deletedAt: now
                });
            });

            // Delete the messages
            const deletedMessages = await message.channel.bulkDelete(messages, true);
            
            // Send confirmation message
            const embed = new EmbedBuilder()
                .setDescription(`✅ Successfully deleted ${deletedMessages.size} messages${targetUser ? ` from ${targetUser.tag}` : ''}.`)
                .setColor(0x00FF00);
            
            // Send the confirmation message and delete it after 5 seconds
            const reply = await message.channel.send({ embeds: [embed] });
            setTimeout(() => {
                if (reply && reply.deletable) {
                    reply.delete().catch(console.error);
                }
            }, 5000);
            
        } catch (error) {
            console.error('Error purging messages:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while trying to purge messages.')
                .setColor(0xFF0000);
            sendAsFloofWebhook(message, { embeds: [embed] });
        }
    },
};
