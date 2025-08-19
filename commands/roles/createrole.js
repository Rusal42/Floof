const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');

module.exports = {
    name: 'createrole',
    aliases: ['addrole', 'newrole'],
    description: 'Create a new role in the server',
    usage: '%createrole <name> [color] [hoist] [mentionable]',
    category: 'roles',
    permissions: [PermissionFlagsBits.ManageRoles],
    cooldown: 5,

    async execute(message, args) {
        // Standardized permission check
        if (!(await requirePerms(message, PermissionFlagsBits.ManageRoles, 'create roles'))) return;

        // Check if bot has permission to manage roles
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ I need the `Manage Roles` permission to execute this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please provide a role name.\n**Usage:** `%createrole <name> [color] [hoist] [mentionable]`\n**Example:** `%createrole "VIP Member" #ff0000 true false`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const roleName = args[0];
        const colorInput = args[1] || null;
        const hoist = args[2] ? args[2].toLowerCase() === 'true' : false;
        const mentionable = args[3] ? args[3].toLowerCase() === 'true' : false;

        // Parse color
        let color = null;
        if (colorInput) {
            if (colorInput.startsWith('#')) {
                color = parseInt(colorInput.slice(1), 16);
            } else if (colorInput.startsWith('0x')) {
                color = parseInt(colorInput, 16);
            } else {
                // Try to parse as hex without prefix
                const hexColor = parseInt(colorInput, 16);
                if (!isNaN(hexColor)) {
                    color = hexColor;
                }
            }
            
            if (isNaN(color) || color < 0 || color > 0xFFFFFF) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ Invalid color format. Use hex format like `#ff0000` or `0xff0000`.')
                    .setColor(0xFF0000);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }

        try {
            const role = await message.guild.roles.create({
                name: roleName,
                color: color,
                hoist: hoist,
                mentionable: mentionable,
                reason: `Role created by ${message.author.tag}`
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Role Created Successfully!')
                .setDescription(`**${role.name}** has been created.`)
                .addFields(
                    { name: '🏷️ Role Info', value: `**Name:** ${role.name}\n**ID:** ${role.id}\n**Color:** ${color ? `#${color.toString(16).padStart(6, '0')}` : 'Default'}\n**Hoisted:** ${hoist ? 'Yes' : 'No'}\n**Mentionable:** ${mentionable ? 'Yes' : 'No'}`, inline: false }
                )
                .setColor(role.color || 0x00FF00)
                .setFooter({ text: `Created by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });

        } catch (error) {
            console.error('Error creating role:', error);
            
            let errorMessage = '❌ An error occurred while creating the role.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to create roles. Make sure my role is above the roles I need to manage.';
            } else if (error.code === 50035) {
                errorMessage = '❌ Invalid role data provided.';
            }

            const embed = new EmbedBuilder()
                .setDescription(errorMessage)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
