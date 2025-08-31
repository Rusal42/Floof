const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

// Color progression for level roles
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

// Level tier names
const LEVEL_TIERS = {
    1: 'Newcomer',
    5: 'Member',
    10: 'Regular',
    15: 'Active',
    20: 'Veteran',
    25: 'Elite',
    30: 'Expert',
    35: 'Master',
    40: 'Champion',
    45: 'Hero',
    50: 'Legend',
    60: 'Mythic',
    70: 'Ascended',
    80: 'Divine',
    90: 'Transcendent',
    100: 'Immortal'
};

function getLevelColor(level) {
    const colorIndex = Math.floor((level - 1) / 10);
    return LEVEL_COLORS[Math.min(colorIndex, LEVEL_COLORS.length - 1)];
}

function getLevelName(level) {
    return `${level}`;
}

module.exports = {
    name: 'createlevelroles',
    aliases: ['clr'],
    description: 'Create level roles for the server (Administrator only)',
    usage: '%createlevelroles [start] [end]',
    category: 'admin',
    ownerOnly: false,
    cooldown: 10,

    async execute(message, args) {
        // Check for Administrator permission
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You need **Administrator** permission to use this command.'
            });
        }

        // Check bot permissions
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ I need **Manage Roles** permission to create level roles.'
            });
        }

        // Parse arguments
        let startLevel = 1;
        let endLevel = 100;

        if (args.length >= 1) {
            const start = parseInt(args[0]);
            if (isNaN(start) || start < 1 || start > 100) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Start level must be a number between 1 and 100.'
                });
            }
            startLevel = start;
        }

        if (args.length >= 2) {
            const end = parseInt(args[1]);
            if (isNaN(end) || end < startLevel || end > 100) {
                return await sendAsFloofWebhook(message, {
                    content: `❌ End level must be a number between ${startLevel} and 100.`
                });
            }
            endLevel = end;
        }

        // Confirmation for large ranges
        const roleCount = endLevel - startLevel + 1;
        if (roleCount > 50) {
            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ Large Role Creation')
                .setDescription(`You're about to create **${roleCount}** roles (Level ${startLevel}-${endLevel}).\n\nThis may take several minutes and could hit Discord rate limits.\n\nReply with \`yes\` to continue or \`no\` to cancel.`)
                .setColor('#FFA500');

            await sendAsFloofWebhook(message, { embeds: [confirmEmbed] });

            const filter = (m) => m.author.id === message.author.id && ['yes', 'no'].includes(m.content.toLowerCase());
            
            try {
                const collected = await message.channel.awaitMessages({ 
                    filter, 
                    max: 1, 
                    time: 30000, 
                    errors: ['time'] 
                });
                
                if (collected.first().content.toLowerCase() === 'no') {
                    return await sendAsFloofWebhook(message, {
                        content: '❌ Level role creation cancelled.'
                    });
                }
            } catch (error) {
                return await sendAsFloofWebhook(message, {
                    content: '❌ Confirmation timed out. Level role creation cancelled.'
                });
            }
        }

        // Start creating roles
        await this.createLevelRoles(message, startLevel, endLevel);
    },

    async createLevelRoles(message, startLevel, endLevel) {
        const progressEmbed = new EmbedBuilder()
            .setTitle('🔄 Creating Level Roles...')
            .setDescription('Please wait while I create the level roles. This may take a moment.')
            .setColor('#FFA500');

        const progressMessage = await message.channel.send({ embeds: [progressEmbed] });

        let createdCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Find a reference role to position above (like @everyone or lowest role)
        const everyoneRole = message.guild.roles.everyone;
        let basePosition = everyoneRole.position + 1;

        for (let level = startLevel; level <= endLevel; level++) {
            try {
                const roleName = getLevelName(level);
                const roleColor = getLevelColor(level);

                // Check if role already exists
                const existingRole = message.guild.roles.cache.find(role => role.name === roleName);
                if (existingRole) {
                    skippedCount++;
                    continue;
                }

                // Create the role
                const newRole = await message.guild.roles.create({
                    name: roleName,
                    color: roleColor,
                    permissions: '0', // No special permissions
                    reason: `Level ${level} role created by Floof Bot`,
                    position: basePosition
                });

                createdCount++;

                // Small delay to avoid rate limits
                if (level % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Update progress every 10 roles
                    const updateEmbed = new EmbedBuilder()
                        .setTitle('🔄 Creating Level Roles...')
                        .setDescription(`Progress: ${level}/${endLevel} roles processed\nCreated: ${createdCount} | Skipped: ${skippedCount}`)
                        .setColor('#FFA500');
                    
                    await progressMessage.edit({ embeds: [updateEmbed] });
                }

            } catch (error) {
                console.error(`Error creating role for level ${level}:`, error);
                errors.push(`Level ${level}: ${error.message}`);
            }
        }

        // Auto-configure level roles in the leveling system
        await this.autoConfigureLevelRoles(message, startLevel, endLevel);

        // Final success message
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Level Roles Created Successfully!')
            .setColor('#00FF00')
            .addFields(
                {
                    name: '📊 Summary',
                    value: [
                        `**Created:** ${createdCount} roles`,
                        `**Skipped:** ${skippedCount} roles (already existed)`,
                        `**Range:** Level ${startLevel}-${endLevel}`,
                        `**Auto-configured:** Roles linked to leveling system`
                    ].join('\n'),
                    inline: false
                }
            );

        if (errors.length > 0) {
            successEmbed.addFields({
                name: '⚠️ Errors',
                value: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''),
                inline: false
            });
        }

        successEmbed.addFields({
            name: '🎯 Next Steps',
            value: [
                '• Use `%levels config enable` to enable leveling',
                '• Set a level-up channel with `%levels config channel #channel`',
                '• Users will automatically get roles when they level up!',
                '• Check `%levels config` to view all settings'
            ].join('\n'),
            inline: false
        });

        await progressMessage.edit({ embeds: [successEmbed] });
    },

    async autoConfigureLevelRoles(message, startLevel, endLevel) {
        try {
            // Load leveling system config
            const levelConfigPath = path.join(__dirname, '..', '..', 'data', 'level-config.json');
            let config = {};
            
            if (fs.existsSync(levelConfigPath)) {
                config = JSON.parse(fs.readFileSync(levelConfigPath, 'utf8'));
            }

            if (!config[message.guild.id]) {
                config[message.guild.id] = {
                    enabled: true,
                    xpPerMessage: 15,
                    xpCooldown: 60000,
                    levelUpChannel: null,
                    levelRoles: {},
                    multipliers: {},
                    ignoredChannels: [],
                    ignoredRoles: []
                };
            }

            // Auto-assign roles to levels
            for (let level = startLevel; level <= endLevel; level++) {
                const roleName = getLevelName(level);
                const role = message.guild.roles.cache.find(r => r.name === roleName);
                
                if (role) {
                    config[message.guild.id].levelRoles[level] = role.id;
                }
            }

            // Save config
            fs.writeFileSync(levelConfigPath, JSON.stringify(config, null, 2));

        } catch (error) {
            console.error('Error auto-configuring level roles:', error);
        }
    }
};
