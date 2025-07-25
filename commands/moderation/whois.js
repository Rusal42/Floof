const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'whois',
    description: 'Get detailed information about a user',
    usage: '%whois [@user|userID]',
    category: 'moderation',
    aliases: ['userinfo', 'ui'],
    permissions: null,
    cooldown: 3,

    async execute(message, args) {
        let user = message.author; // Default to command author
        let member = message.member; // Default to command author's member object

        // If user provided an argument, try to get the mentioned user or fetch by ID
        if (args.length > 0) {
            // Try to get user from mention first
            const mentionedUser = message.mentions.users.first();
            
            if (mentionedUser) {
                user = mentionedUser;
                try {
                    member = await message.guild.members.fetch(user.id);
                } catch (error) {
                    member = null; // User not in guild
                }
            } else {
                // Try to fetch user by ID
                try {
                    user = await message.client.users.fetch(args[0]);
                    try {
                        member = await message.guild.members.fetch(user.id);
                    } catch (error) {
                        member = null; // User not in guild
                    }
                } catch (error) {
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('❌ User not found. Please mention a valid user or provide a valid user ID.')
                        .setColor(0xff0000);
                    await sendAsFloofWebhook(message, { embeds: [errorEmbed] });
                    return message.delete().catch(() => {});
                }
            }
        }

        // Create user info embed
        const whoisEmbed = new EmbedBuilder()
            .setTitle(`User Information: ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setColor(member ? (member.displayHexColor === '#000000' ? 0x9966cc : member.displayColor) : 0x9966cc)
            .addFields(
                { name: '👤 Username', value: user.username, inline: true },
                { name: '🏷️ Display Name', value: user.displayName || user.username, inline: true },
                { name: '🆔 User ID', value: user.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false }
            );

        // Add server-specific information if user is in the guild
        if (member) {
            const roles = member.roles.cache
                .filter(role => role.id !== message.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, 10); // Limit to 10 roles to avoid embed limits

            whoisEmbed.addFields(
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: false },
                { name: '🎭 Nickname', value: member.nickname || 'None', inline: true },
                { name: '🎨 Highest Role', value: member.roles.highest.toString(), inline: true },
                { name: '📊 Status', value: member.presence?.status || 'offline', inline: true },
                { 
                    name: `🏷️ Roles [${member.roles.cache.size - 1}]`, 
                    value: roles.length > 0 ? roles.join(', ') : 'None', 
                    inline: false 
                }
            );

            // Add permissions if user has notable permissions
            const keyPermissions = [];
            if (member.permissions.has(PermissionsBitField.Flags.Administrator)) keyPermissions.push('Administrator');
            if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) keyPermissions.push('Manage Server');
            if (member.permissions.has(PermissionsBitField.Flags.ManageChannels)) keyPermissions.push('Manage Channels');
            if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) keyPermissions.push('Manage Messages');
            if (member.permissions.has(PermissionsBitField.Flags.BanMembers)) keyPermissions.push('Ban Members');
            if (member.permissions.has(PermissionsBitField.Flags.KickMembers)) keyPermissions.push('Kick Members');

            if (keyPermissions.length > 0) {
                whoisEmbed.addFields({ 
                    name: '🔑 Key Permissions', 
                    value: keyPermissions.join(', '), 
                    inline: false 
                });
            }
        } else {
            whoisEmbed.addFields({ 
                name: '⚠️ Server Status', 
                value: 'Not in this server', 
                inline: false 
            });
        }

        whoisEmbed.setFooter({ 
            text: `Requested by ${message.author.username}`, 
            iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        }).setTimestamp();

        // Send embed via webhook
        await sendAsFloofWebhook(message, { embeds: [whoisEmbed] });
        
        // Delete original command message
        message.delete().catch(() => {});
    }
};
