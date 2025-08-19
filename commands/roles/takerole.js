const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');

module.exports = {
    name: 'takerole',
    aliases: ['removerole', 'unassignrole'],
    description: 'Remove a role from a user',
    usage: '%takerole <@user> <role>',
    category: 'roles',
    permissions: [PermissionFlagsBits.ManageRoles],
    cooldown: 3,

    async execute(message, args) {
        // Standardized permission check
        if (!(await requirePerms(message, PermissionFlagsBits.ManageRoles, 'remove roles'))) return;

        // Check if bot has permission to manage roles
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ I need the `Manage Roles` permission to execute this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please specify a user and role.\n**Usage:** `%takerole <@user> <role>`\n**Example:** `%takerole @user @VIP` or `%takerole @user "VIP Member"`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Get the target user
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please mention a valid user.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const member = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            const embed = new EmbedBuilder()
                .setDescription('❌ User not found in this server.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Find the role
        let role = null;
        const roleInput = args.slice(1).join(' ');

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

        // Check if the role can be removed (bot's role must be higher)
        if (role.position >= message.guild.members.me.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setDescription('❌ I cannot remove this role because it is higher than or equal to my highest role.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if user has the role
        if (!member.roles.cache.has(role.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ ${targetUser.tag} doesn't have the **${role.name}** role.`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        try {
            await member.roles.remove(role, `Role removed by ${message.author.tag}`);

            const embed = new EmbedBuilder()
                .setTitle('✅ Role Removed Successfully!')
                .setDescription(`**${role.name}** has been removed from ${targetUser}.`)
                .addFields(
                    { name: '👤 User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: '🏷️ Role', value: `${role.name} (${role.id})`, inline: true }
                )
                .setColor(0xFF0000)
                .setFooter({ text: `Removed by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });

        } catch (error) {
            console.error('Error removing role:', error);
            
            let errorMessage = '❌ An error occurred while removing the role.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to remove this role. Make sure my role is above the role I need to remove.';
            }

            const embed = new EmbedBuilder()
                .setDescription(errorMessage)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
