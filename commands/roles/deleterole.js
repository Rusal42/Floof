const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'deleterole',
    aliases: ['removerole', 'destroyrole'],
    description: 'Delete a role from the server',
    usage: '%deleterole <role>',
    category: 'roles',
    permissions: [PermissionFlagsBits.ManageRoles],
    cooldown: 5,

    async execute(message, args) {
        // Check if user has permission to manage roles
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need the `Manage Roles` permission to use this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if bot has permission to manage roles
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ I need the `Manage Roles` permission to execute this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please specify a role to delete.\n**Usage:** `%deleterole <role>`\n**Example:** `%deleterole @VIP` or `%deleterole "VIP Member"`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Find the role
        let role = null;
        const roleInput = args.join(' ');

        // Try to find by mention first
        if (message.mentions.roles.size > 0) {
            role = message.mentions.roles.first();
        } else {
            // Try to find by name or ID
            role = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === roleInput.toLowerCase() || 
                r.id === roleInput
            );
        }

        if (!role) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ Could not find role "${roleInput}". Make sure the role exists and try using @role mention or exact role name.`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if the role can be deleted (bot's role must be higher)
        if (role.position >= message.guild.members.me.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setDescription('❌ I cannot delete this role because it is higher than or equal to my highest role.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if it's a system role
        if (role.managed) {
            const embed = new EmbedBuilder()
                .setDescription('❌ This role is managed by an integration (like a bot) and cannot be deleted.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Store role info before deletion
        const roleInfo = {
            name: role.name,
            id: role.id,
            color: role.color,
            memberCount: role.members.size
        };

        try {
            await role.delete(`Role deleted by ${message.author.tag}`);

            const embed = new EmbedBuilder()
                .setTitle('✅ Role Deleted Successfully!')
                .setDescription(`**${roleInfo.name}** has been deleted.`)
                .addFields(
                    { name: '🗑️ Deleted Role Info', value: `**Name:** ${roleInfo.name}\n**ID:** ${roleInfo.id}\n**Members:** ${roleInfo.memberCount}\n**Color:** ${roleInfo.color ? `#${roleInfo.color.toString(16).padStart(6, '0')}` : 'Default'}`, inline: false }
                )
                .setColor(0xFF0000)
                .setFooter({ text: `Deleted by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });

        } catch (error) {
            console.error('Error deleting role:', error);
            
            let errorMessage = '❌ An error occurred while deleting the role.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to delete this role. Make sure my role is above the role I need to delete.';
            }

            const embed = new EmbedBuilder()
                .setDescription(errorMessage)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
