const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    // Use numeric-only role names (e.g., '5')
    return String(level);
}

// Only create milestone levels: 1,3,5,7,10,15, then every 5 to 100
function getMilestoneLevels(start, end) {
    const base = [1, 3, 5, 7, 10, 15];
    for (let l = 20; l <= 100; l += 5) base.push(l);
    const set = new Set(base.filter(l => l >= start && l <= end));
    return Array.from(set).sort((a, b) => a - b);
}

module.exports = {
    name: 'createlevelroles',
    aliases: ['clr', 'makelevelroles', 'autolevelroles'],
    description: 'Automatically create level roles 1-100 with color progression',
    usage: '%createlevelroles [start] [end]',
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    cooldown: 30,

    async execute(message, args) {
        // Check if user has Administrator permission
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You need the **Administrator** permission to use this command.'
            });
        }

        // Check bot permissions
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ I need the **Manage Roles** permission to create level roles!'
            });
        }

        // Parse arguments for custom range
        let startLevel = 1;
        let endLevel = 100;

        if (args.length >= 1) {
            const start = parseInt(args[0]);
            if (!isNaN(start) && start >= 1 && start <= 100) {
                startLevel = start;
            }
        }

        if (args.length >= 2) {
            const end = parseInt(args[1]);
            if (!isNaN(end) && end >= startLevel && end <= 100) {
                endLevel = end;
            }
        }

        const milestoneLevels = getMilestoneLevels(startLevel, endLevel);
        const totalRoles = milestoneLevels.length;

        // Confirmation embed
        const confirmEmbed = new EmbedBuilder()
            .setTitle('🎭 Level Role Creation')
            .setDescription(`About to create **${totalRoles}** level roles (Level ${startLevel}-${endLevel})`)
            .setColor('#FFD700')
            .addFields(
                {
                    name: '📊 Details',
                    value: [
                        `**Range:** Level ${startLevel} to ${endLevel}`,
                        `**Milestones:** ${milestoneLevels.join(', ')}`,
                        `**Total Roles:** ${totalRoles}`,
                        `**Color System:** 10 different colors with progression`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⚠️ Warning',
                    value: [
                        '• This will create many roles in your server',
                        '• Existing roles with same names will be skipped',
                        '• Process may take 1-2 minutes to complete',
                        '• Click "Confirm" to proceed or "Cancel" to abort'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Use the buttons within 30 seconds to confirm' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_clr').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_clr').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const confirmMessage = await sendAsFloofWebhook(message, { embeds: [confirmEmbed], components: [row] });

        try {
            const collector = confirmMessage.channel.createMessageComponentCollector({
                filter: (i) => ['confirm_clr', 'cancel_clr'].includes(i.customId) && i.user.id === message.author.id && i.message.id === confirmMessage.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async (interaction) => {
                await interaction.deferUpdate();
                // disable buttons
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(row.components[0]).setDisabled(true),
                    ButtonBuilder.from(row.components[1]).setDisabled(true)
                );
                // For component interactions on webhook-authored messages, edit via the interaction
                await interaction.editReply({ components: [disabledRow] });

                if (interaction.customId === 'cancel_clr') {
                    return await sendAsFloofWebhook(message, { content: '❌ Level role creation cancelled.' });
                }

                if (interaction.customId === 'confirm_clr') {
                    return await this.createLevelRoles(message, startLevel, endLevel);
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    const disabledRow = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(row.components[0]).setDisabled(true),
                        ButtonBuilder.from(row.components[1]).setDisabled(true)
                    );
                    // Avoid editing webhook-authored messages directly (will 50005). Only edit if not a webhook message.
                    if (!confirmMessage.webhookId) {
                        try {
                            await confirmMessage.edit({ components: [disabledRow] });
                        } catch (_) {
                            // ignore edit failures; we'll still send timeout notice below
                        }
                    }
                    await sendAsFloofWebhook(message, { content: '⏰ Confirmation timed out. Level role creation cancelled.' });
                }
            });
        } catch (error) {
            return await sendAsFloofWebhook(message, { content: '⏰ Confirmation timed out. Level role creation cancelled.' });
        }
    },

    async createLevelRoles(message, startLevel, endLevel) {
        const progressEmbed = new EmbedBuilder()
            .setTitle('🔄 Creating Level Roles...')
            .setDescription('Please wait while I create the level roles. This may take a moment.')
            .setColor('#FFA500');

        const progressMessage = await sendAsFloofWebhook(message, { embeds: [progressEmbed] });

        let createdCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Find a reference role to position above (like @everyone or lowest role)
        const everyoneRole = message.guild.roles.everyone;
        let basePosition = everyoneRole.position + 1;

        const levelsToCreate = getMilestoneLevels(startLevel, endLevel);
        let processed = 0;
        for (const level of levelsToCreate) {
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
                await message.guild.roles.create({
                    name: roleName,
                    color: roleColor,
                    permissions: '0', // No special permissions
                    reason: `Level ${level} role created by Floof Bot`,
                    position: basePosition
                });

                createdCount++;

                processed++;
                // Small delay + progress update every 5 roles
                if (processed % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Update progress every 10 roles
                    const updateEmbed = new EmbedBuilder()
                        .setTitle('🔄 Creating Level Roles...')
                        .setDescription(`Progress: ${processed}/${levelsToCreate.length} roles processed\nCreated: ${createdCount} | Skipped: ${skippedCount}`)
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
            // Load leveling system config (project root level-config.json for compatibility with existing logic)
            const levelConfigPath = path.join(__dirname, '..', 'level-config.json');
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
