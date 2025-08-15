const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'giverole',
    aliases: ['addrole', 'assignrole'],
    description: 'Give a role to a user',
    usage: '%giverole <@user> <role>',
    category: 'roles',
    permissions: [PermissionFlagsBits.ManageRoles],
    cooldown: 3,

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

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Please specify a user and role.\n**Usage:** `%giverole <@user> <role>`\n**Example:** `%giverole @user @VIP` or `%giverole @user "VIP Member"`')
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

        // Check if the role can be assigned (bot's role must be higher)
        if (role.position >= message.guild.members.me.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setDescription('❌ I cannot assign this role because it is higher than or equal to my highest role.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Check if user already has the role
        if (member.roles.cache.has(role.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ ${targetUser.tag} already has the **${role.name}** role.`)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        try {
            await member.roles.add(role, `Role given by ${message.author.tag}`);

            const embed = new EmbedBuilder()
                .setTitle('✅ Role Assigned Successfully!')
                .setDescription(`**${role.name}** has been given to ${targetUser}.`)
                .addFields(
                    { name: '👤 User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: '🏷️ Role', value: `${role.name} (${role.id})`, inline: true }
                )
                .setColor(role.color || 0x00FF00)
                .setFooter({ text: `Assigned by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });

        } catch (error) {
            console.error('Error giving role:', error);
            
            let errorMessage = '❌ An error occurred while assigning the role.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to assign this role. Make sure my role is above the role I need to assign.';
            }

            const embed = new EmbedBuilder()
                .setDescription(errorMessage)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    }
};
