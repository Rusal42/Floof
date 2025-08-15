const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

// Helper functions for voice channel management
function getVoiceData() {
    const voiceDataPath = path.join(__dirname, '..', '..', 'voice-channels.json');
    if (fs.existsSync(voiceDataPath)) {
        return JSON.parse(fs.readFileSync(voiceDataPath, 'utf8'));
    }
    return {};
}

function saveVoiceData(data) {
    const voiceDataPath = path.join(__dirname, '..', '..', 'voice-channels.json');
    fs.writeFileSync(voiceDataPath, JSON.stringify(data, null, 2));
}

function isChannelOwner(channelId, userId) {
    const voiceData = getVoiceData();
    return voiceData[channelId] === userId;
}

module.exports = {
    name: 'voice',
    description: 'Voice channel management interface and commands',
    usage: '%voice [name/reject/allow/limit/transfer] [arguments]',
    category: 'general',
    aliases: ['vc', 'voicemaster'],
    cooldown: 3,

    async execute(message, args) {
        try {
            const voiceChannel = message.member.voice.channel;
            const subcommand = args[0]?.toLowerCase();

            // Handle subcommands
            if (subcommand) {
                return await this.handleSubcommand(message, args, voiceChannel);
            }

            // Show interface if no subcommand
            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('🎤 VoiceMaster Interface')
                .setDescription('Use buttons below or commands for advanced control.')
                .addFields(
                    {
                        name: '📋 **Button Controls**',
                        value: [
                            '➕ **Create** - Create your own temporary voice channel',
                            '🔒 **Lock** - Lock the voice channel',
                            '🔓 **Unlock** - Unlock the voice channel', 
                            '👁️ **Ghost** - Hide the voice channel',
                            '👻 **Reveal** - Show the voice channel',
                            '🔗 **Disconnect** - Disconnect a member',
                            '⭐ **Start** - Start an activity',
                            'ℹ️ **View** - View channel information',
                            '⬆️ **Increase** - Increase user limit',
                            '⬇️ **Decrease** - Decrease user limit'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '⌨️ **Advanced Commands**',
                        value: [
                            '`%vc name <new name>` - Rename your voice channel',
                            '`%vc reject @user` - Kick & ban user from your channel',
                            '`%vc allow @user` - Unban user from your channel',
                            '`%vc limit <number>` - Set user limit (0 = unlimited)',
                            '`%vc transfer @user` - Transfer ownership to another user'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: voiceChannel ? `Currently in: ${voiceChannel.name}` : 'Create or join a voice channel to use controls',
                    iconURL: message.client.user.displayAvatarURL({ dynamic: true })
                });

            // Create button rows
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('voice_create')
                        .setLabel('Create')
                        .setEmoji('➕')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('voice_lock')
                        .setLabel('Lock')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('voice_unlock')
                        .setLabel('Unlock')
                        .setEmoji('🔓')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('voice_ghost')
                        .setLabel('Ghost')
                        .setEmoji('👁️')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('voice_reveal')
                        .setLabel('Reveal')
                        .setEmoji('👻')
                        .setStyle(ButtonStyle.Secondary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('voice_disconnect')
                        .setLabel('Disconnect')
                        .setEmoji('🔗')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('voice_start')
                        .setLabel('Start')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('voice_view')
                        .setLabel('View')
                        .setEmoji('ℹ️')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('voice_increase')
                        .setLabel('Increase')
                        .setEmoji('⬆️')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('voice_decrease')
                        .setLabel('Decrease')
                        .setEmoji('⬇️')
                        .setStyle(ButtonStyle.Danger)
                );

            await sendAsFloofWebhook(message, {
                embeds: [embed],
                components: [row1, row2]
            });

        } catch (error) {
            console.error('Voice command error:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Something went wrong with the voice interface.'
            });
        }
    },

    async handleSubcommand(message, args, voiceChannel) {
        const subcommand = args[0].toLowerCase();
        
        // Check if user is in a voice channel for most commands
        if (!voiceChannel && subcommand !== 'help') {
            return await sendAsFloofWebhook(message, {
                content: '❌ You must be in a voice channel to use voice commands!'
            });
        }

        // Check if user owns the voice channel (except for help)
        if (subcommand !== 'help' && !isChannelOwner(voiceChannel.id, message.author.id) && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Only the channel owner or users with Manage Channels permission can use voice commands!'
            });
        }

        switch (subcommand) {
            case 'help':
                return await this.handleHelpCommand(message);
            case 'name':
                return await this.handleNameCommand(message, args, voiceChannel);
            case 'reject':
                return await this.handleRejectCommand(message, args, voiceChannel);
            case 'allow':
                return await this.handleAllowCommand(message, args, voiceChannel);
            case 'limit':
                return await this.handleLimitCommand(message, args, voiceChannel);
            case 'transfer':
                return await this.handleTransferCommand(message, args, voiceChannel);
            default:
                return await sendAsFloofWebhook(message, {
                    content: '❌ Unknown voice command! Use `%vc help` to see all available commands.'
                });
        }
    },

    async handleHelpCommand(message) {
        const embed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle('🎤 VoiceMaster Help')
            .setDescription('Complete guide to voice channel management commands and features.')
            .addFields(
                {
                    name: '🎯 **Getting Started**',
                    value: [
                        '• Use `%vc` to open the button interface',
                        '• Click **Create** to make your own temporary voice channel',
                        '• Only channel owners can use management commands',
                        '• Channels auto-delete when empty'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⌨️ **Text Commands**',
                    value: [
                        '`%vc name <new name>` - Rename your voice channel',
                        '`%vc reject @user` - Kick & ban user from your channel',
                        '`%vc allow @user` - Unban user from your channel',
                        '`%vc limit <number>` - Set user limit (0 = unlimited)',
                        '`%vc transfer @user` - Transfer ownership to another user',
                        '`%vc help` - Show this help message'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🎮 **Button Controls**',
                    value: [
                        '➕ **Create** - Create temporary voice channel',
                        '🔒 **Lock/Unlock** - Control who can join',
                        '👁️ **Ghost/Reveal** - Hide/show channel',
                        '🔗 **Disconnect** - Remove all other users',
                        'ℹ️ **View** - Show channel information',
                        '⬆️⬇️ **Increase/Decrease** - Adjust user limit'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🔐 **Permissions**',
                    value: [
                        '• **Channel Owner**: Full control over their temporary channel',
                        '• **Manage Channels**: Can control any voice channel',
                        '• **Regular Users**: Can only use Create button',
                        '• **Auto-cleanup**: Empty channels delete automatically'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💡 **Pro Tips**',
                    value: [
                        '• Use `reject` to permanently ban troublemakers',
                        '• Use `allow` to unban previously rejected users',
                        '• Transfer ownership before leaving your channel',
                        '• Set limits to control channel size',
                        '• Rename channels for events or activities'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ 
                text: 'VoiceMaster • Use %vc to get started',
                iconURL: message.client.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async handleNameCommand(message, args, voiceChannel) {
        if (args.length < 2) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a new name! Usage: `%vc name <new name>`'
            });
        }

        const newName = args.slice(1).join(' ');
        if (newName.length > 100) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Channel name must be 100 characters or less!'
            });
        }

        try {
            await voiceChannel.setName(newName);
            await sendAsFloofWebhook(message, {
                content: `✅ Renamed voice channel to **${newName}**!`
            });
        } catch (error) {
            console.error('Error renaming voice channel:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to rename channel. Make sure the name is valid!'
            });
        }
    },

    async handleRejectCommand(message, args, voiceChannel) {
        if (!message.mentions.users.size) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please mention a user to reject! Usage: `%vc reject @user`'
            });
        }

        const targetUser = message.mentions.users.first();
        const targetMember = message.guild.members.cache.get(targetUser.id);

        if (!targetMember) {
            return await sendAsFloofWebhook(message, {
                content: '❌ User not found in this server!'
            });
        }

        if (targetMember.id === message.author.id) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You cannot reject yourself!'
            });
        }

        try {
            // Disconnect user if they're in the voice channel
            if (targetMember.voice.channel?.id === voiceChannel.id) {
                await targetMember.voice.disconnect();
            }

            // Deny connect permission for this user
            await voiceChannel.permissionOverwrites.edit(targetMember, {
                Connect: false
            });

            await sendAsFloofWebhook(message, {
                content: `🚫 **${targetMember.displayName}** has been rejected from **${voiceChannel.name}**!`
            });
        } catch (error) {
            console.error('Error rejecting user:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to reject user. Check bot permissions!'
            });
        }
    },

    async handleAllowCommand(message, args, voiceChannel) {
        if (!message.mentions.users.size) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please mention a user to allow! Usage: `%vc allow @user`'
            });
        }

        const targetUser = message.mentions.users.first();
        const targetMember = message.guild.members.cache.get(targetUser.id);

        if (!targetMember) {
            return await sendAsFloofWebhook(message, {
                content: '❌ User not found in this server!'
            });
        }

        try {
            // Remove the deny permission (allow them to connect)
            await voiceChannel.permissionOverwrites.edit(targetMember, {
                Connect: null
            });

            await sendAsFloofWebhook(message, {
                content: `✅ **${targetMember.displayName}** is now allowed to join **${voiceChannel.name}**!`
            });
        } catch (error) {
            console.error('Error allowing user:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to allow user. Check bot permissions!'
            });
        }
    },

    async handleLimitCommand(message, args, voiceChannel) {
        if (args.length < 2) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a user limit! Usage: `%vc limit <number>` (0 = unlimited)'
            });
        }

        const limit = parseInt(args[1]);
        if (isNaN(limit) || limit < 0 || limit > 99) {
            return await sendAsFloofWebhook(message, {
                content: '❌ User limit must be a number between 0-99! (0 = unlimited)'
            });
        }

        try {
            await voiceChannel.setUserLimit(limit);
            await sendAsFloofWebhook(message, {
                content: `✅ Set user limit to ${limit === 0 ? 'unlimited' : limit} for **${voiceChannel.name}**!`
            });
        } catch (error) {
            console.error('Error setting user limit:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to set user limit!'
            });
        }
    },

    async handleTransferCommand(message, args, voiceChannel) {
        if (!message.mentions.users.size) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please mention a user to transfer ownership to! Usage: `%vc transfer @user`'
            });
        }

        const targetUser = message.mentions.users.first();
        const targetMember = message.guild.members.cache.get(targetUser.id);

        if (!targetMember) {
            return await sendAsFloofWebhook(message, {
                content: '❌ User not found in this server!'
            });
        }

        if (targetMember.id === message.author.id) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You already own this channel!'
            });
        }

        try {
            // Update ownership in data
            const voiceData = getVoiceData();
            voiceData[voiceChannel.id] = targetMember.id;
            saveVoiceData(voiceData);

            // Give new owner manage permissions
            await voiceChannel.permissionOverwrites.edit(targetMember, {
                ManageChannels: true,
                MoveMembers: true
            });

            // Remove old owner's special permissions
            await voiceChannel.permissionOverwrites.edit(message.member, {
                ManageChannels: null,
                MoveMembers: null
            });

            await sendAsFloofWebhook(message, {
                content: `✅ Transferred ownership of **${voiceChannel.name}** to **${targetMember.displayName}**!`
            });
        } catch (error) {
            console.error('Error transferring ownership:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to transfer ownership!'
            });
        }
    }
};
