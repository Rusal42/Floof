const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { isOwner } = require('../../utils/owner-util');
const fs = require('fs');
const path = require('path');

function getPrefixConfig() {
    const configPath = path.join(__dirname, '..', '..', 'data', 'prefix-config.json');
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return {};
}

function savePrefixConfig(data) {
    const configPath = path.join(__dirname, '..', '..', 'data', 'prefix-config.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

module.exports = {
    name: 'prefix',
    description: 'Manage custom prefixes for users',
    usage: '%prefix set <prefix> | %prefix remove/clear',
    category: 'general',
    aliases: ['setprefix', 'pf'],
    cooldown: 3,

    async execute(message, args) {

        const subcommand = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const userId = message.author.id;

        switch (subcommand) {
            case 'set':
                return await this.handleSetCommand(message, args, guildId, userId);
            case 'remove':
            case 'delete':
            case 'clear':
            case 'reset':
                return await this.handleRemoveCommand(message, args, guildId, userId);
            case 'list':
                return await this.handleListCommand(message, guildId);
            default:
                return await this.handleHelp(message);
        }
    },

    async handleHelp(message) {
        const embed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle('🔧 Prefix Commands')
            .setDescription('Manage your personal command prefix.')
            .addFields(
                {
                    name: '⚙️ Commands',
                    value: [
                        '`%prefix set <prefix>` - Set your custom prefix',
                        '`%prefix remove/clear` - Remove your custom prefix'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💡 Examples',
                    value: [
                        '`%prefix set !` - Set ! as your prefix',
                        '`%prefix set >>` - Set >> as your prefix',
                        '`%prefix clear` - Remove your custom prefix'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📝 Rules',
                    value: [
                        '• Prefix must be 5 characters or less',
                        '• Prefix cannot contain spaces',
                        '• Anyone can set their own custom prefix',
                        '• If you have no custom prefix, the default is `%`'
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp();

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async handleSetCommand(message, args, guildId, userId) {
        if (args.length < 2) {
            return await sendAsFloofWebhook(message, {
                content: '❌ **Usage:** `%prefix set <prefix>`\n**Example:** `%prefix set !`\n**Note:** Prefix must be 5 characters or less and cannot contain spaces.'
            });
        }

        const targetUser = message.author; // Set prefix for the user themselves

        const newPrefix = args.slice(1).join(' ');
        if (newPrefix.length > 5) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Prefix must be 5 characters or less!'
            });
        }

        if (newPrefix.includes(' ')) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Prefix cannot contain spaces!'
            });
        }

        try {
            const config = getPrefixConfig();
            if (!config[guildId]) {
                config[guildId] = {};
            }
            
            config[guildId][targetUser.id] = {
                prefix: newPrefix,
                setBy: message.author.id,
                setAt: new Date().toISOString()
            };
            
            savePrefixConfig(config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Custom Prefix Set')
                .setDescription(`Your custom prefix has been set to \`${newPrefix}\`\n\nYou can now use \`${newPrefix}\` instead of \`%\` for all commands!\n\nExample: \`${newPrefix}balance\`, \`${newPrefix}help\`, etc.`)
                .addFields(
                    {
                        name: '👤 User',
                        value: targetUser.displayName,
                        inline: true
                    },
                    {
                        name: '🔧 Prefix',
                        value: `\`${newPrefix}\``,
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
            console.error('Error setting custom prefix:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to set custom prefix!'
            });
        }
    },

    async handleRemoveCommand(message, args, guildId, userId) {
        const targetUser = message.author; // Remove prefix for the user themselves

        try {
            const config = getPrefixConfig();
            if (!config[guildId] || !config[guildId][targetUser.id]) {
                return await sendAsFloofWebhook(message, {
                    content: `❌ **${targetUser.displayName}** doesn't have a custom prefix set!`
                });
            }

            const oldPrefix = config[guildId][targetUser.id].prefix;
            delete config[guildId][targetUser.id];
            
            if (Object.keys(config[guildId]).length === 0) {
                delete config[guildId];
            }
            
            savePrefixConfig(config);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🗑️ Custom Prefix Removed')
                .setDescription(`Removed custom prefix for **${targetUser.displayName}**`)
                .addFields(
                    {
                        name: '👤 User',
                        value: targetUser.displayName,
                        inline: true
                    },
                    {
                        name: '🔧 Old Prefix',
                        value: `\`${oldPrefix}\``,
                        inline: true
                    },
                    {
                        name: '👤 Removed by',
                        value: message.author.displayName,
                        inline: true
                    }
                )
                .setTimestamp();

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Error removing custom prefix:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to remove custom prefix!'
            });
        }
    },

    async handleListCommand(message, guildId) {
        // Manage Server only (or bot owner)
        const canManage = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
        if (!canManage && !isOwner(message.author.id)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You need **Manage Server** permission to list all custom prefixes.'
            });
        }

        try {
            const config = getPrefixConfig();
            const guildConfig = config[guildId];

            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('🔧 Custom Prefixes')
                .setDescription('Custom prefixes configured for this server.');

            if (guildConfig && Object.keys(guildConfig).length > 0) {
                const prefixList = [];
                
                for (const [userId, userConfig] of Object.entries(guildConfig)) {
                    const user = await message.client.users.fetch(userId).catch(() => null);
                    const userName = user ? user.displayName : `Unknown User (${userId})`;
                    prefixList.push(`**${userName}**: \`${userConfig.prefix}\``);
                }

                embed.addFields({
                    name: '👥 Users with Custom Prefixes',
                    value: prefixList.join('\n') || 'None',
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '👥 Users with Custom Prefixes',
                    value: 'No custom prefixes set',
                    inline: false
                });
            }

            embed.addFields(
                {
                    name: '⚙️ Commands',
                    value: [
                        '`%prefix set <prefix>` - Set your custom prefix',
                        '`%prefix remove/clear` - Remove your custom prefix'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💡 Examples',
                    value: [
                        '`%prefix set !` - Set ! as your prefix',
                        '`%prefix set >>` - Set >> as your prefix',
                        '`%prefix clear` - Remove your custom prefix'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📝 Rules',
                    value: [
                        '• Prefix must be 5 characters or less',
                        '• Prefix cannot contain spaces',
                        '• Anyone can set their own custom prefix',
                        '• You can then use your custom prefix instead of %',
                        '• If you have no custom prefix, the default is `%`'
                    ].join('\n'),
                    inline: false
                }
            );

            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (error) {
            console.error('Error listing custom prefixes:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to load custom prefixes!'
            });
        }
    }
};
