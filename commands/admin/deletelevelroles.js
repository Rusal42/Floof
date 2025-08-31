const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'deletelevelroles',
    aliases: ['dlr', 'removelevelroles'],
    description: 'Delete all level roles from the server (Administrator only)',
    usage: '%deletelevelroles [confirm]',
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
                content: '❌ I need **Manage Roles** permission to delete level roles.'
            });
        }

        // Find all level roles (numeric names from 1-100)
        const levelRoles = message.guild.roles.cache.filter(role => {
            const roleName = role.name;
            const level = parseInt(roleName);
            return !isNaN(level) && level >= 1 && level <= 100 && roleName === level.toString();
        });

        if (levelRoles.size === 0) {
            return await sendAsFloofWebhook(message, {
                content: '❌ No level roles found in this server. Level roles are numeric roles from 1-100.'
            });
        }

        // Show confirmation prompt with button
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Delete All Level Roles')
            .setDescription([
                `**Found ${levelRoles.size} level roles to delete:**`,
                `${levelRoles.map(role => `• ${role.name}`).slice(0, 10).join('\n')}`,
                levelRoles.size > 10 ? `... and ${levelRoles.size - 10} more` : '',
                '',
                '**This action cannot be undone!**'
            ].filter(line => line !== '').join('\n'))
            .setColor('#FF4444')
            .setFooter({ text: 'This will also remove level role configurations from the leveling system.' });

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_delete_level_roles')
            .setLabel('Delete All Level Roles')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete_level_roles')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌');

        const row = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);

        const confirmMessage = await message.channel.send({ 
            embeds: [confirmEmbed], 
            components: [row] 
        });

        // Create button collector
        const collector = confirmMessage.createMessageComponentCollector({
            time: 60000 // 1 minute timeout
        });

        collector.on('collect', async (interaction) => {
            // Check if the user who clicked is the same as who ran the command
            if (interaction.user.id !== message.author.id) {
                return await interaction.reply({
                    content: '❌ Only the user who ran this command can confirm the deletion.',
                    ephemeral: true
                });
            }

            if (interaction.customId === 'confirm_delete_level_roles') {
                await interaction.update({ 
                    embeds: [confirmEmbed], 
                    components: [] 
                });
                
                // Start deleting roles
                await this.deleteLevelRoles(message, levelRoles);
                
            } else if (interaction.customId === 'cancel_delete_level_roles') {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ Deletion Cancelled')
                    .setDescription('Level role deletion has been cancelled.')
                    .setColor('#00FF00');

                await interaction.update({ 
                    embeds: [cancelEmbed], 
                    components: [] 
                });
            }
            
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Confirmation Timeout')
                    .setDescription('Level role deletion confirmation timed out.')
                    .setColor('#FFA500');

                try {
                    await confirmMessage.edit({ 
                        embeds: [timeoutEmbed], 
                        components: [] 
                    });
                } catch (error) {
                    // Message might have been deleted, ignore error
                }
            }
        });
    },

    async deleteLevelRoles(message, levelRoles) {
        const progressEmbed = new EmbedBuilder()
            .setTitle('🗑️ Deleting Level Roles...')
            .setDescription('Please wait while I delete the level roles. This may take a moment.')
            .setColor('#FF4444');

        const progressMessage = await message.channel.send({ embeds: [progressEmbed] });

        let deletedCount = 0;
        const errors = [];
        const roleArray = Array.from(levelRoles.values());

        for (let i = 0; i < roleArray.length; i++) {
            const role = roleArray[i];
            
            try {
                await role.delete(`Level roles deleted by ${message.author.tag} using Floof Bot`);
                deletedCount++;

                // Small delay to avoid rate limits
                if ((i + 1) % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Update progress every 10 roles
                    const updateEmbed = new EmbedBuilder()
                        .setTitle('🗑️ Deleting Level Roles...')
                        .setDescription(`Progress: ${i + 1}/${roleArray.length} roles processed\nDeleted: ${deletedCount}`)
                        .setColor('#FF4444');
                    
                    await progressMessage.edit({ embeds: [updateEmbed] });
                }

            } catch (error) {
                console.error(`Error deleting role ${role.name}:`, error);
                errors.push(`${role.name}: ${error.message}`);
            }
        }

        // Clean up level role configurations
        await this.cleanupLevelRoleConfig(message, roleArray);

        // Final success message
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Level Roles Deleted Successfully!')
            .setColor('#00FF00')
            .addFields(
                {
                    name: '📊 Summary',
                    value: [
                        `**Deleted:** ${deletedCount} roles`,
                        `**Total Found:** ${roleArray.length} roles`,
                        `**Cleaned:** Level role configurations removed`
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
            name: '💡 Next Steps',
            value: [
                '• Level roles have been completely removed',
                '• Users will no longer receive level roles when leveling up',
                '• Use `%createlevelroles` to recreate level roles if needed',
                '• Check `%levels config` to view current leveling settings'
            ].join('\n'),
            inline: false
        });

        await progressMessage.edit({ embeds: [successEmbed] });
    },

    async cleanupLevelRoleConfig(message, deletedRoles) {
        try {
            // Load leveling system config
            const levelConfigPath = path.join(__dirname, '..', '..', 'data', 'level-config.json');
            
            if (!fs.existsSync(levelConfigPath)) {
                return; // No config file exists
            }

            const config = JSON.parse(fs.readFileSync(levelConfigPath, 'utf8'));

            if (!config[message.guild.id]) {
                return; // No config for this guild
            }

            // Remove all level role configurations
            config[message.guild.id].levelRoles = {};

            // Save updated config
            fs.writeFileSync(levelConfigPath, JSON.stringify(config, null, 2));

        } catch (error) {
            console.error('Error cleaning up level role config:', error);
        }
    }
};
