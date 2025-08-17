const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { postRulesMenu } = require('../../creation/rules-menu');
const { sendRulesConfigUpdate } = require('../../utils/website-integration');
const { postColorMenu, setupColorRoles } = require('../../creation/setup-color-roles');
const fs = require('fs').promises;
const path = require('path');

// Configuration file path - using absolute path to data directory
const CONFIG_FILE = path.join(process.cwd(), 'data', 'server-configs.json');

module.exports = {
    name: 'config',
    description: 'Configure server-specific settings for Floof Bot',
    usage: '%config <setting> [value/channel]',
    category: 'moderation',
    aliases: ['configure', 'settings', 'cfg', 'c'],
    cooldown: 5,
    permissions: [PermissionFlagsBits.Administrator],

    async execute(message, args) {
        try {
            // Check if user has Administrator permission
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ You need **Administrator** permission to use this command.'
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
                case 'userprefix':
                case 'user-prefix':
                case 'customprefix':
                    return await sendAsFloofWebhook(message, {
                        content: 'ℹ️ Prefix is now user-controlled. Use `%prefix <symbol>` to set your own. Admin-based prefix settings have been deprecated.'
                    });
                
                case 'gambling':
                case 'gambling-channel':
                    return await this.setGamblingChannel(message, value);
                
                case 'revive':
                case 'revive-role':
                case 'reviverole':
                    return await this.setReviveRole(message, value);
                
                case 'changelog':
                case 'changelog-channel':
                case 'changelogchannel':
                    return await this.setChangelogChannel(message, value);
                
                case 'rulesmenu':
                case 'rules-menu':
                    return await this.sendRulesMenu(message, args.slice(1));

                case 'colormenu':
                case 'color-menu':
                    return await this.sendColorMenu(message, args.slice(1));

                case 'ruleschannel':
                case 'rules-channel':
                    return await this.setRulesChannel(message, value);

                case 'colorschannel':
                case 'colors-channel':
                case 'colorchannel':
                case 'color-channel':
                    return await this.setColorsChannel(message, value);

                case 'rulescontent':
                case 'rules-content':
                    return await this.setRulesContent(message, args.slice(1));

                case 'colorcontent':
                case 'color-content':
                    return await this.setColorContent(message, args.slice(1));

                case 'levels':
                case 'leveling':
                case 'level':
                    return await this.configureLevels(message, args.slice(1));
                
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
                        '`%config changelog #channel` - Set changelog channel',
                        '`%config ruleschannel #channel` - Set default rules menu channel',
                        '`%config colorschannel #channel` - Set default color menu channel',
                        '`%config rulescontent title:"..." description:"..." footer:"..." button:"..." role:"Member"` - Customize rules menu',
                        '`%config colorcontent title:"..." description:"..."` - Customize color menu',
                        '`%config rulesmenu [#channel]` - Post rules menu (uses defaults if channel omitted)',
                        '`%config colormenu [#channel]` - Create color roles (if needed) and post color select menu',
                        '`%config levels` - Configure leveling system',
                        'Users: `%prefix !` - Set your personal prefix (no admin needed)',
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

    async sendRulesMenu(message, args) {
        try {
            // args: [#channel?]
            const maybeChannel = args[0];
            const cfg = await this.getConfig(message.guild.id);
            const channel = maybeChannel ? this.parseChannel(message, maybeChannel)
                : (cfg.rulesChannel ? message.guild.channels.cache.get(cfg.rulesChannel) : message.channel);
            if (!channel || channel.type !== ChannelType.GuildText) {
                return await sendAsFloofWebhook(message, { content: '❌ Please specify a valid text channel.' });
            }
            // Bot needs SendMessages/EmbedLinks and optionally ManageRoles
            const botPerms = channel.permissionsFor(message.guild.members.me);
            if (!botPerms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                return await sendAsFloofWebhook(message, { content: `❌ I cannot send messages in ${channel}.` });
            }
            const options = {
                title: cfg.rulesTitle,
                description: cfg.rulesDescription,
                footer: cfg.rulesFooter,
                buttonLabel: cfg.rulesButton,
                assignRoleName: cfg.rulesAssignRole
            };
            if (options.assignRoleName && !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await sendAsFloofWebhook(message, { content: '❌ I need Manage Roles to auto-assign the configured role.' });
            }
            await postRulesMenu(channel, message.guild, options);
            return await sendAsFloofWebhook(message, { content: `✅ Rules menu posted in ${channel}.` });
        } catch (e) {
            console.error('sendRulesMenu error:', e);
            return await sendAsFloofWebhook(message, { content: '❌ Failed to post rules menu.' });
        }
    },

    async sendColorMenu(message, args) {
        try {
            // args: [#channel?]
            const maybeChannel = args[0];
            const cfg = await this.getConfig(message.guild.id);
            const channel = maybeChannel ? this.parseChannel(message, maybeChannel)
                : (cfg.colorsChannel ? message.guild.channels.cache.get(cfg.colorsChannel) : message.channel);
            if (!channel || channel.type !== ChannelType.GuildText) {
                return await sendAsFloofWebhook(message, { content: '❌ Please specify a valid text channel.' });
            }
            // Ensure color roles exist and bot can manage roles
            if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await sendAsFloofWebhook(message, { content: '❌ I need Manage Roles to set up color roles.' });
            }
            // Try to set up roles (idempotent)
            await setupColorRoles(message.guild);
            const botPerms = channel.permissionsFor(message.guild.members.me);
            if (!botPerms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                return await sendAsFloofWebhook(message, { content: `❌ I cannot send messages in ${channel}.` });
            }
            const options = { title: cfg.colorTitle, description: cfg.colorDescription };
            await postColorMenu(channel, options);
            return await sendAsFloofWebhook(message, { content: `✅ Color menu posted in ${channel}.` });
        } catch (e) {
            console.error('sendColorMenu error:', e);
            return await sendAsFloofWebhook(message, { content: '❌ Failed to post color menu.' });
        }
    },

    async setRulesChannel(message, channelInput) {
        if (!channelInput) {
            return await sendAsFloofWebhook(message, { content: '❌ Please specify a channel: `%config ruleschannel #channel`' });
        }
        const channel = this.parseChannel(message, channelInput);
        if (!channel || channel.type !== ChannelType.GuildText) {
            return await sendAsFloofWebhook(message, { content: '❌ Invalid channel. Please mention a valid text channel.' });
        }
        await this.updateConfig(message.guild.id, 'rulesChannel', channel.id);
        // Sync to website Rules area
        try {
            const cfg = await this.getConfig(message.guild.id);
            await sendRulesConfigUpdate(message.guild, cfg);
        } catch (_) {}
        const embed = new EmbedBuilder()
            .setTitle('✅ Rules Channel Set')
            .setDescription(`Rules menu will default to ${channel}`)
            .setColor(0x00FF7F);
        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setColorsChannel(message, channelInput) {
        if (!channelInput) {
            return await sendAsFloofWebhook(message, { content: '❌ Please specify a channel: `%config colorschannel #channel`' });
        }
        const channel = this.parseChannel(message, channelInput);
        if (!channel || channel.type !== ChannelType.GuildText) {
            return await sendAsFloofWebhook(message, { content: '❌ Invalid channel. Please mention a valid text channel.' });
        }
        await this.updateConfig(message.guild.id, 'colorsChannel', channel.id);
        const embed = new EmbedBuilder()
            .setTitle('✅ Colors Channel Set')
            .setDescription(`Color menu will default to ${channel}`)
            .setColor(0x00FF7F);
        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async setRulesContent(message, args) {
        if (!args.length) {
            return await sendAsFloofWebhook(message, { content: 'Usage: `%config rulescontent title:"..." description:"..." footer:"..." button:"..." role:"Member"` (any subset)' });
        }
        const joined = args.join(' ');
        const extract = (key) => {
            const m = joined.match(new RegExp(key + ':"([\s\S]*?)"'));
            return m ? m[1] : undefined;
        };
        const title = extract('title');
        const description = extract('description');
        const footer = extract('footer');
        const button = extract('button');
        const role = extract('role');
        if (title) await this.updateConfig(message.guild.id, 'rulesTitle', title);
        if (description) {
            const normalized = description.replace(/\\n/g, '\n');
            await this.updateConfig(message.guild.id, 'rulesDescription', normalized);
        }
        if (footer) await this.updateConfig(message.guild.id, 'rulesFooter', footer);
        if (button) await this.updateConfig(message.guild.id, 'rulesButton', button);
        if (role) await this.updateConfig(message.guild.id, 'rulesAssignRole', role);
        // Sync to website Rules area
        try {
            const cfg = await this.getConfig(message.guild.id);
            await sendRulesConfigUpdate(message.guild, cfg);
        } catch (_) {}
        return await sendAsFloofWebhook(message, { content: '✅ Updated rules menu content.' });
    },

    async setColorContent(message, args) {
        if (!args.length) {
            return await sendAsFloofWebhook(message, { content: 'Usage: `%config colorcontent title:"..." description:"..."` (any subset)' });
        }
        const joined = args.join(' ');
        const extract = (key) => {
            const m = joined.match(new RegExp(key + ':"([\s\S]*?)"'));
            return m ? m[1] : undefined;
        };
        const title = extract('title');
        const description = extract('description');
        if (title) await this.updateConfig(message.guild.id, 'colorTitle', title);
        if (description) {
            const normalized = description.replace(/\\n/g, '\n');
            await this.updateConfig(message.guild.id, 'colorDescription', normalized);
        }
        return await sendAsFloofWebhook(message, { content: '✅ Updated color menu content.' });
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

    async setChangelogChannel(message, channelInput) {
        if (!channelInput) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please specify a channel: `%config changelog #channel`'
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
                content: '❌ Changelog channel must be a text channel.'
            });
        }

        // Check bot permissions
        const botPermissions = channel.permissionsFor(message.guild.members.me);
        if (!botPermissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            return await sendAsFloofWebhook(message, {
                content: `❌ I don't have permission to send messages in ${channel}. Please check my permissions.`
            });
        }

        await this.updateConfig(message.guild.id, 'changelogChannel', channel.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Changelog Channel Set')
            .setDescription(`Bot changelogs will now be sent to ${channel}`)
            .setColor(0x00FF7F)
            .addFields({
                name: '📋 What gets posted:',
                value: [
                    '• New feature announcements',
                    '• Bug fix notifications',
                    '• Bot improvement updates',
                    '• Version release notes'
                ].join('\n')
            });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async configureLevels(message, args) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Leveling System Configuration')
            .setDescription('Configure XP and leveling settings for your server')
            .setColor(0x7289DA)
            .addFields(
                {
                    name: '⚙️ Available Commands',
                    value: [
                        '`%levels config enable/disable` - Toggle leveling system',
                        '`%levels config channel #channel` - Set level up announcement channel',
                        '`%levels config xp <amount>` - Set XP per message (1-100)',
                        '`%levels config role <level> @role` - Set level reward role',
                        '`%levels config` - View current leveling settings'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📈 User Commands',
                    value: [
                        '`%levels` - View your level and XP',
                        '`%levels @user` - View someone\'s level',
                        '`%levels leaderboard` - Server XP leaderboard'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🎯 Quick Setup',
                    value: [
                        '1. Use `%levels config enable` to turn on leveling',
                        '2. Set a channel with `%levels config channel #general`',
                        '3. Create roles and assign them with `%levels config role 5 @Level5`',
                        '4. Adjust XP rate with `%levels config xp 20`'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Use the %levels command directly for detailed configuration' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    // Deprecated: admin/user-managed prefix via %config userprefix
    async setUserPrefix(message, args) {
        return await sendAsFloofWebhook(message, {
            content: 'ℹ️ This command is deprecated. Anyone can set their own prefix with `%prefix set <symbol>`.'
        });
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

        if (config.rulesChannel) {
            const channel = message.guild.channels.cache.get(config.rulesChannel);
            embed.addFields({ name: '📜 Rules Channel', value: channel ? `${channel}` : 'Channel not found', inline: true });
        }

        if (config.colorsChannel) {
            const channel = message.guild.channels.cache.get(config.colorsChannel);
            embed.addFields({ name: '🎨 Colors Channel', value: channel ? `${channel}` : 'Channel not found', inline: true });
        }

        // Deprecated: showing server-wide prefix

        if (config.reviveRole) {
            const role = message.guild.roles.cache.get(config.reviveRole);
            embed.addFields({
                name: '🔄 Revive Role',
                value: role ? `${role}` : 'Role not found',
                inline: true
            });
        }

        if (config.changelogChannel) {
            const channel = message.guild.channels.cache.get(config.changelogChannel);
            embed.addFields({
                name: '📋 Changelog Channel',
                value: channel ? `${channel}` : 'Channel not found',
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
            // Sync rules to website (now empty)
            try {
                const cfg = await this.getConfig(message.guild.id);
                await sendRulesConfigUpdate(message.guild, cfg);
            } catch (_) {}
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
            'changelog': 'changelogChannel',
            'ruleschannel': 'rulesChannel',
            'rules-channel': 'rulesChannel',
            'colorschannel': 'colorsChannel',
            'colors-channel': 'colorsChannel',
            'colorchannel': 'colorsChannel',
            'color-channel': 'colorsChannel',
            'rulescontent': ['rulesTitle','rulesDescription','rulesFooter','rulesButton','rulesAssignRole'],
            'rules-content': ['rulesTitle','rulesDescription','rulesFooter','rulesButton','rulesAssignRole'],
            'colorcontent': ['colorTitle','colorDescription'],
            'color-content': ['colorTitle','colorDescription']
        };

        const keyOrKeys = settingMap[setting.toLowerCase()];
        if (!keyOrKeys) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Invalid setting. Available: `modlog`, `roles`, `welcome`, `gambling`, `revive`, `changelog`, `ruleschannel`, `colorschannel`, `rulescontent`, `colorcontent`, `all`'
            });
        }

        if (Array.isArray(keyOrKeys)) {
            for (const k of keyOrKeys) {
                await this.updateConfig(message.guild.id, k, null, false, true);
            }
        } else {
            await this.updateConfig(message.guild.id, keyOrKeys, null, false, true); // Delete specific setting
        }
        // If we reset rules-related settings, sync to website
        try {
            const rulesKeys = new Set(['rulesChannel','rulesTitle','rulesDescription','rulesFooter','rulesButton','rulesAssignRole']);
            const affected = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
            if (affected.some(k => rulesKeys.has(k))) {
                const cfg = await this.getConfig(message.guild.id);
                await sendRulesConfigUpdate(message.guild, cfg);
            }
        } catch (_) {}
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
