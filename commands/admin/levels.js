const { PermissionsBitField, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '../../data/levels-data.json');
const levelConfigPath = path.join(__dirname, '../../data/level-config.json');

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
        // Ensure data directory exists
        fs.mkdirSync(path.dirname(levelsPath), { recursive: true });
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
        // Ensure data directory exists
        fs.mkdirSync(path.dirname(levelConfigPath), { recursive: true });
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
        enabled: false,
        xpPerMessage: 15,
        xpCooldown: 60000, // 1 minute
        levelUpChannel: null,
        levelRoles: {},
        multipliers: {},
        ignoredChannels: [],
        ignoredRoles: [],
        autoCreateRoles: true // New default: auto-create roles when leveling up
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
    category: 'admin',
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
                        '`%levels config` - Configure leveling system (Requires: Administrator)',
                        '`%levels reset @user` - Reset user\'s XP (Requires: Administrator)',
                        '`%levels reset all` - Reset all XP (dangerous!) (Requires: Administrator)'
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
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need `Administrator` permission to configure levels.')
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
                const wasEnabled = serverConfig.enabled;
                serverConfig.enabled = setting === 'enable';
                
                // If enabling for the first time, set up smart defaults
                if (setting === 'enable' && !wasEnabled) {
                    await this.setupSmartDefaults(message, serverConfig);
                }
                
                saveServerConfig(message.guild.id, serverConfig);
                
                const statusEmbed = new EmbedBuilder()
                    .setTitle(`${serverConfig.enabled ? '✅ Leveling Enabled!' : '❌ Leveling Disabled'}`)
                    .setDescription(serverConfig.enabled ? 
                        'The leveling system is now active! Users will gain XP by chatting.' :
                        'The leveling system has been disabled.')
                    .setColor(serverConfig.enabled ? 0x00FF00 : 0xFF6B6B);
                
                if (serverConfig.enabled && !wasEnabled) {
                    statusEmbed.addFields({
                        name: '🎯 Smart Defaults Applied',
                        value: [
                            `**XP per Message:** ${serverConfig.xpPerMessage}`,
                            `**XP Cooldown:** ${serverConfig.xpCooldown / 1000}s`,
                            `**Level Up Channel:** ${serverConfig.levelUpChannel ? `<#${serverConfig.levelUpChannel}>` : 'Current channel'}`,
                            `**Level Roles:** ${Object.keys(serverConfig.levelRoles).length > 0 ? 'Auto-configured' : 'None (use %createlevelroles)'}`
                        ].join('\n'),
                        inline: false
                    });
                }
                
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

            case 'autocreate':
            case 'autocreateon':
            case 'autocreateoff':
                const autoCreateValue = setting === 'autocreate' ? 
                    (args[1] && args[1].toLowerCase() === 'off' ? false : true) :
                    setting === 'autocreateon';
                
                serverConfig.autoCreateRoles = autoCreateValue;
                saveServerConfig(message.guild.id, serverConfig);
                
                const autoCreateEmbed = new EmbedBuilder()
                    .setDescription(`${autoCreateValue ? '✅' : '❌'} Auto-create level roles ${autoCreateValue ? 'enabled' : 'disabled'}`)
                    .setColor(autoCreateValue ? 0x00FF00 : 0xFF6B6B);
                return sendAsFloofWebhook(message, { embeds: [autoCreateEmbed] });

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
                        `**Level Up Channel:** ${levelUpChannel}`,
                        `**Auto-Create Roles:** ${serverConfig.autoCreateRoles ? '✅ Yes' : '❌ No'}`
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
                        '`%levels config role <level> <@role>` - Set level reward role',
                        '`%levels config autocreate on/off` - Auto-create level roles when users level up'
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

    async setupSmartDefaults(message, serverConfig) {
        try {
            // Auto-detect a suitable level-up channel
            if (!serverConfig.levelUpChannel) {
                // Look for common channel names for announcements
                const channelNames = ['general', 'chat', 'level-ups', 'levels', 'announcements', 'bot-commands'];
                
                for (const name of channelNames) {
                    const channel = message.guild.channels.cache.find(ch => 
                        ch.isTextBased() && ch.name.toLowerCase().includes(name)
                    );
                    if (channel) {
                        serverConfig.levelUpChannel = channel.id;
                        console.log(`Auto-set level up channel to: ${channel.name}`);
                        break;
                    }
                }
                
                // Fallback to current channel if no suitable channel found
                if (!serverConfig.levelUpChannel) {
                    serverConfig.levelUpChannel = message.channel.id;
                }
            }
            
            // Auto-configure level roles if they exist
            const existingLevelRoles = message.guild.roles.cache.filter(role => {
                const roleName = role.name;
                const level = parseInt(roleName);
                return !isNaN(level) && level >= 1 && level <= 100 && roleName === level.toString();
            });
            
            if (existingLevelRoles.size > 0) {
                console.log(`Found ${existingLevelRoles.size} existing level roles, auto-configuring...`);
                existingLevelRoles.forEach(role => {
                    const level = parseInt(role.name);
                    serverConfig.levelRoles[level] = role.id;
                });
            }
            
        } catch (error) {
            console.error('Error setting up smart defaults:', error);
        }
    },

    async createLevelRole(guild, level) {
        try {
            // Check bot permissions
            if (!guild.members.me.permissions.has('ManageRoles')) {
                console.error('Bot missing Manage Roles permission for auto role creation');
                return null;
            }

            const roleName = level.toString();
            const roleColor = this.getLevelRoleColor(level);
            
            // Check if role already exists
            const existingRole = guild.roles.cache.find(role => role.name === roleName);
            if (existingRole) {
                return existingRole;
            }

            // Find position above @everyone but below other level roles
            const everyoneRole = guild.roles.everyone;
            let basePosition = everyoneRole.position + 1;
            
            // Find highest existing level role to position below it
            const existingLevelRoles = guild.roles.cache.filter(role => {
                const name = role.name;
                const lvl = parseInt(name);
                return !isNaN(lvl) && lvl >= 1 && lvl <= 100 && name === lvl.toString();
            });
            
            if (existingLevelRoles.size > 0) {
                const highestLevelRole = existingLevelRoles.reduce((highest, role) => {
                    const roleLevel = parseInt(role.name);
                    const highestLevel = parseInt(highest.name);
                    return roleLevel > highestLevel ? role : highest;
                });
                basePosition = Math.max(basePosition, highestLevelRole.position + 1);
            }

            // Create the role
            const newRole = await guild.roles.create({
                name: roleName,
                color: roleColor,
                permissions: '0', // No special permissions
                reason: `Level ${level} role auto-created by Floof Bot`,
                position: basePosition
            });

            console.log(`Auto-created level role: ${roleName} for guild ${guild.name}`);
            return newRole;
            
        } catch (error) {
            console.error(`Error auto-creating level role for level ${level}:`, error);
            return null;
        }
    },

    getLevelRoleColor(level) {
        // Color progression for level roles (same as createlevelroles.js)
        const LEVEL_COLORS = [
            '#7289DA', // 1-9: Discord Blue
            '#00BFFF', // 10-19: Deep Sky Blue
            '#00FF00', // 20-29: Green
            '#FFD700', // 30-39: Gold
            '#FFA500', // 40-49: Orange
            '#FF4500', // 50-59: Orange Red
            '#FF0000', // 60-69: Red
            '#8A2BE2', // 70-79: Blue Violet
            '#FF1493', // 80-89: Deep Pink
            '#00FFFF'  // 90-100: Cyan
        ];
        
        const colorIndex = Math.floor((level - 1) / 10);
        return LEVEL_COLORS[Math.min(colorIndex, LEVEL_COLORS.length - 1)];
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

        // Auto-create level role if enabled and role doesn't exist
        let levelRole = serverConfig.levelRoles[result.newLevel];
        if (!levelRole && serverConfig.autoCreateRoles) {
            const createdRole = await this.createLevelRole(message.guild, result.newLevel);
            if (createdRole) {
                levelRole = createdRole.id;
                serverConfig.levelRoles[result.newLevel] = levelRole;
                saveServerConfig(message.guild.id, serverConfig);
                
                embed.addFields({
                    name: '✨ New Role Created!',
                    value: `Created ${createdRole} for Level ${result.newLevel}`,
                    inline: false
                });
            }
        }

        // Check for level role reward
        if (levelRole) {
            const role = message.guild.roles.cache.get(levelRole);
            if (role) {
                try {
                    // Check if bot has permission to manage roles
                    if (!message.guild.members.me.permissions.has('ManageRoles')) {
                        console.error('Bot missing Manage Roles permission');
                        embed.addFields({
                            name: '⚠️ Missing Permission',
                            value: 'Bot needs **Manage Roles** permission to assign level roles.',
                            inline: false
                        });
                    } else if (role.position >= message.guild.members.me.roles.highest.position) {
                        console.error(`Role ${role.name} is too high in hierarchy`);
                        embed.addFields({
                            name: '⚠️ Role Hierarchy Issue',
                            value: `Cannot assign ${role} - role is too high in the hierarchy.`,
                            inline: false
                        });
                    } else {
                        await message.member.roles.add(role);
                        embed.addFields({
                            name: '🏆 Reward Unlocked!',
                            value: `You received the ${role} role!`,
                            inline: false
                        });
                        console.log(`Successfully assigned role ${role.name} to ${message.author.username}`);
                    }
                } catch (error) {
                    console.error('Error adding level role:', error);
                    embed.addFields({
                        name: '❌ Role Assignment Failed',
                        value: `Failed to assign ${role}: ${error.message}`,
                        inline: false
                    });
                }
            } else {
                console.error(`Level role ${levelRole} not found for level ${result.newLevel}`);
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
