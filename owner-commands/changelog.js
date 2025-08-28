const { EmbedBuilder, ChannelType } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { isOwner } = require('../utils/owner-util');
const fs = require('fs');
const path = require('path');

// Load changelog data
const changelogPath = path.join(__dirname, '..', '..', 'data', 'changelog-data.json');

function loadChangelogs() {
    try {
        if (fs.existsSync(changelogPath)) {
            return JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading changelog data:', error);
    }
    return { changelogs: [], nextId: 1 };
}

function saveChangelogs(data) {
    try {
        fs.writeFileSync(changelogPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving changelog data:', error);
    }
}

module.exports = {
    name: 'changelog',
    description: 'Manage and send changelogs to the building server',
    usage: '%changelog <send|list|view|delete> [options]',
    category: 'owner',
    aliases: ['cl', 'updates'],
    cooldown: 5,

    async execute(message, args) {
        // Check if user is bot owner
        if (!isOwner(message.author.id)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Only the bot owner can use this command.'
            });
        }

        // Check if command is being used in the building server
        const buildingServerId = '1393659651832152185';
        if (message.guild.id !== buildingServerId) {
            return await sendAsFloofWebhook(message, {
                content: '❌ This command can only be used in the building server.'
            });
        }

        if (!args.length) {
            return await this.showChangelogMenu(message);
        }

        const subcommand = args[0].toLowerCase();
        const changelogData = loadChangelogs();

        switch (subcommand) {
            case 'send':
                await this.handleSendChangelog(message, args.slice(1), changelogData);
                break;
            case 'list':
                await this.handleListChangelogs(message, args.slice(1), changelogData);
                break;
            case 'view':
                await this.handleViewChangelog(message, args.slice(1), changelogData);
                break;
            case 'delete':
                await this.handleDeleteChangelog(message, args.slice(1), changelogData);
                break;
            default:
                await this.showChangelogMenu(message);
        }
    },

    async showChangelogMenu(message) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Changelog Management')
            .setDescription('Manage bot changelogs and announcements')
            .setColor('#00ff88')
            .addFields(
                {
                    name: '📤 Send Changelog',
                    value: '`%changelog send "v1.2.3" "Update Title" "Description" "features" "improvements" "fixes"`\n• Use quotes for multi-word entries\n• Features/improvements/fixes are optional',
                    inline: false
                },
                {
                    name: '📋 Other Commands',
                    value: [
                        '`%changelog list [count]` - List recent changelogs',
                        '`%changelog view <id>` - View specific changelog',
                        '`%changelog delete <id>` - Delete changelog'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⚙️ Setup Required',
                    value: 'Use `%config changelog #channel` to set where changelogs are posted',
                    inline: false
                }
            )
            .setFooter({ text: 'Owner-only command' });

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    parseQuotedArgs(text) {
        const args = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                args.push(current);
                current = '';
                quoteChar = '';
            } else if (char === ' ' && !inQuotes) {
                if (current) {
                    args.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current) {
            args.push(current);
        }
        
        return args;
    },

    async handleSendChangelog(message, args, changelogData) {
        if (args.length === 0) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Usage: `%changelog send "v1.2.3" "Update Title" ["Description"] ["features"] ["improvements"] ["fixes"]`'
            });
        }

        // Parse quoted arguments
        const quotedArgs = this.parseQuotedArgs(args.join(' '));
        if (quotedArgs.length < 2) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide at least version and title in quotes: `%changelog send "v1.2.3" "Update Title"`'
            });
        }

        const version = quotedArgs[0];
        const title = quotedArgs[1];
        const description = quotedArgs[2] || '';
        const features = quotedArgs[3] ? quotedArgs[3].split('|').map(f => f.trim()).filter(f => f) : [];
        const improvements = quotedArgs[4] ? quotedArgs[4].split('|').map(i => i.trim()).filter(i => i) : [];
        const fixes = quotedArgs[5] ? quotedArgs[5].split('|').map(f => f.trim()).filter(f => f) : [];

        // Load server config to get changelog channel
        let configPath = path.join(__dirname, '..', '..', 'data', 'server-configs.json');
        let serverConfigs = {};
        try {
            if (fs.existsSync(configPath)) {
                serverConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading server configs:', error);
        }

        const guildConfig = serverConfigs[message.guild.id] || {};
        const changelogChannelId = guildConfig.changelogChannel;

        if (!changelogChannelId) {
            return await sendAsFloofWebhook(message, {
                content: '❌ No changelog channel configured. Use `%config changelog #channel` to set one first.'
            });
        }

        const changelogChannel = message.guild.channels.cache.get(changelogChannelId);
        if (!changelogChannel) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Configured changelog channel not found.'
            });
        }

        // Create changelog embed
        const embed = new EmbedBuilder()
            .setTitle(`🔄 ${title} - ${version}`)
            .setColor('#00ff88')
            .setTimestamp()
            .setFooter({ 
                text: 'Floof Bot Updates', 
                iconURL: message.client.user.displayAvatarURL() 
            });

        if (description) {
            embed.setDescription(description);
        }

        // Add features
        if (features.length > 0) {
            embed.addFields({
                name: '✨ New Features',
                value: features.map(f => `• ${f}`).join('\n'),
                inline: false
            });
        }

        // Add improvements
        if (improvements.length > 0) {
            embed.addFields({
                name: '⚡ Improvements',
                value: improvements.map(i => `• ${i}`).join('\n'),
                inline: false
            });
        }

        // Add fixes
        if (fixes.length > 0) {
            embed.addFields({
                name: '🐛 Bug Fixes',
                value: fixes.map(f => `• ${f}`).join('\n'),
                inline: false
            });
        }

        try {
            const sentMessage = await changelogChannel.send({ embeds: [embed] });

            // Save changelog to data
            const changelog = {
                id: changelogData.nextId++,
                version,
                title,
                description,
                features,
                improvements,
                fixes,
                timestamp: new Date().toISOString(),
                messageId: sentMessage.id,
                channelId: changelogChannel.id,
                guildId: message.guild.id
            };

            changelogData.changelogs.unshift(changelog);
            
            // Keep only last 50 changelogs
            if (changelogData.changelogs.length > 50) {
                changelogData.changelogs = changelogData.changelogs.slice(0, 50);
            }

            saveChangelogs(changelogData);

            // Send changelog update to website
            try {
                const { sendChangelogUpdate } = require('../../utils/website-integration');
                await sendChangelogUpdate(message.client, {
                    version,
                    title,
                    description,
                    features,
                    improvements,
                    fixes,
                    id: changelog.id
                });
            } catch (error) {
                console.error('Error sending changelog to website:', error);
            }

            await sendAsFloofWebhook(message, {
                content: `✅ Changelog ${version} sent to ${changelogChannel} and website!`
            });

        } catch (error) {
            console.error('Error sending changelog:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to send changelog. Check bot permissions in the target channel.'
            });
        }
    },

    async handleListChangelogs(message, args, changelogData) {
        const count = parseInt(args[0]) || 5;
        const changelogs = changelogData.changelogs.slice(0, count);

        if (changelogs.length === 0) {
            return await sendAsFloofWebhook(message, {
                content: '📝 No changelogs found.'
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Recent Changelogs')
            .setColor('#0099ff')
            .setTimestamp();

        for (const changelog of changelogs) {
            const date = new Date(changelog.timestamp).toLocaleDateString();
            embed.addFields({
                name: `${changelog.version} - ${changelog.title}`,
                value: `ID: ${changelog.id} | Date: ${date}${changelog.description ? `\n${changelog.description.substring(0, 100)}${changelog.description.length > 100 ? '...' : ''}` : ''}`,
                inline: false
            });
        }

        await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async handleViewChangelog(message, args, changelogData) {
        const id = parseInt(args[0]);
        if (!id) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a changelog ID: `%changelog view <id>`'
            });
        }

        const changelog = changelogData.changelogs.find(c => c.id === id);
        if (!changelog) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Changelog not found.'
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔄 ${changelog.title} - ${changelog.version}`)
            .setColor('#00ff88')
            .setTimestamp(new Date(changelog.timestamp))
            .setFooter({ text: `Changelog ID: ${changelog.id}` });

        if (changelog.description) {
            embed.setDescription(changelog.description);
        }

        if (changelog.features.length > 0) {
            embed.addFields({
                name: '✨ New Features',
                value: changelog.features.map(f => `• ${f}`).join('\n'),
                inline: false
            });
        }

        if (changelog.improvements.length > 0) {
            embed.addFields({
                name: '⚡ Improvements',
                value: changelog.improvements.map(i => `• ${i}`).join('\n'),
                inline: false
            });
        }

        if (changelog.fixes.length > 0) {
            embed.addFields({
                name: '🐛 Bug Fixes',
                value: changelog.fixes.map(f => `• ${f}`).join('\n'),
                inline: false
            });
        }

        await sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async handleDeleteChangelog(message, args, changelogData) {
        const id = parseInt(args[0]);
        if (!id) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a changelog ID: `%changelog delete <id>`'
            });
        }

        const index = changelogData.changelogs.findIndex(c => c.id === id);
        if (index === -1) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Changelog not found.'
            });
        }

        const changelog = changelogData.changelogs[index];
        changelogData.changelogs.splice(index, 1);
        saveChangelogs(changelogData);

        await sendAsFloofWebhook(message, {
            content: `✅ Deleted changelog: ${changelog.version} - ${changelog.title}`
        });
    }
};
