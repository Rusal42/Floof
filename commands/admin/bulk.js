const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'bulk',
    aliases: ['bulkdelete', 'bulkremove', 'mass'],
    description: 'Bulk management operations for roles, channels, and server elements',
    usage: '%bulk <type> <action> [options]',
    category: 'admin',
    ownerOnly: false,
    permissions: ['Administrator'],
    cooldown: 30,

    async execute(message, args) {
        if (!args.length) {
            return await this.showMainMenu(message);
        }

        const type = args[0].toLowerCase();
        const action = args[1]?.toLowerCase();

        switch (type) {
            case 'roles':
            case 'role':
                return await this.handleRoles(message, action, args.slice(2));
            
            case 'channels':
            case 'channel':
                return await this.handleChannels(message, action, args.slice(2));
            
            case 'emojis':
            case 'emoji':
                return await this.handleEmojis(message, action, args.slice(2));
            
            // Removed bulk message deletion in favor of dedicated %purge command
            
            default:
                return await this.showMainMenu(message);
        }
    },

    async showMainMenu(message) {
        const embed = new EmbedBuilder()
            .setTitle('🔧 Bulk Management System')
            .setDescription('Powerful bulk operations for server management')
            .setColor('#FF6B6B')
            .addFields(
                {
                    name: '🎭 **Role Management**',
                    value: [
                        '`%bulk roles assign <@role|id|name> [--include-bots]` - Assign a role to all members',
                        '`%bulk roles delete <pattern>` - Delete roles by name pattern',
                        '`%bulk roles delete range <start> <end>` - Delete level roles in range',
                        '`%bulk roles delete all` - Delete all non-essential roles',
                        '`%bulk roles list <pattern>` - List roles matching pattern'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📺 **Channel Management**',
                    value: [
                        '`%bulk channels delete <pattern>` - Delete channels by name pattern',
                        '`%bulk channels delete category <name>` - Delete entire category',
                        '`%bulk channels delete type <text/voice>` - Delete by channel type',
                        '`%bulk channels list <pattern>` - List channels matching pattern'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '😀 **Emoji Management**',
                    value: [
                        '`%bulk emojis delete <pattern>` - Delete emojis by name pattern',
                        '`%bulk emojis delete all` - Delete all custom emojis',
                        '`%bulk emojis list` - List all custom emojis'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'All operations require confirmation • Use with extreme caution' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async handleRoles(message, action, args) {
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ I need **Manage Roles** permission for role operations!'
            });
        }

        switch (action) {
            case 'assign':
            case 'assignall':
                return await this.assignRoleToAll(message, args);
            case 'delete':
                return await this.deleteRoles(message, args);
            case 'list':
                return await this.listRoles(message, args);
            default:
                return await this.showRoleHelp(message);
        }
    },

    async deleteRoles(message, args) {
        if (!args.length) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Usage: `%bulk roles delete <pattern|all|range>`'
            });
        }

        let rolesToDelete = [];
        let description = '';

        if (args[0] === 'all') {
            rolesToDelete = this.getSafeRoles(message.guild);
            description = 'Delete **ALL** non-essential roles';
        } else if (args[0] === 'range' && args.length >= 3) {
            const start = parseInt(args[1]);
            const end = parseInt(args[2]);
            if (isNaN(start) || isNaN(end)) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Invalid range. Use: `%bulk roles delete range 1 50`'
                });
            }
            rolesToDelete = this.getRolesByRange(message.guild, start, end);
            description = `Delete roles with levels ${start}-${end}`;
        } else {
            const pattern = args.join(' ');
            rolesToDelete = this.getRolesByPattern(message.guild, pattern);
            description = `Delete roles containing "${pattern}"`;
        }

        if (rolesToDelete.length === 0) {
            return await sendAsFloofWebhook(message, {
                content: '❌ No matching roles found.'
            });
        }

        return await this.confirmBulkDeletion(message, 'roles', rolesToDelete, description, this.executeRoleDeletion.bind(this));
    },

    async handleChannels(message, action, args) {
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ I need **Manage Channels** permission for channel operations!'
            });
        }

        switch (action) {
            case 'delete':
                return await this.deleteChannels(message, args);
            case 'list':
                return await this.listChannels(message, args);
            default:
                return await this.showChannelHelp(message);
        }
    },

    async deleteChannels(message, args) {
        if (!args.length) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Usage: `%bulk channels delete <pattern|category|type>`'
            });
        }

        let channelsToDelete = [];
        let description = '';

        if (args[0] === 'category' && args[1]) {
            const categoryName = args.slice(1).join(' ');
            const category = message.guild.channels.cache.find(ch => 
                ch.type === ChannelType.GuildCategory && 
                ch.name.toLowerCase().includes(categoryName.toLowerCase())
            );
            
            if (!category) {
                return await sendAsFloofWebhook(message, {
                    content: `❌ Category "${categoryName}" not found.`
                });
            }
            
            channelsToDelete = message.guild.channels.cache.filter(ch => ch.parentId === category.id).map(ch => ch);
            channelsToDelete.push(category);
            description = `Delete category "${category.name}" and all its channels`;
        } else if (args[0] === 'type' && args[1]) {
            const type = args[1].toLowerCase();
            const channelType = type === 'text' ? ChannelType.GuildText : 
                              type === 'voice' ? ChannelType.GuildVoice : null;
            
            if (!channelType) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Invalid type. Use: `text` or `voice`'
                });
            }
            
            channelsToDelete = message.guild.channels.cache.filter(ch => ch.type === channelType).map(ch => ch);
            description = `Delete all ${type} channels`;
        } else {
            const pattern = args.join(' ');
            channelsToDelete = message.guild.channels.cache.filter(ch => 
                ch.name.toLowerCase().includes(pattern.toLowerCase())
            ).map(ch => ch);
            description = `Delete channels containing "${pattern}"`;
        }

        // Safety filter - don't delete current channel or system channels
        const safeChannels = channelsToDelete.filter(ch => 
            ch.id !== message.channel.id && 
            !ch.name.toLowerCase().includes('general') &&
            !ch.name.toLowerCase().includes('rules')
        );

        if (safeChannels.length === 0) {
            return await sendAsFloofWebhook(message, {
                content: '❌ No safe channels found to delete.'
            });
        }

        return await this.confirmBulkDeletion(message, 'channels', safeChannels, description, this.executeChannelDeletion.bind(this));
    },

    async handleEmojis(message, action, args) {
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ I need **Manage Emojis and Stickers** permission!'
            });
        }

        switch (action) {
            case 'delete':
                return await this.deleteEmojis(message, args);
            case 'list':
                return await this.listEmojis(message);
            default:
                return await this.showEmojiHelp(message);
        }
    },

    // Message management removed; use %purge for deletions

    // Helper functions
    getSafeRoles(guild) {
        const protectedNames = ['everyone', 'admin', 'moderator', 'owner', 'floof', 'bot'];
        return guild.roles.cache.filter(role => 
            !protectedNames.some(name => role.name.toLowerCase().includes(name)) &&
            !role.managed && 
            role.id !== guild.id &&
            role.position < guild.members.me.roles.highest.position
        ).map(role => role);
    },

    getRolesByPattern(guild, pattern) {
        return guild.roles.cache.filter(role => 
            role.name.toLowerCase().includes(pattern.toLowerCase()) &&
            !role.managed &&
            role.id !== guild.id // Don't delete @everyone
        ).map(role => role);
    },

    getRolesByRange(guild, start, end) {
        return guild.roles.cache.filter(role => {
            const match = role.name.match(/(\d+)/);
            if (match) {
                const level = parseInt(match[1]);
                return level >= start && level <= end && !role.managed && role.id !== guild.id;
            }
            return false;
        }).map(role => role);
    },

    async assignRoleToAll(message, args) {
        if (!args.length) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Usage: `%bulk roles assign <@role|roleId|name> [--include-bots]`'
            });
        }
        // Parse options
        const includeBots = args.some(a => a.toLowerCase() === '--include-bots');
        const roleArg = args.filter(a => !a.startsWith('--')).join(' ');

        // Resolve role
        let role = null;
        const mentionMatch = roleArg.match(/\d{5,}/);
        if (message.mentions.roles.size > 0) {
            role = message.mentions.roles.first();
        } else if (mentionMatch) {
            role = message.guild.roles.cache.get(mentionMatch[0]);
        } else {
            role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
        }
        if (!role) {
            return await sendAsFloofWebhook(message, { content: '❌ Role not found. Mention it, use its ID, or exact name.' });
        }
        if (role.managed || role.id === message.guild.id) {
            return await sendAsFloofWebhook(message, { content: '❌ Cannot assign managed roles or @everyone.' });
        }
        // Check hierarchy
        const me = message.guild.members.me;
        if (role.position >= me.roles.highest.position) {
            return await sendAsFloofWebhook(message, { content: '❌ That role is higher or equal to my highest role.' });
        }

        // Fetch members (ensure full list)
        const allMembers = await message.guild.members.fetch();
        // Build target set
        const targets = Array.from(allMembers.values()).filter(m => {
            if (!includeBots && m.user.bot) return false;
            if (m.roles.cache.has(role.id)) return false;
            // Skip if the member's highest role is above the role we can edit? Not necessary for assignment; bot hierarchy suffices.
            return true;
        });

        if (targets.length === 0) {
            return await sendAsFloofWebhook(message, { content: 'ℹ️ Everyone already has that role (or no eligible members found).' });
        }

        // Confirmation UI
        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Confirm Bulk Role Assignment')
            .setColor('#00AAFF')
            .setDescription([
                `Role: <@&${role.id}> (\`${role.id}\`)`,
                `Include bots: ${includeBots ? 'Yes' : 'No'}`,
                `Eligible members: **${targets.length}**`
            ].join('\n'));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_assign').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_assign').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        const prompt = await sendAsFloofWebhook(message, { embeds: [confirmEmbed], components: [row] });

        const collector = prompt.channel.createMessageComponentCollector({
            filter: i => ['confirm_assign', 'cancel_assign'].includes(i.customId) && i.user.id === message.author.id && i.message.id === prompt.id,
            time: 30000,
            max: 1
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(row.components[0]).setDisabled(true),
                ButtonBuilder.from(row.components[1]).setDisabled(true)
            );
            try { await prompt.edit({ components: [disabledRow] }); } catch {}

            if (interaction.customId === 'cancel_assign') {
                return await sendAsFloofWebhook(message, { content: '❌ Bulk assignment cancelled.' });
            }

            // Proceed with assignment
            let success = 0, failed = 0;
            const errors = [];
            const progress = new EmbedBuilder()
                .setTitle('🚧 Assigning Role...')
                .setColor('#00AAFF')
                .setDescription(`Processing 0/${targets.length}`);
            const progressMsg = await sendAsFloofWebhook(message, { embeds: [progress] });

            for (let i = 0; i < targets.length; i++) {
                const m = targets[i];
                try {
                    await m.roles.add(role, `Bulk assign by ${message.author.tag}`);
                    success++;
                } catch (e) {
                    failed++;
                    if (errors.length < 5) errors.push(`${m.user.tag}: ${e.message}`);
                }
                if (i % 25 === 0 || i === targets.length - 1) {
                    const pct = Math.round(((i + 1) / targets.length) * 100);
                    const upd = new EmbedBuilder()
                        .setTitle('🚧 Assigning Role...')
                        .setColor('#00AAFF')
                        .setDescription(`Progress: ${i + 1}/${targets.length} (${pct}%)`);
                    try { await progressMsg.edit({ embeds: [upd] }); } catch {}
                }
                // soft rate-limit guard
                await new Promise(r => setTimeout(r, 200));
            }

            const done = new EmbedBuilder()
                .setTitle('✅ Bulk Role Assignment Complete')
                .setColor('#00FF00')
                .addFields({
                    name: '📊 Results',
                    value: [`Assigned: **${success}**`, `Failed: **${failed}**`, `Total: **${targets.length}**`].join('\n')
                });
            if (errors.length) {
                done.addFields({ name: '⚠️ Sample Errors', value: errors.join('\n') });
            }
            await sendAsFloofWebhook(message, { embeds: [done] });
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_assign').setLabel('Confirm').setStyle(ButtonStyle.Success).setDisabled(true),
                    new ButtonBuilder().setCustomId('cancel_assign').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                try { await prompt.edit({ components: [disabledRow] }); } catch {}
                await sendAsFloofWebhook(message, { content: '⏰ Confirmation timed out. Assignment cancelled.' });
            }
        });
    },

    async confirmBulkDeletion(message, type, items, description, executeFunction) {
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Confirm Bulk ${type.charAt(0).toUpperCase() + type.slice(1)} Deletion`)
            .setDescription(description)
            .setColor('#FF0000')
            .addFields(
                {
                    name: `🗑️ ${type.charAt(0).toUpperCase() + type.slice(1)} to Delete`,
                    value: items.length > 15 
                        ? `${items.slice(0, 15).map(item => item.name).join(', ')}... and ${items.length - 15} more`
                        : items.map(item => item.name).join(', '),
                    inline: false
                },
                {
                    name: '📊 Summary',
                    value: [
                        `**Total:** ${items.length} ${type}`,
                        `**Action:** Permanent deletion`,
                        `**Reversible:** No`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⚠️ **DANGER ZONE**',
                    value: [
                        '• This action cannot be undone',
                        '• All data will be permanently lost',
                        '• Click "Confirm" to proceed or "Cancel" to abort'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Use the buttons within 30 seconds to confirm' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_bulk').setLabel('Confirm').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_bulk').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        const confirmMessage = await sendAsFloofWebhook(message, { embeds: [embed], components: [row] });

        try {
            const collector = confirmMessage.channel.createMessageComponentCollector({
                filter: (i) => ['confirm_bulk', 'cancel_bulk'].includes(i.customId) && i.user.id === message.author.id && i.message.id === confirmMessage.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async (interaction) => {
                await interaction.deferUpdate();
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(row.components[0]).setDisabled(true),
                    ButtonBuilder.from(row.components[1]).setDisabled(true)
                );
                try {
                    await confirmMessage.edit({ components: [disabledRow] });
                } catch (error) {
                    // Ignore webhook message edit errors
                }

                if (interaction.customId === 'cancel_bulk') {
                    return await sendAsFloofWebhook(message, {
                        content: `❌ ${type.charAt(0).toUpperCase() + type.slice(1)} deletion cancelled.`
                    });
                }

                if (interaction.customId === 'confirm_bulk') {
                    return await executeFunction(message, items, type);
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    const disabledRow = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(row.components[0]).setDisabled(true),
                        ButtonBuilder.from(row.components[1]).setDisabled(true)
                    );
                    try {
                        await confirmMessage.edit({ components: [disabledRow] });
                    } catch (error) {
                        // Ignore webhook message edit errors
                    }
                    await sendAsFloofWebhook(message, {
                        content: `⏰ Confirmation timed out. ${type.charAt(0).toUpperCase() + type.slice(1)} deletion cancelled.`
                    });
                }
            });
        } catch (error) {
            return await sendAsFloofWebhook(message, {
                content: `⏰ Confirmation timed out. ${type.charAt(0).toUpperCase() + type.slice(1)} deletion cancelled.`
            });
        }
    },

    async executeRoleDeletion(message, roles, type) {
        const progressEmbed = new EmbedBuilder()
            .setTitle('🗑️ Deleting Roles...')
            .setDescription(`Deleting ${roles.length} roles. This may take a moment.`)
            .setColor('#FF6B6B');

        const progressMessage = await sendAsFloofWebhook(message, { embeds: [progressEmbed] });

        let deletedCount = 0;
        const errors = [];

        for (const role of roles) {
            try {
                await role.delete('Bulk deletion by Floof Bot');
                deletedCount++;

                if (deletedCount % 5 === 0) {
                    const updateEmbed = new EmbedBuilder()
                        .setTitle('🗑️ Deleting Roles...')
                        .setDescription(`Progress: ${deletedCount}/${roles.length} roles deleted`)
                        .setColor('#FF6B6B');
                    try {
                        await progressMessage.edit({ embeds: [updateEmbed] });
                    } catch (error) {
                        // Ignore webhook message edit errors
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit protection

            } catch (error) {
                errors.push(`${role.name}: ${error.message}`);
            }
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Bulk Role Deletion Complete')
            .setColor('#00FF00')
            .addFields({
                name: '📊 Results',
                value: [
                    `**Deleted:** ${deletedCount} roles`,
                    `**Failed:** ${errors.length} roles`,
                    `**Total:** ${roles.length} roles processed`
                ].join('\n')
            });

        if (errors.length > 0) {
            successEmbed.addFields({
                name: '⚠️ Errors',
                value: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : '')
            });
        }

        await sendAsFloofWebhook(message, { embeds: [successEmbed] });
    },

    async executeChannelDeletion(message, channels, type) {
        const progressEmbed = new EmbedBuilder()
            .setTitle('🗑️ Deleting Channels...')
            .setDescription(`Deleting ${channels.length} channels. This may take a moment.`)
            .setColor('#FF6B6B');

        const progressMessage = await sendAsFloofWebhook(message, { embeds: [progressEmbed] });

        let deletedCount = 0;
        const errors = [];

        for (const channel of channels) {
            try {
                await channel.delete('Bulk deletion by Floof Bot');
                deletedCount++;

                if (deletedCount % 3 === 0) {
                    const updateEmbed = new EmbedBuilder()
                        .setTitle('🗑️ Deleting Channels...')
                        .setDescription(`Progress: ${deletedCount}/${channels.length} channels deleted`)
                        .setColor('#FF6B6B');
                    await progressMessage.edit({ embeds: [updateEmbed] });
                }

                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit protection

            } catch (error) {
                errors.push(`${channel.name}: ${error.message}`);
            }
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Bulk Channel Deletion Complete')
            .setColor('#00FF00')
            .addFields({
                name: '📊 Results',
                value: [
                    `**Deleted:** ${deletedCount} channels`,
                    `**Failed:** ${errors.length} channels`,
                    `**Total:** ${channels.length} channels processed`
                ].join('\n')
            });

        if (errors.length > 0) {
            successEmbed.addFields({
                name: '⚠️ Errors',
                value: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : '')
            });
        }

        await progressMessage.edit({ embeds: [successEmbed] });
    }
};
