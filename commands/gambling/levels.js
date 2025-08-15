const { PermissionsBitField, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '../../levels-data.json');
const levelConfigPath = path.join(__dirname, '../../level-config.json');

function loadLevels() {
    if (!fs.existsSync(levelsPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
    } catch (error) {
        console.error('Error loading levels:', error);
        return {};
    }
}

function saveLevels(levels) {
    try {
        fs.writeFileSync(levelsPath, JSON.stringify(levels, null, 2));
    } catch (error) {
        console.error('Error saving levels:', error);
    }
}

function loadLevelConfig() {
    if (!fs.existsSync(levelConfigPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(levelConfigPath, 'utf8'));
    } catch (error) {
        console.error('Error loading level config:', error);
        return {};
    }
}

function saveLevelConfig(config) {
    try {
        fs.writeFileSync(levelConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving level config:', error);
    }
}

function getServerLevels(guildId) {
    const levels = loadLevels();
    return levels[guildId] || {};
}

function saveServerLevels(guildId, serverLevels) {
    const levels = loadLevels();
    levels[guildId] = serverLevels;
    saveLevels(levels);
}

function getServerConfig(guildId) {
    const config = loadLevelConfig();
    return config[guildId] || {
        enabled: true,
        xpPerMessage: 15,
        xpCooldown: 60000, // 1 minute
        levelUpChannel: null,
        levelRoles: {},
        multipliers: {},
        ignoredChannels: [],
        ignoredRoles: []
    };
}

function saveServerConfig(guildId, serverConfig) {
    const config = loadLevelConfig();
    config[guildId] = serverConfig;
    saveLevelConfig(config);
}

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp));
}

function calculateXpForLevel(level) {
    return Math.pow(level / 0.1, 2);
}

function addXp(guildId, userId, amount) {
    const serverLevels = getServerLevels(guildId);
    
    if (!serverLevels[userId]) {
        serverLevels[userId] = {
            xp: 0,
            level: 0,
            lastMessage: 0,
            totalMessages: 0
        };
    }
    
    const userData = serverLevels[userId];
    const oldLevel = userData.level;
    
    userData.xp += amount;
    userData.level = calculateLevel(userData.xp);
    userData.totalMessages++;
    userData.lastMessage = Date.now();
    
    saveServerLevels(guildId, serverLevels);
    
    return {
        levelUp: userData.level > oldLevel,
        oldLevel,
        newLevel: userData.level,
        totalXp: userData.xp
    };
}

module.exports = {
    name: 'levels',
    aliases: ['level', 'rank', 'xp'],
    description: 'View your level, XP, and server leaderboard',
    usage: '%levels [user] OR %levels leaderboard/config',
    category: 'gambling',
    permissions: [],
    cooldown: 5,

    async execute(message, args) {
        const serverConfig = getServerConfig(message.guild.id);
        
        if (!serverConfig.enabled) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Leveling system is disabled in this server.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (!args.length) {
            return this.showUserLevel(message, message.author);
        }

        const subcommand = args[0].toLowerCase();

        switch (subcommand) {
            case 'leaderboard':
            case 'lb':
            case 'top':
                return this.showLeaderboard(message);
            case 'config':
            case 'setup':
                return this.configLevels(message, args.slice(1));
            case 'reset':
                return this.resetLevels(message, args.slice(1));
            default:
                const user = message.mentions.users.first() || 
                           message.guild.members.cache.find(m => 
                               m.displayName.toLowerCase().includes(args[0].toLowerCase()) ||
                               m.user.username.toLowerCase().includes(args[0].toLowerCase())
                           )?.user;
                
                if (user) {
                    return this.showUserLevel(message, user);
                } else {
                    return this.showHelp(message);
                }
        }
    },

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Leveling System')
            .setDescription('Gain XP by chatting and level up to earn rewards!')
            .setColor(0x7289DA)
            .addFields(
                {
                    name: '📈 **User Commands**',
                    value: [
                        '`%levels` - View your level and XP',
                        '`%levels @user` - View someone\'s level',
                        '`%levels leaderboard` - Server XP leaderboard',
                        '`%levels top` - Same as leaderboard'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⚙️ **Admin Commands**',
                    value: [
                        '`%levels config` - Configure leveling system',
                        '`%levels reset @user` - Reset user\'s XP',
                        '`%levels reset all` - Reset all XP (dangerous!)'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Gain XP by sending messages • Level up to unlock rewards!' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showUserLevel(message, user) {
        const serverLevels = getServerLevels(message.guild.id);
        const userData = serverLevels[user.id] || {
            xp: 0,
            level: 0,
            lastMessage: 0,
            totalMessages: 0
        };

        const currentLevelXp = calculateXpForLevel(userData.level);
        const nextLevelXp = calculateXpForLevel(userData.level + 1);
        const progressXp = userData.xp - currentLevelXp;
        const neededXp = nextLevelXp - currentLevelXp;
        const progressPercent = Math.floor((progressXp / neededXp) * 100);

        // Calculate rank
        const allUsers = Object.entries(serverLevels)
            .sort(([,a], [,b]) => b.xp - a.xp);
        const userRank = allUsers.findIndex(([id]) => id === user.id) + 1;

        const progressBar = this.createProgressBar(progressPercent);

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${user.displayName}'s Level`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setColor(this.getLevelColor(userData.level))
            .addFields(
                {
                    name: '📈 **Level Progress**',
                    value: [
                        `**Level:** ${userData.level}`,
                        `**XP:** ${userData.xp.toLocaleString()}`,
                        `**Rank:** #${userRank || 'Unranked'}`,
                        `**Messages:** ${userData.totalMessages.toLocaleString()}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎯 **Next Level**',
                    value: [
                        `**Progress:** ${progressXp.toLocaleString()}/${neededXp.toLocaleString()} XP`,
                        `**Needed:** ${(neededXp - progressXp).toLocaleString()} XP`,
                        `**Completion:** ${progressPercent}%`,
                        progressBar
                    ].join('\n'),
                    inline: true
                }
            )
            .setFooter({ text: `${user.username} • Keep chatting to gain more XP!` })
            .setTimestamp();

        // Add level role info if applicable
        const serverConfig = getServerConfig(message.guild.id);
        const levelRole = serverConfig.levelRoles[userData.level];
        if (levelRole) {
            const role = message.guild.roles.cache.get(levelRole);
            if (role) {
                embed.addFields({
                    name: '🏆 **Level Reward**',
                    value: `You have the ${role} role!`,
                    inline: false
                });
            }
        }

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showLeaderboard(message) {
        const serverLevels = getServerLevels(message.guild.id);
        const sortedUsers = Object.entries(serverLevels)
            .sort(([,a], [,b]) => b.xp - a.xp)
            .slice(0, 15);

        if (sortedUsers.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('📭 No one has gained XP yet. Start chatting to appear on the leaderboard!')
                .setColor(0x7289DA);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const leaderboardText = await Promise.all(
            sortedUsers.map(async ([userId, data], index) => {
                try {
                    const user = await message.client.users.fetch(userId);
                    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `**${index + 1}.**`;
                    return `${medal} ${user.username} - Level ${data.level} (${data.xp.toLocaleString()} XP)`;
                } catch (error) {
                    return `**${index + 1}.** Unknown User - Level ${data.level} (${data.xp.toLocaleString()} XP)`;
                }
            })
        );

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${message.guild.name} XP Leaderboard`)
            .setDescription(leaderboardText.join('\n'))
            .setColor(0xFFD700)
            .setFooter({ text: `Showing top ${sortedUsers.length} users • Keep chatting to climb the ranks!` })
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async configLevels(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need `Manage Server` permission to configure levels.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const serverConfig = getServerConfig(message.guild.id);

        if (!args.length) {
            return this.showConfig(message, serverConfig);
        }

        const setting = args[0].toLowerCase();

        switch (setting) {
            case 'enable':
            case 'disable':
                serverConfig.enabled = setting === 'enable';
                saveServerConfig(message.guild.id, serverConfig);
                
                const statusEmbed = new EmbedBuilder()
                    .setDescription(`${serverConfig.enabled ? '✅' : '❌'} Leveling system ${setting}d`)
                    .setColor(serverConfig.enabled ? 0x00FF00 : 0xFF6B6B);
                return sendAsFloofWebhook(message, { embeds: [statusEmbed] });

            case 'channel':
                const channel = message.mentions.channels.first();
                if (!channel) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Please mention a channel for level up announcements.')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                
                serverConfig.levelUpChannel = channel.id;
                saveServerConfig(message.guild.id, serverConfig);
                
                const channelEmbed = new EmbedBuilder()
                    .setDescription(`✅ Level up channel set to ${channel}`)
                    .setColor(0x00FF00);
                return sendAsFloofWebhook(message, { embeds: [channelEmbed] });

            case 'xp':
                const xpAmount = parseInt(args[1]);
                if (isNaN(xpAmount) || xpAmount < 1 || xpAmount > 100) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ XP per message must be between 1 and 100.')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                
                serverConfig.xpPerMessage = xpAmount;
                saveServerConfig(message.guild.id, serverConfig);
                
                const xpEmbed = new EmbedBuilder()
                    .setDescription(`✅ XP per message set to ${xpAmount}`)
                    .setColor(0x00FF00);
                return sendAsFloofWebhook(message, { embeds: [xpEmbed] });

            case 'role':
                if (args.length < 3) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Usage: `%levels config role <level> <@role>`')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                
                const level = parseInt(args[1]);
                const role = message.mentions.roles.first();
                
                if (isNaN(level) || level < 1) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Level must be a positive number.')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                
                if (!role) {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ Please mention a valid role.')
                        .setColor(0xFF0000);
                    return sendAsFloofWebhook(message, { embeds: [embed] });
                }
                
                serverConfig.levelRoles[level] = role.id;
                saveServerConfig(message.guild.id, serverConfig);
                
                const roleEmbed = new EmbedBuilder()
                    .setDescription(`✅ Level ${level} reward set to ${role}`)
                    .setColor(0x00FF00);
                return sendAsFloofWebhook(message, { embeds: [roleEmbed] });

            default:
                return this.showConfigHelp(message);
        }
    },

    async showConfig(message, serverConfig) {
        const levelUpChannel = serverConfig.levelUpChannel ? 
            `<#${serverConfig.levelUpChannel}>` : 'Not set';
        
        const levelRoles = Object.entries(serverConfig.levelRoles)
            .map(([level, roleId]) => {
                const role = message.guild.roles.cache.get(roleId);
                return `Level ${level}: ${role || 'Invalid role'}`;
            })
            .join('\n') || 'None set';

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ ${message.guild.name} Level Configuration`)
            .setColor(0x7289DA)
            .addFields(
                {
                    name: '📊 **Basic Settings**',
                    value: [
                        `**Enabled:** ${serverConfig.enabled ? '✅ Yes' : '❌ No'}`,
                        `**XP per Message:** ${serverConfig.xpPerMessage}`,
                        `**XP Cooldown:** ${serverConfig.xpCooldown / 1000}s`,
                        `**Level Up Channel:** ${levelUpChannel}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🏆 **Level Roles**',
                    value: levelRoles,
                    inline: false
                }
            )
            .setFooter({ text: 'Use %levels config <setting> to modify settings' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showConfigHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Level Configuration Help')
            .setDescription('Configure the leveling system for your server')
            .setColor(0x7289DA)
            .addFields(
                {
                    name: '🔧 **Available Settings**',
                    value: [
                        '`%levels config enable/disable` - Toggle leveling system',
                        '`%levels config channel <#channel>` - Set level up announcement channel',
                        '`%levels config xp <amount>` - Set XP per message (1-100)',
                        '`%levels config role <level> <@role>` - Set level reward role'
                    ].join('\n'),
                    inline: false
                }
            );

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async resetLevels(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need Administrator permission to reset levels.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%levels reset <@user|all>`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (args[0].toLowerCase() === 'all') {
            const serverLevels = {};
            saveServerLevels(message.guild.id, serverLevels);
            
            const embed = new EmbedBuilder()
                .setDescription('✅ All user levels have been reset.')
                .setColor(0x00FF00);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const user = message.mentions.users.first();
        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please mention a user to reset.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const serverLevels = getServerLevels(message.guild.id);
        delete serverLevels[user.id];
        saveServerLevels(message.guild.id, serverLevels);

        const embed = new EmbedBuilder()
            .setDescription(`✅ Reset levels for ${user}`)
            .setColor(0x00FF00);
        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    // Helper functions
    createProgressBar(percent) {
        const filled = Math.floor(percent / 10);
        const empty = 10 - filled;
        return '▰'.repeat(filled) + '▱'.repeat(empty) + ` ${percent}%`;
    },

    getLevelColor(level) {
        if (level >= 50) return 0xFF0000; // Red
        if (level >= 40) return 0xFF4500; // Orange Red
        if (level >= 30) return 0xFFA500; // Orange
        if (level >= 20) return 0xFFD700; // Gold
        if (level >= 10) return 0x00FF00; // Green
        if (level >= 5) return 0x00BFFF;  // Deep Sky Blue
        return 0x7289DA; // Default Discord blue
    },

    // Export functions for message handling
    handleMessage(message) {
        if (message.author.bot) return;
        
        const serverConfig = getServerConfig(message.guild.id);
        if (!serverConfig.enabled) return;

        // Check cooldown
        const serverLevels = getServerLevels(message.guild.id);
        const userData = serverLevels[message.author.id];
        
        if (userData && Date.now() - userData.lastMessage < serverConfig.xpCooldown) {
            return;
        }

        // Add XP
        const result = addXp(message.guild.id, message.author.id, serverConfig.xpPerMessage);
        
        // Handle level up
        if (result.levelUp) {
            this.handleLevelUp(message, result);
        }
    },

    async handleLevelUp(message, result) {
        const serverConfig = getServerConfig(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 Level Up!')
            .setDescription(`${message.author} reached **Level ${result.newLevel}**!`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setColor(this.getLevelColor(result.newLevel))
            .addFields({
                name: '📊 Stats',
                value: `**Total XP:** ${result.totalXp.toLocaleString()}\n**Previous Level:** ${result.oldLevel}`,
                inline: true
            })
            .setTimestamp();

        // Check for level role reward
        const levelRole = serverConfig.levelRoles[result.newLevel];
        if (levelRole) {
            const role = message.guild.roles.cache.get(levelRole);
            if (role) {
                try {
                    await message.member.roles.add(role);
                    embed.addFields({
                        name: '🏆 Reward Unlocked!',
                        value: `You received the ${role} role!`,
                        inline: false
                    });
                } catch (error) {
                    console.error('Error adding level role:', error);
                }
            }
        }

        // Send to configured channel or current channel
        const targetChannel = serverConfig.levelUpChannel ? 
            message.guild.channels.cache.get(serverConfig.levelUpChannel) : 
            message.channel;

        if (targetChannel) {
            await targetChannel.send({ embeds: [embed] });
        }
    }
};
