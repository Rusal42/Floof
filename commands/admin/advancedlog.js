const { PermissionsBitField, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');
const { requirePerms } = require('../../utils/permissions');

const logConfigPath = path.join(__dirname, '../../data/advanced-log-config.json');

function loadLogConfig() {
    if (!fs.existsSync(logConfigPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(logConfigPath, 'utf8'));
    } catch (error) {
        console.error('Error loading log config:', error);
        return {};
    }
}

function saveLogConfig(config) {
    try {
        // Ensure data directory exists
        fs.mkdirSync(path.dirname(logConfigPath), { recursive: true });
        fs.writeFileSync(logConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving log config:', error);
    }
}

function getServerLogConfig(guildId) {
    const config = loadLogConfig();
    return config[guildId] || {
        messageLog: null,
        memberLog: null,
        voiceLog: null,
        roleLog: null,
        channelLog: null,
        serverLog: null,
        enabled: {
            messageEdit: true,
            messageDelete: true,
            memberJoin: true,
            memberLeave: true,
            memberUpdate: true,
            voiceJoin: true,
            voiceLeave: true,
            voiceMove: true,
            roleCreate: true,
            roleDelete: true,
            roleUpdate: true,
            channelCreate: true,
            channelDelete: true,
            channelUpdate: true
        }
    };
}

function saveServerLogConfig(guildId, config) {
    const allConfigs = loadLogConfig();
    allConfigs[guildId] = config;
    saveLogConfig(allConfigs);
}

module.exports = {
    name: 'advancedlog',
    aliases: ['alog', 'logging', 'al', 'logs'],
    description: 'Configure advanced logging for all server events',
    usage: '%advancedlog <setup|toggle|view>',
    category: 'moderation',
    permissions: [PermissionsBitField.Flags.ManageGuild],
    cooldown: 5,

    async execute(message, args) {
        const ok = await requirePerms(message, PermissionsBitField.Flags.ManageGuild, 'configure logging');
        if (!ok) return;

        if (!args.length) {
            return this.showHelp(message);
        }

        const subcommand = args[0].toLowerCase();
        const logConfig = getServerLogConfig(message.guild.id);

        switch (subcommand) {
            case 'setup':
            case 'config':
                return this.setupLogging(message, args.slice(1), logConfig);
            case 'toggle':
            case 'enable':
            case 'disable':
                return this.toggleLogging(message, args.slice(1), logConfig);
            case 'view':
            case 'status':
                return this.viewConfig(message, logConfig);
            case 'test':
                return this.testLogging(message, logConfig);
            default:
                return this.showHelp(message);
        }
    },

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Advanced Logging System')
            .setDescription('Comprehensive logging for all server events')
            .setColor(0x7289DA)
            .addFields(
                {
                    name: '⚙️ **Setup Commands**',
                    value: [
                        '`%alog setup message <#channel>` - Set message log channel',
                        '`%alog setup member <#channel>` - Set member log channel',
                        '`%alog setup voice <#channel>` - Set voice log channel',
                        '`%alog setup role <#channel>` - Set role log channel',
                        '`%alog setup channel <#channel>` - Set channel log channel',
                        '`%alog setup server <#channel>` - Set server log channel'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🔧 **Control Commands**',
                    value: [
                        '`%alog toggle <event>` - Toggle specific event logging',
                        '`%alog view` - View current configuration',
                        '`%alog test` - Test logging system'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Events: messageEdit, messageDelete, memberJoin, memberLeave, voiceJoin, etc.' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setupLogging(message, args, logConfig) {
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%alog setup <type> <#channel>`\nTypes: message, member, voice, role, channel, server')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const type = args[0].toLowerCase();
        const channel = message.mentions.channels.first();

        if (!channel) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please mention a valid channel.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const validTypes = ['message', 'member', 'voice', 'role', 'channel', 'server'];
        if (!validTypes.includes(type)) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ Invalid type. Valid types: ${validTypes.join(', ')}`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        logConfig[`${type}Log`] = channel.id;
        saveServerLogConfig(message.guild.id, logConfig);

        const embed = new EmbedBuilder()
            .setDescription(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} logging set to ${channel}`)
            .setColor(0x00FF00);

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async toggleLogging(message, args, logConfig) {
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please specify an event to toggle.\nEvents: messageEdit, messageDelete, memberJoin, memberLeave, voiceJoin, etc.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const event = args[0].toLowerCase();
        
        if (!logConfig.enabled.hasOwnProperty(event)) {
            const availableEvents = Object.keys(logConfig.enabled).join(', ');
            const embed = new EmbedBuilder()
                .setDescription(`❌ Invalid event. Available events: ${availableEvents}`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        logConfig.enabled[event] = !logConfig.enabled[event];
        saveServerLogConfig(message.guild.id, logConfig);

        const status = logConfig.enabled[event] ? 'enabled' : 'disabled';
        const color = logConfig.enabled[event] ? 0x00FF00 : 0xFF6B6B;

        const embed = new EmbedBuilder()
            .setDescription(`${logConfig.enabled[event] ? '✅' : '❌'} ${event} logging ${status}`)
            .setColor(color);

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async viewConfig(message, logConfig) {
        const guild = message.guild;
        
        const channelInfo = (channelId) => {
            if (!channelId) return 'Not set';
            const channel = guild.channels.cache.get(channelId);
            return channel ? `${channel}` : 'Invalid channel';
        };

        const enabledEvents = Object.entries(logConfig.enabled)
            .filter(([, enabled]) => enabled)
            .map(([event]) => event)
            .join(', ') || 'None';

        const disabledEvents = Object.entries(logConfig.enabled)
            .filter(([, enabled]) => !enabled)
            .map(([event]) => event)
            .join(', ') || 'None';

        const embed = new EmbedBuilder()
            .setTitle(`📋 ${guild.name} Logging Configuration`)
            .setColor(0x7289DA)
            .addFields(
                {
                    name: '📺 **Log Channels**',
                    value: [
                        `**Message Log:** ${channelInfo(logConfig.messageLog)}`,
                        `**Member Log:** ${channelInfo(logConfig.memberLog)}`,
                        `**Voice Log:** ${channelInfo(logConfig.voiceLog)}`,
                        `**Role Log:** ${channelInfo(logConfig.roleLog)}`,
                        `**Channel Log:** ${channelInfo(logConfig.channelLog)}`,
                        `**Server Log:** ${channelInfo(logConfig.serverLog)}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '✅ **Enabled Events**',
                    value: enabledEvents,
                    inline: false
                },
                {
                    name: '❌ **Disabled Events**',
                    value: disabledEvents,
                    inline: false
                }
            )
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async testLogging(message, logConfig) {
        const testEmbed = new EmbedBuilder()
            .setTitle('🧪 Logging System Test')
            .setDescription('This is a test message to verify logging is working correctly.')
            .setColor(0xFFD700)
            .addFields(
                {
                    name: 'Test Info',
                    value: [
                        `**Triggered by:** ${message.author}`,
                        `**Channel:** ${message.channel}`,
                        `**Time:** ${new Date().toLocaleString()}`
                    ].join('\n')
                }
            )
            .setTimestamp();

        // Send test to all configured log channels
        const channels = [
            { name: 'Message Log', id: logConfig.messageLog },
            { name: 'Member Log', id: logConfig.memberLog },
            { name: 'Voice Log', id: logConfig.voiceLog },
            { name: 'Role Log', id: logConfig.roleLog },
            { name: 'Channel Log', id: logConfig.channelLog },
            { name: 'Server Log', id: logConfig.serverLog }
        ];

        let sentCount = 0;
        for (const { name, id } of channels) {
            if (id) {
                const channel = message.guild.channels.cache.get(id);
                if (channel) {
                    try {
                        await channel.send({ embeds: [testEmbed] });
                        sentCount++;
                    } catch (error) {
                        console.error(`Failed to send test to ${name}:`, error);
                    }
                }
            }
        }

        const resultEmbed = new EmbedBuilder()
            .setDescription(`✅ Test completed. Sent to ${sentCount} log channels.`)
            .setColor(0x00FF00);

        return sendAsFloofWebhook(message, { embeds: [resultEmbed] });
    },

    // Event handlers for the logging system
    async logMessageDelete(message, logConfig) {
        if (!logConfig.enabled.messageDelete || !logConfig.messageLog) return;
        
        const logChannel = message.guild.channels.cache.get(logConfig.messageLog);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor(0xFF6B6B)
            .addFields(
                {
                    name: 'Message Info',
                    value: [
                        `**Author:** ${message.author}`,
                        `**Channel:** ${message.channel}`,
                        `**Content:** ${message.content || 'No content (embed/file only)'}`,
                        `**Message ID:** ${message.id}`
                    ].join('\n')
                }
            )
            .setTimestamp();

        if (message.attachments.size > 0) {
            embed.addFields({
                name: 'Attachments',
                value: message.attachments.map(att => att.name).join(', ')
            });
        }

        await logChannel.send({ embeds: [embed] });
    },

    async logMessageEdit(oldMessage, newMessage, logConfig) {
        if (!logConfig.enabled.messageEdit || !logConfig.messageLog) return;
        if (oldMessage.content === newMessage.content) return;
        
        const logChannel = newMessage.guild.channels.cache.get(logConfig.messageLog);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('✏️ Message Edited')
            .setColor(0xFFD700)
            .addFields(
                {
                    name: 'Message Info',
                    value: [
                        `**Author:** ${newMessage.author}`,
                        `**Channel:** ${newMessage.channel}`,
                        `**Message ID:** ${newMessage.id}`
                    ].join('\n')
                },
                {
                    name: 'Before',
                    value: oldMessage.content || 'No content',
                    inline: false
                },
                {
                    name: 'After',
                    value: newMessage.content || 'No content',
                    inline: false
                }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    },

    async logMemberJoin(member, logConfig) {
        if (!logConfig.enabled.memberJoin || !logConfig.memberLog) return;
        
        const logChannel = member.guild.channels.cache.get(logConfig.memberLog);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📥 Member Joined')
            .setColor(0x00FF7F)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: 'User Info',
                    value: [
                        `**User:** ${member.user}`,
                        `**ID:** ${member.user.id}`,
                        `**Account Created:** ${member.user.createdAt.toLocaleDateString()}`,
                        `**Member Count:** ${member.guild.memberCount}`
                    ].join('\n')
                }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    },

    async logMemberLeave(member, logConfig) {
        if (!logConfig.enabled.memberLeave || !logConfig.memberLog) return;
        
        const logChannel = member.guild.channels.cache.get(logConfig.memberLog);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📤 Member Left')
            .setColor(0xFF6B6B)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: 'User Info',
                    value: [
                        `**User:** ${member.user}`,
                        `**ID:** ${member.user.id}`,
                        `**Joined:** ${member.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown'}`,
                        `**Member Count:** ${member.guild.memberCount}`
                    ].join('\n')
                }
            )
            .setTimestamp();

        if (member.roles.cache.size > 1) {
            const roles = member.roles.cache
                .filter(role => role.id !== member.guild.id)
                .map(role => role.name)
                .join(', ');
            embed.addFields({ name: 'Roles', value: roles });
        }

        await logChannel.send({ embeds: [embed] });
    },

    async logVoiceStateUpdate(oldState, newState, logConfig) {
        if (!logConfig.voiceLog) return;
        
        const logChannel = newState.guild.channels.cache.get(logConfig.voiceLog);
        if (!logChannel) return;

        let embed;
        
        // User joined a voice channel
        if (!oldState.channel && newState.channel && logConfig.enabled.voiceJoin) {
            embed = new EmbedBuilder()
                .setTitle('🔊 Voice Channel Joined')
                .setColor(0x00FF7F)
                .addFields({
                    name: 'Event Info',
                    value: [
                        `**User:** ${newState.member}`,
                        `**Channel:** ${newState.channel}`,
                        `**Time:** ${new Date().toLocaleString()}`
                    ].join('\n')
                })
                .setTimestamp();
        }
        // User left a voice channel
        else if (oldState.channel && !newState.channel && logConfig.enabled.voiceLeave) {
            embed = new EmbedBuilder()
                .setTitle('🔇 Voice Channel Left')
                .setColor(0xFF6B6B)
                .addFields({
                    name: 'Event Info',
                    value: [
                        `**User:** ${oldState.member}`,
                        `**Channel:** ${oldState.channel}`,
                        `**Time:** ${new Date().toLocaleString()}`
                    ].join('\n')
                })
                .setTimestamp();
        }
        // User moved between voice channels
        else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id && logConfig.enabled.voiceMove) {
            embed = new EmbedBuilder()
                .setTitle('🔄 Voice Channel Moved')
                .setColor(0xFFD700)
                .addFields({
                    name: 'Event Info',
                    value: [
                        `**User:** ${newState.member}`,
                        `**From:** ${oldState.channel}`,
                        `**To:** ${newState.channel}`,
                        `**Time:** ${new Date().toLocaleString()}`
                    ].join('\n')
                })
                .setTimestamp();
        }

        if (embed) {
            await logChannel.send({ embeds: [embed] });
        }
    }
};
