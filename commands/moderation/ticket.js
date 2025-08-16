const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

const ticketConfigPath = path.join(__dirname, '..', '..', 'data', 'ticket-config.json');

function loadTicketConfig() {
    if (!fs.existsSync(ticketConfigPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(ticketConfigPath, 'utf8'));
    } catch (error) {
        console.error('Error loading ticket config:', error);
        return {};
    }
}

function saveTicketConfig(config) {
    try {
        fs.writeFileSync(ticketConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving ticket config:', error);
    }
}

function getServerConfig(guildId) {
    const config = loadTicketConfig();
    return config[guildId] || {
        category: null,
        staffRole: null,
        logChannel: null,
        ticketCounter: 0,
        activeTickets: {}
    };
}

function saveServerConfig(guildId, serverConfig) {
    const config = loadTicketConfig();
    config[guildId] = serverConfig;
    saveTicketConfig(config);
}

module.exports = {
    name: 'ticket',
    aliases: ['support', 'help-ticket'],
    description: 'Manage support tickets - create, claim, close, and configure',
    usage: '%ticket <create|claim|close|setup|list>',
    category: 'moderation',
    permissions: [],
    cooldown: 5,

    async execute(message, args) {
        if (!args.length) {
            return this.showHelp(message);
        }

        const subcommand = args[0].toLowerCase();
        const serverConfig = getServerConfig(message.guild.id);

        switch (subcommand) {
            case 'create':
            case 'new':
                return this.createTicket(message, args.slice(1), serverConfig);
            case 'claim':
                return this.claimTicket(message, serverConfig);
            case 'close':
            case 'delete':
                return this.closeTicket(message, serverConfig);
            case 'setup':
            case 'config':
                return this.setupTickets(message, args.slice(1), serverConfig);
            case 'list':
                return this.listTickets(message, serverConfig);
            case 'transcript':
                return this.saveTranscript(message, serverConfig);
            default:
                return this.showHelp(message);
        }
    },

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket System')
            .setDescription('Support ticket management system')
            .setColor(0x00AE86)
            .addFields(
                {
                    name: '🎫 **User Commands**',
                    value: [
                        '`%ticket create [reason]` - Create a new support ticket',
                        '`%ticket close` - Close your ticket (in ticket channel)'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '👮 **Staff Commands**',
                    value: [
                        '`%ticket claim` - Claim a ticket (in ticket channel)',
                        '`%ticket list` - List all active tickets',
                        '`%ticket transcript` - Save ticket transcript',
                        '`%ticket setup` - Configure ticket system (admin)'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Use %ticket setup to configure the system first' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async createTicket(message, args, serverConfig) {
        if (!serverConfig.category) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Ticket system not configured. Ask an admin to run `%ticket setup`.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if user already has an active ticket
        const existingTicket = Object.values(serverConfig.activeTickets).find(t => t.userId === message.author.id);
        if (existingTicket) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ You already have an active ticket: <#${existingTicket.channelId}>`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reason = args.join(' ') || 'No reason provided';
        const ticketNumber = ++serverConfig.ticketCounter;
        
        try {
            // Create ticket channel
            const ticketChannel = await message.guild.channels.create({
                name: `ticket-${ticketNumber}-${message.author.username}`,
                type: ChannelType.GuildText,
                parent: serverConfig.category,
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: message.author.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            // Add staff role permissions if configured
            if (serverConfig.staffRole) {
                await ticketChannel.permissionOverwrites.create(serverConfig.staffRole, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    ManageMessages: true
                });
            }

            // Store ticket info
            serverConfig.activeTickets[ticketChannel.id] = {
                ticketNumber,
                userId: message.author.id,
                channelId: ticketChannel.id,
                reason,
                createdAt: Date.now(),
                claimedBy: null
            };
            saveServerConfig(message.guild.id, serverConfig);

            // Create ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 Support Ticket #${ticketNumber}`)
                .setDescription(`**Created by:** ${message.author}\n**Reason:** ${reason}`)
                .setColor(0x00AE86)
                .addFields(
                    {
                        name: '📋 Instructions',
                        value: [
                            '• Please describe your issue in detail',
                            '• Staff will respond as soon as possible',
                            '• Use `%ticket close` to close this ticket'
                        ].join('\n')
                    }
                )
                .setFooter({ text: 'Ticket created' })
                .setTimestamp();

            const claimButton = new ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel('🛡️ Claim Ticket')
                .setStyle(ButtonStyle.Primary);

            const closeButton = new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('🔒 Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(claimButton, closeButton);

            await ticketChannel.send({
                content: `${message.author} ${serverConfig.staffRole ? `<@&${serverConfig.staffRole}>` : ''}`,
                embeds: [ticketEmbed],
                components: [row]
            });

            // Confirmation message
            const confirmEmbed = new EmbedBuilder()
                .setDescription(`✅ Ticket created: ${ticketChannel}`)
                .setColor(0x00FF00);
            
            return sendAsFloofWebhook(message, { embeds: [confirmEmbed] });

        } catch (error) {
            console.error('Error creating ticket:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ Failed to create ticket. Please check bot permissions.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    },

    async claimTicket(message, serverConfig) {
        const ticket = serverConfig.activeTickets[message.channel.id];
        if (!ticket) {
            const embed = new EmbedBuilder()
                .setDescription('❌ This is not a ticket channel.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) && 
            (!serverConfig.staffRole || !message.member.roles.cache.has(serverConfig.staffRole))) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need staff permissions to claim tickets.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (ticket.claimedBy) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ This ticket is already claimed by <@${ticket.claimedBy}>`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        ticket.claimedBy = message.author.id;
        saveServerConfig(message.guild.id, serverConfig);

        const embed = new EmbedBuilder()
            .setDescription(`✅ Ticket claimed by ${message.author}`)
            .setColor(0x00FF00)
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async closeTicket(message, serverConfig) {
        const ticket = serverConfig.activeTickets[message.channel.id];
        if (!ticket) {
            const embed = new EmbedBuilder()
                .setDescription('❌ This is not a ticket channel.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check permissions
        const isOwner = ticket.userId === message.author.id;
        const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                       (serverConfig.staffRole && message.member.roles.cache.has(serverConfig.staffRole));

        if (!isOwner && !isStaff) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Only the ticket owner or staff can close tickets.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Save transcript if log channel exists
        if (serverConfig.logChannel) {
            try {
                await this.saveTranscriptToLog(message, ticket, serverConfig);
            } catch (error) {
                console.error('Error saving transcript:', error);
            }
        }

        // Remove from active tickets
        delete serverConfig.activeTickets[message.channel.id];
        saveServerConfig(message.guild.id, serverConfig);

        const embed = new EmbedBuilder()
            .setDescription(`🔒 Ticket closed by ${message.author}. Channel will be deleted in 5 seconds.`)
            .setColor(0xFF6B6B);

        await sendAsFloofWebhook(message, { embeds: [embed] });

        // Delete channel after delay
        setTimeout(async () => {
            try {
                await message.channel.delete('Ticket closed');
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    },

    async setupTickets(message, args, serverConfig) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need Administrator permission to setup tickets.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setTitle('🎫 Ticket Setup')
                .setDescription('Configure the ticket system for your server')
                .addFields(
                    {
                        name: '⚙️ Setup Commands',
                        value: [
                            '`%ticket setup category <category-name>` - Set ticket category',
                            '`%ticket setup staff <@role>` - Set staff role',
                            '`%ticket setup log <#channel>` - Set log channel',
                            '`%ticket setup view` - View current settings'
                        ].join('\n')
                    }
                )
                .setColor(0x7289DA);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const setting = args[0].toLowerCase();

        switch (setting) {
            case 'category':
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Please provide a category name or ID.\n**Usage:** `%ticket setup category <category-name-or-id>`')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }

                // Try to find category by name or ID
                const categoryInput = args.slice(1).join(' ');
                let category = message.guild.channels.cache.find(ch => 
                    ch.type === ChannelType.GuildCategory && 
                    (ch.name.toLowerCase() === categoryInput.toLowerCase() || ch.id === categoryInput)
                );

                if (!category) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Category not found. Please provide a valid category name or ID.\n**Usage:** `%ticket setup category <category-name-or-id>`')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                serverConfig.category = category.id;
                saveServerConfig(message.guild.id, serverConfig);
                
                const categoryEmbed = new EmbedBuilder()
                    .setDescription(`✅ Ticket category set to ${category}`)
                    .setColor(0x00FF00);
                return sendAsFloofWebhook(message, { embeds: [categoryEmbed] });

            case 'staff':
                const role = message.mentions.roles.first();
                if (!role) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Please mention a valid role.')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                serverConfig.staffRole = role.id;
                saveServerConfig(message.guild.id, serverConfig);
                
                const roleEmbed = new EmbedBuilder()
                    .setDescription(`✅ Staff role set to ${role}`)
                    .setColor(0x00FF00);
                return sendAsFloofWebhook(message, { embeds: [roleEmbed] });

            case 'log':
                const logChannel = message.mentions.channels.first();
                if (!logChannel || logChannel.type !== ChannelType.GuildText) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Please mention a valid text channel.')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                serverConfig.logChannel = logChannel.id;
                saveServerConfig(message.guild.id, serverConfig);
                
                const logEmbed = new EmbedBuilder()
                    .setDescription(`✅ Log channel set to ${logChannel}`)
                    .setColor(0x00FF00);
                return sendAsFloofWebhook(message, { embeds: [logEmbed] });

            case 'view':
                const viewEmbed = new EmbedBuilder()
                    .setTitle('🎫 Current Ticket Settings')
                    .addFields(
                        {
                            name: 'Category',
                            value: serverConfig.category ? `<#${serverConfig.category}>` : 'Not set',
                            inline: true
                        },
                        {
                            name: 'Staff Role',
                            value: serverConfig.staffRole ? `<@&${serverConfig.staffRole}>` : 'Not set',
                            inline: true
                        },
                        {
                            name: 'Log Channel',
                            value: serverConfig.logChannel ? `<#${serverConfig.logChannel}>` : 'Not set',
                            inline: true
                        },
                        {
                            name: 'Active Tickets',
                            value: Object.keys(serverConfig.activeTickets).length.toString(),
                            inline: true
                        }
                    )
                    .setColor(0x7289DA);
                return sendAsFloofWebhook(message, { embeds: [viewEmbed] });
        }
    },

    async listTickets(message, serverConfig) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) && 
            (!serverConfig.staffRole || !message.member.roles.cache.has(serverConfig.staffRole))) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need staff permissions to list tickets.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const activeTickets = Object.values(serverConfig.activeTickets);
        
        if (activeTickets.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('✅ No active tickets.')
                .setColor(0x00FF00);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const ticketList = activeTickets.map(ticket => {
            const claimed = ticket.claimedBy ? `👮 <@${ticket.claimedBy}>` : '⏳ Unclaimed';
            const age = Math.floor((Date.now() - ticket.createdAt) / (1000 * 60));
            return `**#${ticket.ticketNumber}** <#${ticket.channelId}>\n` +
                   `👤 <@${ticket.userId}> • ${claimed} • ${age}m ago`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`🎫 Active Tickets (${activeTickets.length})`)
            .setDescription(ticketList)
            .setColor(0x7289DA);

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async saveTranscriptToLog(message, ticket, serverConfig) {
        const logChannel = message.guild.channels.cache.get(serverConfig.logChannel);
        if (!logChannel) return;

        const messages = await message.channel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(msg => 
            `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`📋 Ticket #${ticket.ticketNumber} Transcript`)
            .setDescription(`**User:** <@${ticket.userId}>\n**Claimed by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'None'}\n**Reason:** ${ticket.reason}`)
            .setColor(0x7289DA)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        
        // Send transcript as file if it's long
        if (transcript.length > 1000) {
            const buffer = Buffer.from(transcript, 'utf8');
            await logChannel.send({
                files: [{
                    attachment: buffer,
                    name: `ticket-${ticket.ticketNumber}-transcript.txt`
                }]
            });
        }
    }
};

// Handle ticket button interactions
async function handleTicketInteraction(interaction) {
    const serverConfig = getServerConfig(interaction.guild.id);
    
    if (interaction.customId === 'ticket_claim') {
        // Check if user has staff role or manage channels permission
        const hasStaffRole = serverConfig.staffRole && interaction.member.roles.cache.has(serverConfig.staffRole);
        const hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
        
        if (!hasStaffRole && !hasPermission) {
            return interaction.reply({ 
                content: '❌ You need staff permissions to claim tickets.', 
                ephemeral: true 
            });
        }

        // Update ticket as claimed
        if (!serverConfig.activeTickets[interaction.channel.id]) {
            return interaction.reply({ 
                content: '❌ This ticket is not in the system.', 
                ephemeral: true 
            });
        }

        serverConfig.activeTickets[interaction.channel.id].claimedBy = interaction.user.id;
        saveServerConfig(interaction.guild.id, serverConfig);

        const embed = new EmbedBuilder()
            .setDescription(`✅ Ticket claimed by ${interaction.user}`)
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.update({ 
            embeds: [embed],
            components: [] // Remove buttons after claiming
        });

        // Update channel name to show claimed status
        await interaction.channel.setName(`ticket-${serverConfig.activeTickets[interaction.channel.id].ticketNumber}-claimed`);
        
    } else if (interaction.customId === 'ticket_close') {
        // Check if user is ticket creator, has staff role, or manage channels permission
        const ticketData = serverConfig.activeTickets[interaction.channel.id];
        const isCreator = ticketData && ticketData.userId === interaction.user.id;
        const hasStaffRole = serverConfig.staffRole && interaction.member.roles.cache.has(serverConfig.staffRole);
        const hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
        
        if (!isCreator && !hasStaffRole && !hasPermission) {
            return interaction.reply({ 
                content: '❌ You can only close your own tickets or need staff permissions.', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setDescription(`🔒 Ticket closed by ${interaction.user}\nThis channel will be deleted in 10 seconds.`)
            .setColor(0xFF0000)
            .setTimestamp();

        await interaction.update({ 
            embeds: [embed],
            components: [] 
        });

        // Log ticket closure if log channel is set
        if (serverConfig.logChannel) {
            const logChannel = interaction.guild.channels.cache.get(serverConfig.logChannel);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🎫 Ticket Closed')
                    .addFields(
                        { name: 'Ticket', value: `#${interaction.channel.name}`, inline: true },
                        { name: 'Closed by', value: `${interaction.user}`, inline: true },
                        { name: 'Created by', value: `<@${ticketData?.userId}>`, inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        }

        // Remove from active tickets
        if (ticketData) {
            delete serverConfig.activeTickets[interaction.channel.id];
            saveServerConfig(interaction.guild.id, serverConfig);
        }

        // Delete channel after 10 seconds
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 10000);
    }
}

module.exports.handleTicketInteraction = handleTicketInteraction;
