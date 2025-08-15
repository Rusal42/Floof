const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs').promises;
const path = require('path');

// Configuration file path
const CONFIG_FILE = path.join(__dirname, '..', '..', 'data', 'server-configs.json');

module.exports = {
    name: 'config',
    description: 'Configure server-specific settings for Floof Bot',
    usage: '%config <setting> [value/channel]',
    category: 'moderation',
    aliases: ['configure', 'settings'],
    cooldown: 5,
    permissions: [PermissionFlagsBits.ManageGuild],

    async execute(message, args) {
        try {
            // Check if user has permission
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ You need **Manage Server** permission to use this command.'
                });
            }

            if (!args.length) {
                return await this.showConfigMenu(message);
            }

            const setting = args[0].toLowerCase();
            const value = args.slice(1).join(' ');

            switch (setting) {
                case 'modlog':
                case 'mod-log':
                case 'modlogs':
                    return await this.setModLogChannel(message, value);
                
                case 'roles':
                case 'role-selection':
                case 'roleselection':
                    return await this.setRoleSelectionChannel(message, value);
                
                case 'welcome':
                case 'welcome-channel':
                    return await this.setWelcomeChannel(message, value);
                
                case 'prefix':
                    return await this.setPrefix(message, value);
                
                case 'gambling':
                case 'gambling-channel':
                    return await this.setGamblingChannel(message, value);
                
                case 'revive':
                case 'revive-role':
                case 'reviverole':
                    return await this.setReviveRole(message, value);
                
                case 'view':
                case 'show':
                case 'list':
                    return await this.showCurrentConfig(message);
                
                case 'reset':
                    return await this.resetConfig(message, value);
                
                default:
                    return await this.showConfigMenu(message);
            }

        } catch (error) {
            console.error('Config command error:', error);
            return await sendAsFloofWebhook(message, {
                content: '❌ Something went wrong with the configuration command. Please try again.'
            });
        }
    },

    async showConfigMenu(message) {
        const embed = new EmbedBuilder()
            .setTitle('🔧 Server Configuration')
            .setDescription('Configure Floof Bot settings for your server')
            .setColor(0x00FF7F)
            .addFields(
                {
                    name: '📋 Available Settings',
                    value: [
                        '`%config modlog #channel` - Set moderation log channel',
                        '`%config roles #channel` - Set role selection channel',
                        '`%config welcome #channel` - Set welcome channel',
                        '`%config gambling #channel` - Set gambling channel',
                        '`%config revive @role` - Set revive notification role',
                        '`%config prefix !` - Set custom command prefix',
                        '`%config view` - View current configuration',
                        '`%config reset [setting]` - Reset configuration'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💡 Quick Setup Tips',
                    value: [
                        '• Use `%setup` for guided configuration',
                        '• Set a mod log to track bot actions',
                        '• Configure role selection for better organization',
                        '• Set gambling channel to contain casino commands'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Use %config <setting> <value> to configure' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setModLogChannel(message, channelInput) {
        if (!channelInput) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a channel: `%config modlog #channel`'
            });
        }

        const channel = this.parseChannel(message, channelInput);
        if (!channel) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid channel. Please mention a valid text channel.'
            });
        }

        if (channel.type !== ChannelType.GuildText) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Mod log channel must be a text channel.'
            });
        }

        // Check bot permissions
        const botPermissions = channel.permissionsFor(message.guild.members.me);
        if (!botPermissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            return await sendAsFloofWebhook(message, {
                content: `❌ I don't have permission to send messages in ${channel}. Please check my permissions.`
            });
        }

        await this.updateConfig(message.guild.id, 'modLogChannel', channel.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Mod Log Channel Set')
            .setDescription(`Moderation logs will now be sent to ${channel}`)
            .setColor(0x00FF7F)
            .addFields({
                name: '📋 What gets logged:',
                value: [
                    '• Command usage by moderators',
                    '• Role changes and permissions',
                    '• Channel configuration changes',
                    '• Bot setting modifications'
                ].join('\n')
            });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setRoleSelectionChannel(message, channelInput) {
        if (!channelInput) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a channel: `%config roles #channel`'
            });
        }

        const channel = this.parseChannel(message, channelInput);
        if (!channel) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid channel. Please mention a valid text channel.'
            });
        }

        if (channel.type !== ChannelType.GuildText) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Role selection channel must be a text channel.'
            });
        }

        await this.updateConfig(message.guild.id, 'roleSelectionChannel', channel.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Role Selection Channel Set')
            .setDescription(`Role selection will be available in ${channel}`)
            .setColor(0x00FF7F)
            .addFields({
                name: '🎭 Next Steps:',
                value: [
                    '• Use `%rolemenu create` to set up role menus',
                    '• Configure reaction roles for easy access',
                    '• Set up color roles for customization',
                    '• Add booster roles with `%boosterrole`'
                ].join('\n')
            });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setWelcomeChannel(message, channelInput) {
        if (!channelInput) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a channel: `%config welcome #channel`'
            });
        }

        const channel = this.parseChannel(message, channelInput);
        if (!channel) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid channel. Please mention a valid text channel.'
            });
        }

        await this.updateConfig(message.guild.id, 'welcomeChannel', channel.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Welcome Channel Set')
            .setDescription(`New members will be welcomed in ${channel}`)
            .setColor(0x00FF7F);

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setGamblingChannel(message, channelInput) {
        if (!channelInput) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a channel: `%config gambling #channel`'
            });
        }

        const channel = this.parseChannel(message, channelInput);
        if (!channel) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid channel. Please mention a valid text channel.'
            });
        }

        await this.updateConfig(message.guild.id, 'gamblingChannel', channel.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Gambling Channel Set')
            .setDescription(`Gambling commands will work best in ${channel}`)
            .setColor(0x00FF7F)
            .addFields({
                name: '🎰 Available Commands:',
                value: [
                    '• `%balance` - Check your coins',
                    '• `%daily` - Claim daily reward',
                    '• `%slots` - Play slot machine',
                    '• `%coinflip` - Flip a coin'
                ].join('\n')
            });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setReviveRole(message, roleInput) {
        if (!roleInput) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a role: `%config revive @role` or `%config revive RoleName`'
            });
        }

        const role = this.parseRole(message, roleInput);
        if (!role) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid role. Please mention a valid role or provide the role name.'
            });
        }

        await this.updateConfig(message.guild.id, 'reviveRole', role.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Revive Role Set')
            .setDescription(`The revive command will now ping ${role}`)
            .setColor(0x00FF7F)
            .addFields({
                name: '🔄 How it works:',
                value: [
                    '• Use `%revive` to ping this role with a random question',
                    '• Helps get conversations started in quiet channels',
                    '• Users with Manage Messages permission can use the revive command',
                    '• Questions are randomly selected from a fun list'
                ].join('\n')
            });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setPrefix(message, newPrefix) {
        if (!newPrefix) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a prefix: `%config prefix !`'
            });
        }

        if (newPrefix.length > 3) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Prefix must be 3 characters or less.'
            });
        }

        await this.updateConfig(message.guild.id, 'prefix', newPrefix);

        const embed = new EmbedBuilder()
            .setTitle('✅ Prefix Updated')
            .setDescription(`Command prefix changed to \`${newPrefix}\``)
            .setColor(0x00FF7F)
            .addFields({
                name: '📝 Example:',
                value: `Use \`${newPrefix}help\` instead of \`%help\``
            });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showCurrentConfig(message) {
        const config = await this.getConfig(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Current Server Configuration')
            .setDescription(`Configuration for **${message.guild.name}**`)
            .setColor(0x7289DA);

        // Add configuration fields
        if (config.modLogChannel) {
            const channel = message.guild.channels.cache.get(config.modLogChannel);
            embed.addFields({
                name: '📋 Mod Log Channel',
                value: channel ? `${channel}` : 'Channel not found',
                inline: true
            });
        }

        if (config.roleSelectionChannel) {
            const channel = message.guild.channels.cache.get(config.roleSelectionChannel);
            embed.addFields({
                name: '🎭 Role Selection Channel',
                value: channel ? `${channel}` : 'Channel not found',
                inline: true
            });
        }

        if (config.welcomeChannel) {
            const channel = message.guild.channels.cache.get(config.welcomeChannel);
            embed.addFields({
                name: '👋 Welcome Channel',
                value: channel ? `${channel}` : 'Channel not found',
                inline: true
            });
        }

        if (config.gamblingChannel) {
            const channel = message.guild.channels.cache.get(config.gamblingChannel);
            embed.addFields({
                name: '🎰 Gambling Channel',
                value: channel ? `${channel}` : 'Channel not found',
                inline: true
            });
        }

        if (config.prefix) {
            embed.addFields({
                name: '🔧 Custom Prefix',
                value: `\`${config.prefix}\``,
                inline: true
            });
        }

        if (config.reviveRole) {
            const role = message.guild.roles.cache.get(config.reviveRole);
            embed.addFields({
                name: '🔄 Revive Role',
                value: role ? `${role}` : 'Role not found',
                inline: true
            });
        }

        if (embed.data.fields?.length === 0) {
            embed.setDescription('No configuration set yet. Use `%config` to get started!');
        }

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async resetConfig(message, setting) {
        if (!setting) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify what to reset: `%config reset modlog` or `%config reset all`'
            });
        }

        if (setting.toLowerCase() === 'all') {
            await this.updateConfig(message.guild.id, null, null, true); // Reset all
            return await sendAsFloofWebhook(message, {
                content: '✅ All server configuration has been reset.'
            });
        }

        const settingMap = {
            'modlog': 'modLogChannel',
            'roles': 'roleSelectionChannel',
            'welcome': 'welcomeChannel',
            'gambling': 'gamblingChannel',
            'revive': 'reviveRole',
            'prefix': 'prefix'
        };

        const configKey = settingMap[setting.toLowerCase()];
        if (!configKey) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid setting. Available: `modlog`, `roles`, `welcome`, `gambling`, `revive`, `prefix`, `all`'
            });
        }

        await this.updateConfig(message.guild.id, configKey, null, false, true); // Delete specific setting
        return await sendAsFloofWebhook(message, {
            content: `✅ Reset ${setting} configuration.`
        });
    },

    parseChannel(message, input) {
        // Try to parse channel mention
        const channelMatch = input.match(/^<#(\d+)>$/);
        if (channelMatch) {
            return message.guild.channels.cache.get(channelMatch[1]);
        }

        // Try to find by ID
        const channelById = message.guild.channels.cache.get(input);
        if (channelById) return channelById;

        // Try to find by name
        return message.guild.channels.cache.find(ch => 
            ch.name.toLowerCase() === input.toLowerCase() && ch.type === ChannelType.GuildText
        );
    },

    parseRole(message, input) {
        // Try to parse role mention
        const roleMatch = input.match(/^<@&(\d+)>$/);
        if (roleMatch) {
            return message.guild.roles.cache.get(roleMatch[1]);
        }

        // Try to find by ID
        const roleById = message.guild.roles.cache.get(input);
        if (roleById) return roleById;

        // Try to find by name (case insensitive)
        return message.guild.roles.cache.find(role => 
            role.name.toLowerCase() === input.toLowerCase()
        );
    },

    async getConfig(guildId) {
        try {
            const data = await fs.readFile(CONFIG_FILE, 'utf8');
            const configs = JSON.parse(data);
            return configs[guildId] || {};
        } catch (error) {
            return {};
        }
    },

    async updateConfig(guildId, key, value, resetAll = false, deleteKey = false) {
        try {
            let configs = {};
            
            try {
                const data = await fs.readFile(CONFIG_FILE, 'utf8');
                configs = JSON.parse(data);
            } catch (error) {
                // File doesn't exist, start with empty object
            }

            if (resetAll) {
                delete configs[guildId];
            } else if (deleteKey) {
                if (configs[guildId]) {
                    delete configs[guildId][key];
                    if (Object.keys(configs[guildId]).length === 0) {
                        delete configs[guildId];
                    }
                }
            } else {
                if (!configs[guildId]) {
                    configs[guildId] = {};
                }
                configs[guildId][key] = value;
            }

            // Ensure data directory exists
            const dataDir = path.dirname(CONFIG_FILE);
            try {
                await fs.access(dataDir);
            } catch {
                await fs.mkdir(dataDir, { recursive: true });
            }

            await fs.writeFile(CONFIG_FILE, JSON.stringify(configs, null, 2));
        } catch (error) {
            console.error('Error updating config:', error);
            throw error;
        }
    }
};
