const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

// Helper functions for voice config management
function getVoiceConfig() {
    const configPath = path.join(__dirname, '..', '..', 'data', 'voice-config.json');
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return {};
}

function saveVoiceConfig(data) {
    const configPath = path.join(__dirname, '..', '..', 'data', 'voice-config.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

module.exports = {
    name: 'vcconfig',
    description: 'Configure voice channel creation settings',
    usage: '%vcconfig [set/clear/view/setlobby/clearlobby]',
    category: 'general',
    aliases: ['voiceconfig', 'vcc', 'vc'],
    cooldown: 5,

    async execute(message, args) {
        // Check if user has manage channels permission
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You need **Manage Channels** permission to configure voice channel settings!'
            });
        }

        const subcommand = args[0]?.toLowerCase();
        const guildId = message.guild.id;

        switch (subcommand) {
            case 'set':
                return await this.handleSetCommand(message, guildId);
            case 'clear':
                return await this.handleClearCommand(message, guildId);
            case 'setlobby':
                return await this.handleSetLobbyCommand(message, guildId);
            case 'clearlobby':
                return await this.handleClearLobbyCommand(message, guildId);
            case 'view':
            default:
                return await this.handleViewCommand(message, guildId);
        }
    },

    async handleSetCommand(message, guildId) {
        // Check if user is in a voice channel
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You must be in a voice channel to set the voice channel category!'
            });
        }

        // Check if the voice channel is in a category
        if (!voiceChannel.parent) {
            return await sendAsFloofWebhook(message, {
                content: '❌ The voice channel must be in a category to set it as the voice channel creation category!'
            });
        }

        try {
            const config = getVoiceConfig();
            config[guildId] = {
                categoryId: voiceChannel.parent.id,
                categoryName: voiceChannel.parent.name,
                setBy: message.author.id,
                setAt: new Date().toISOString()
            };
            saveVoiceConfig(config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Voice Channel Configuration Updated')
                .setDescription(`Voice channels can now only be created in the **${voiceChannel.parent.name}** category.`)
                .addFields(
                    {
                        name: '📂 Category',
                        value: voiceChannel.parent.name,
                        inline: true
                    },
                    {
                        name: '👤 Set by',
                        value: message.author.displayName,
                        inline: true
                    }
                )
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Error setting voice config:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to save voice channel configuration!'
            });
        }
    },

    async handleClearCommand(message, guildId) {
        try {
            const config = getVoiceConfig();
            if (!config[guildId]) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ No voice channel configuration is currently set!'
                });
            }

            delete config[guildId];
            saveVoiceConfig(config);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🗑️ Voice Channel Configuration Cleared')
                .setDescription('Voice channels can now be created in any category.')
                .addFields(
                    {
                        name: '👤 Cleared by',
                        value: message.author.displayName,
                        inline: true
                    }
                )
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Error clearing voice config:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to clear voice channel configuration!'
            });
        }
    },

    async handleViewCommand(message, guildId) {
        try {
            const config = getVoiceConfig();
            const guildConfig = config[guildId];

            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('🎤 Voice Channel Configuration')
                .setDescription('Current voice channel creation settings for this server.');

            if (guildConfig) {
                // Try to get the category to check if it still exists
                const category = guildConfig.categoryId ? message.guild.channels.cache.get(guildConfig.categoryId) : null;
                const lobby = guildConfig.lobbyChannelId ? message.guild.channels.cache.get(guildConfig.lobbyChannelId) : null;
                
                embed.addFields(
                    {
                        name: '📂 Allowed Category',
                        value: guildConfig.categoryId ? (category ? category.name : `${guildConfig.categoryName || 'Unknown'} (Deleted)`) : 'Any category (not restricted)',
                        inline: true
                    },
                    {
                        name: '🎧 Lobby Channel',
                        value: guildConfig.lobbyChannelId ? (lobby ? lobby.name : `${guildConfig.lobbyChannelName || guildConfig.lobbyChannelId} (Deleted)`) : 'Not set',
                        inline: true
                    },
                    {
                        name: '👤 Set by',
                        value: `<@${guildConfig.setBy}>`,
                        inline: true
                    },
                    {
                        name: '📅 Set on',
                        value: `<t:${Math.floor(new Date(guildConfig.setAt).getTime() / 1000)}:R>`,
                        inline: true
                    }
                );

                if (guildConfig.categoryId && !category) {
                    embed.setColor('#ff0000');
                    embed.setFooter({ text: '⚠️ The configured category no longer exists. Use %vcconfig clear to reset.' });
                }
            } else {
                embed.addFields(
                    {
                        name: '📂 Allowed Category',
                        value: 'Any category (not restricted)',
                        inline: false
                    }
                );
            }

            embed.addFields(
                {
                    name: '⚙️ Commands',
                    value: [
                        '`%vcconfig set` - Set current voice channel\'s category as allowed',
                        '`%vcconfig clear` - Remove category restriction',
                        '`%vcconfig setlobby` - Set your current voice channel as the lobby that auto-creates VCs',
                        '`%vcconfig clearlobby` - Clear the lobby channel setting',
                        '`%vcconfig view` - View current settings'
                    ].join('\n'),
                    inline: false
                }
            );

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Error viewing voice config:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to load voice channel configuration!'
            });
        }
    }
    ,
    async handleSetLobbyCommand(message, guildId) {
        // Must be in a voice channel to set it as lobby
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You must be in a voice channel to set the lobby channel!'
            });
        }

        try {
            const config = getVoiceConfig();
            const guildConfig = config[guildId] || {};
            guildConfig.lobbyChannelId = voiceChannel.id;
            guildConfig.lobbyChannelName = voiceChannel.name;
            guildConfig.setBy = message.author.id;
            guildConfig.setAt = new Date().toISOString();
            config[guildId] = guildConfig;
            saveVoiceConfig(config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Lobby Channel Set')
                .setDescription(`Users who join **${voiceChannel.name}** will automatically get a temporary voice channel created for them.`)
                .addFields(
                    { name: '🎧 Lobby', value: voiceChannel.name, inline: true },
                    { name: '📂 Parent Category', value: voiceChannel.parent ? voiceChannel.parent.name : 'None', inline: true }
                )
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Error setting lobby channel:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to save lobby channel configuration!'
            });
        }
    }
    ,
    async handleClearLobbyCommand(message, guildId) {
        try {
            const config = getVoiceConfig();
            const guildConfig = config[guildId];
            if (!guildConfig || !guildConfig.lobbyChannelId) {
                return await sendAsFloofWebhook(message, { content: '❌ No lobby channel is currently set!' });
            }

            delete guildConfig.lobbyChannelId;
            delete guildConfig.lobbyChannelName;
            config[guildId] = guildConfig;
            saveVoiceConfig(config);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🗑️ Lobby Channel Cleared')
                .setDescription('Users will no longer have channels auto-created when joining a lobby.')
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Error clearing lobby channel:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to clear lobby channel configuration!'
            });
        }
    }
};
