const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { loadAll, saveAll } = require('./sticky-manager');

module.exports = {
    name: 'sticky',
    description: 'Create or manage a sticky message that stays at the bottom of a channel',
    usage: '%sticky set <message> | %sticky set --title Title | Message | %sticky off | %sticky show | %sticky edit <message|--title Title | Message>',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    cooldown: 3,

    async execute(message, args) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You need **Manage Channels** permission to manage sticky messages.'
            });
        }

        // Check bot permissions
        const botPerms = message.channel.permissionsFor(message.guild.members.me);
        if (!botPerms.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks])) {
            return await sendAsFloofWebhook(message, {
                content: '❌ I need **Send Messages**, **Manage Messages**, and **Embed Links** permissions to manage sticky messages.'
            });
        }

        const sub = (args.shift() || '').toLowerCase();
        const all = loadAll();
        const guildId = message.guild.id;
        if (!all[guildId]) all[guildId] = {};
        if (!all[guildId][message.channel.id]) all[guildId][message.channel.id] = null;

        if (sub === 'set' || sub === 'create') {
            const full = args.join(' ').trim();
            if (!full) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Provide the sticky message content.\n\n**Usage:**\n• `%sticky set <message>`\n• `%sticky set --title Title | Message`'
                });
            }

            let content = full;
            let title = null;
            
            // Parse --title syntax
            if (full.toLowerCase().includes('--title')) {
                const titleMatch = full.match(/--title\s+(.+?)(?:\s*\|\s*(.+))?$/i);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                    content = titleMatch[2] ? titleMatch[2].trim() : '';
                }
            }
            
            if (!content && !title) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Sticky message must have either a title or content (or both).'
                });
            }

            // Delete previous sticky message if present
            const prev = all[guildId][message.channel.id];
            if (prev?.lastMessageId) {
                try {
                    await message.channel.messages.delete(prev.lastMessageId);
                } catch (error) {
                    // Message might already be deleted
                }
            }

            // Create and send new sticky message
            const stickyEmbed = new EmbedBuilder()
                .setColor(0xFFB347)
                .setFooter({ text: '📌 Sticky Message' });
            
            if (title) stickyEmbed.setTitle(title);
            if (content) stickyEmbed.setDescription(content);
            
            const sent = await message.channel.send({ embeds: [stickyEmbed] });
            
            // Save configuration
            all[guildId][message.channel.id] = { 
                content: content || '', 
                title: title || null, 
                lastMessageId: sent.id,
                createdAt: Date.now(),
                createdBy: message.author.id
            };
            saveAll(all);

            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ Sticky Message Created')
                .setDescription(`Sticky message is now active in ${message.channel}. It will reappear after new messages.`)
                .setColor(0x57F287);
            
            if (title) confirmEmbed.addFields({ name: 'Title', value: title, inline: true });
            if (content) confirmEmbed.addFields({ name: 'Content', value: content.slice(0, 1024), inline: false });
            
            const confirmation = await sendAsFloofWebhook(message, { embeds: [confirmEmbed] });
            setTimeout(() => confirmation.delete().catch(() => {}), 5000);
            return;
        }

        if (sub === 'off' || sub === 'remove' || sub === 'clear' || sub === 'delete') {
            const prev = all[guildId][message.channel.id];
            if (!prev) {
                return await sendAsFloofWebhook(message, {
                    content: 'ℹ️ No sticky message is set in this channel.'
                });
            }
            
            // Show confirmation with button
            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ Remove Sticky Message')
                .setDescription(`Are you sure you want to remove the sticky message from ${message.channel}?`)
                .setColor(0xFF6B6B);
            
            if (prev.title) confirmEmbed.addFields({ name: 'Current Title', value: prev.title, inline: true });
            if (prev.content) confirmEmbed.addFields({ name: 'Current Content', value: prev.content.slice(0, 1024), inline: false });
            
            const confirmButton = new ButtonBuilder()
                .setCustomId('sticky_remove_confirm')
                .setLabel('Remove Sticky')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️');
            
            const cancelButton = new ButtonBuilder()
                .setCustomId('sticky_remove_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');
            
            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
            
            const confirmMessage = await message.channel.send({
                embeds: [confirmEmbed],
                components: [row]
            });
            
            // Handle button interactions
            const collector = confirmMessage.createMessageComponentCollector({ time: 30000 });
            
            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    return await interaction.reply({
                        content: '❌ Only the user who ran this command can confirm the removal.',
                        ephemeral: true
                    });
                }
                
                if (interaction.customId === 'sticky_remove_confirm') {
                    // Delete the sticky message
                    if (prev.lastMessageId) {
                        try {
                            await message.channel.messages.delete(prev.lastMessageId);
                        } catch (error) {
                            // Message might already be deleted
                        }
                    }
                    
                    // Remove from config
                    all[guildId][message.channel.id] = null;
                    saveAll(all);
                    
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Sticky Message Removed')
                        .setDescription(`Sticky message has been removed from ${message.channel}.`)
                        .setColor(0x57F287);
                    
                    await interaction.update({ embeds: [successEmbed], components: [] });
                    setTimeout(() => confirmMessage.delete().catch(() => {}), 3000);
                    
                } else if (interaction.customId === 'sticky_remove_cancel') {
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle('❌ Removal Cancelled')
                        .setDescription('Sticky message removal has been cancelled.')
                        .setColor(0x5865F2);
                    
                    await interaction.update({ embeds: [cancelEmbed], components: [] });
                    setTimeout(() => confirmMessage.delete().catch(() => {}), 3000);
                }
                
                collector.stop();
            });
            
            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('⏰ Confirmation Timeout')
                        .setDescription('Sticky message removal confirmation timed out.')
                        .setColor(0xFFA500);
                    
                    try {
                        await confirmMessage.edit({ embeds: [timeoutEmbed], components: [] });
                        setTimeout(() => confirmMessage.delete().catch(() => {}), 3000);
                    } catch (error) {
                        // Message might have been deleted
                    }
                }
            });
            
            return;
        }

        if (sub === 'show' || sub === 'view' || sub === 'info') {
            const prev = all[guildId][message.channel.id];
            if (!prev) {
                return await sendAsFloofWebhook(message, {
                    content: 'ℹ️ No sticky message is set in this channel.'
                });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('📌 Current Sticky Message')
                .setColor(0x5865F2)
                .setFooter({ text: `Created by ${message.guild.members.cache.get(prev.createdBy)?.displayName || 'Unknown User'}` });
            
            if (prev.title) embed.addFields({ name: 'Title', value: prev.title, inline: false });
            if (prev.content) embed.addFields({ name: 'Content', value: prev.content.slice(0, 4096), inline: false });
            
            if (prev.createdAt) {
                embed.setTimestamp(prev.createdAt);
            }
            
            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (sub === 'edit' || sub === 'update') {
            const prev = all[guildId][message.channel.id];
            if (!prev) {
                return await sendAsFloofWebhook(message, {
                    content: 'ℹ️ No sticky message is set in this channel. Use `%sticky set <message>` to create one first.'
                });
            }
            
            const full = args.join(' ').trim();
            if (!full) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Provide new content for the sticky message.\n\n**Usage:**\n• `%sticky edit <message>`\n• `%sticky edit --title Title | Message`'
                });
            }
            
            let content = full;
            let title = null;
            
            // Parse --title syntax
            if (full.toLowerCase().includes('--title')) {
                const titleMatch = full.match(/--title\s+(.+?)(?:\s*\|\s*(.+))?$/i);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                    content = titleMatch[2] ? titleMatch[2].trim() : prev.content || '';
                }
            }
            
            // Use existing title if not specified
            if (title === null) title = prev.title;
            
            if (!content && !title) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Sticky message must have either a title or content (or both).'
                });
            }
            
            // Try to edit existing message first
            let success = false;
            if (prev.lastMessageId) {
                try {
                    const existingMsg = await message.channel.messages.fetch(prev.lastMessageId);
                    if (existingMsg) {
                        const updatedEmbed = new EmbedBuilder()
                            .setColor(0xFFB347)
                            .setFooter({ text: '📌 Sticky Message' });
                        
                        if (title) updatedEmbed.setTitle(title);
                        if (content) updatedEmbed.setDescription(content);
                        
                        await existingMsg.edit({ embeds: [updatedEmbed] });
                        success = true;
                    }
                } catch (error) {
                    // Message might have been deleted, will create new one below
                }
            }
            
            // If editing failed, send new message
            if (!success) {
                const newEmbed = new EmbedBuilder()
                    .setColor(0xFFB347)
                    .setFooter({ text: '📌 Sticky Message' });
                
                if (title) newEmbed.setTitle(title);
                if (content) newEmbed.setDescription(content);
                
                const sent = await message.channel.send({ embeds: [newEmbed] });
                prev.lastMessageId = sent.id;
            }
            
            // Update configuration
            prev.content = content || '';
            prev.title = title;
            prev.lastUpdated = Date.now();
            prev.lastUpdatedBy = message.author.id;
            all[guildId][message.channel.id] = prev;
            saveAll(all);
            
            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ Sticky Message Updated')
                .setDescription(`Sticky message in ${message.channel} has been updated.`)
                .setColor(0x57F287);
            
            if (title) confirmEmbed.addFields({ name: 'New Title', value: title, inline: true });
            if (content) confirmEmbed.addFields({ name: 'New Content', value: content.slice(0, 1024), inline: false });
            
            const confirmation = await sendAsFloofWebhook(message, { embeds: [confirmEmbed] });
            setTimeout(() => confirmation.delete().catch(() => {}), 5000);
            return;
        }

        // Default: show usage
        const embed = new EmbedBuilder()
            .setTitle('📌 Sticky Message System')
            .setDescription('Keep important messages visible by automatically reposting them after new messages.')
            .addFields(
                {
                    name: '📝 Create/Set',
                    value: '`%sticky set <message>`\n`%sticky set --title Title | Message`',
                    inline: true
                },
                {
                    name: '✏️ Edit',
                    value: '`%sticky edit <message>`\n`%sticky edit --title Title | Message`',
                    inline: true
                },
                {
                    name: '👁️ View',
                    value: '`%sticky show`\n`%sticky info`',
                    inline: true
                },
                {
                    name: '🗑️ Remove',
                    value: '`%sticky off`\n`%sticky remove`',
                    inline: true
                },
                {
                    name: '💡 Tips',
                    value: '• Sticky messages reappear after 5+ seconds\n• Use `--title` for formatted messages\n• Only one sticky per channel',
                    inline: false
                }
            )
            .setColor(0xFFB347)
            .setFooter({ text: 'Requires: Manage Channels permission' });
        
        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};

// Export the bumpStickyIfNeeded function for use in message handler
module.exports.bumpStickyIfNeeded = require('./sticky-manager').bumpStickyIfNeeded;
