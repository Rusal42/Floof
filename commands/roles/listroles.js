const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'listroles',
    aliases: ['roles', 'showroles'],
    description: 'List all roles in the server',
    usage: '%listroles [user]',
    category: 'roles',
    cooldown: 3,

    async execute(message, args) {
        // If a user is mentioned, show their roles
        if (message.mentions.users.size > 0) {
            const targetUser = message.mentions.users.first();
            const member = await message.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!member) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ User not found in this server.')
                    .setColor(0xFF0000);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }

            const userRoles = member.roles.cache
                .filter(role => role.id !== message.guild.id) // Exclude @everyone
                .sort((a, b) => b.position - a.position)
                .map(role => `${role}`)
                .join('\n') || 'No roles';

            const embed = new EmbedBuilder()
                .setTitle(`🏷️ ${targetUser.tag}'s Roles`)
                .setDescription(userRoles.length > 2048 ? userRoles.substring(0, 2045) + '...' : userRoles)
                .addFields(
                    { name: '📊 Role Count', value: `${member.roles.cache.size - 1} roles`, inline: true },
                    { name: '🎨 Highest Role', value: member.roles.highest.name, inline: true }
                )
                .setColor(member.displayHexColor || 0x00FF00)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Show all server roles
        const roles = message.guild.roles.cache
            .filter(role => role.id !== message.guild.id) // Exclude @everyone
            .sort((a, b) => b.position - a.position);

        if (roles.size === 0) {
            const embed = new EmbedBuilder()
                .setDescription('❌ No roles found in this server.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const roleList = roles.map(role => {
            const memberCount = role.members.size;
            const color = role.hexColor !== '#000000' ? role.hexColor : '';
            return `${role} ${color ? `\`${color}\`` : ''} - ${memberCount} member${memberCount !== 1 ? 's' : ''}`;
        }).join('\n');

        // Split into multiple embeds if too long
        const maxLength = 2048;
        if (roleList.length <= maxLength) {
            const embed = new EmbedBuilder()
                .setTitle(`🏷️ Server Roles (${roles.size})`)
                .setDescription(roleList)
                .addFields(
                    { name: '📊 Statistics', value: `**Total Roles:** ${roles.size}\n**Hoisted Roles:** ${roles.filter(r => r.hoist).size}\n**Mentionable Roles:** ${roles.filter(r => r.mentionable).size}`, inline: false }
                )
                .setColor(0x00FF00)
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });
        } else {
            // Split into multiple embeds
            const chunks = [];
            let currentChunk = '';
            
            for (const line of roleList.split('\n')) {
                if ((currentChunk + line + '\n').length > maxLength) {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                } else {
                    currentChunk += line + '\n';
                }
            }
            if (currentChunk) chunks.push(currentChunk);

            const embeds = chunks.map((chunk, index) => {
                const embed = new EmbedBuilder()
                    .setTitle(index === 0 ? `🏷️ Server Roles (${roles.size})` : `🏷️ Server Roles (continued)`)
                    .setDescription(chunk)
                    .setColor(0x00FF00);

                if (index === 0) {
                    embed.addFields(
                        { name: '📊 Statistics', value: `**Total Roles:** ${roles.size}\n**Hoisted Roles:** ${roles.filter(r => r.hoist).size}\n**Mentionable Roles:** ${roles.filter(r => r.mentionable).size}`, inline: false }
                    );
                }

                if (index === chunks.length - 1) {
                    embed.setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                         .setTimestamp();
                }

                return embed;
            });

            return sendAsFloofWebhook(message, { embeds: embeds });
        }
    }
};
