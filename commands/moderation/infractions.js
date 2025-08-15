const fs = require('fs');
const path = require('path');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

const infractionsPath = path.join(__dirname, '../../infractions.json');

function loadInfractions() {
    if (!fs.existsSync(infractionsPath)) return {};
    const data = JSON.parse(fs.readFileSync(infractionsPath));
    // Migrate legacy format (flat userId keys) to per-guild
    if (data && !Object.keys(data).some(k => k.length === 18 && !isNaN(Number(k)))) {
        // Already per-guild
        return data;
    }
    // Legacy: move all users under current guild
    const migrated = {};
    if (typeof data === 'object' && data !== null) {
        const currentGuildId = globalThis._activeGuildId;
        if (currentGuildId) migrated[currentGuildId] = data;
    }
    return migrated;
}

module.exports = {
    name: 'infractions',
    aliases: ['warnings', 'warns', 'inf', 'w'],
    description: 'View infractions for a user or all users',
    usage: '%infractions [@user]',
    category: 'moderation',
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    cooldown: 3,

    async execute(message, args) {
        // Check if user has permission to moderate members
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need the `Moderate Members` permission to use this command.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const infractions = loadInfractions();
        const guildInfractions = infractions[message.guild.id] || {};

        // If a user is mentioned, show their infractions
        if (message.mentions.users.size > 0) {
            const targetUser = message.mentions.users.first();
            const userInfractions = guildInfractions[targetUser.id] || [];

            if (userInfractions.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`📋 Infractions for ${targetUser.tag}`)
                    .setDescription('✅ This user has no infractions.')
                    .setColor(0x00FF00)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                return sendAsFloofWebhook(message, { embeds: [embed] });
            }

            // Format infractions
            const infractionList = userInfractions.map((infraction, index) => {
                const date = new Date(infraction.timestamp).toLocaleDateString();
                const time = new Date(infraction.timestamp).toLocaleTimeString();
                return `**${index + 1}.** ${infraction.type.toUpperCase()}\n` +
                       `**Reason:** ${infraction.reason || 'No reason provided'}\n` +
                       `**Moderator:** ${infraction.moderator || 'Unknown'}\n` +
                       `**Date:** ${date} at ${time}\n`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`⚠️ Infractions for ${targetUser.tag}`)
                .setDescription(infractionList.length > 2048 ? infractionList.substring(0, 2045) + '...' : infractionList)
                .addFields(
                    { name: '📊 Summary', value: `**Total Infractions:** ${userInfractions.length}\n**Warns:** ${userInfractions.filter(i => i.type === 'warn').length}\n**Timeouts:** ${userInfractions.filter(i => i.type === 'timeout').length}`, inline: true }
                )
                .setColor(0xFF6B6B)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Show all users with infractions
        const usersWithInfractions = Object.keys(guildInfractions).filter(userId => 
            guildInfractions[userId] && guildInfractions[userId].length > 0
        );

        if (usersWithInfractions.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📋 Server Infractions')
                .setDescription('✅ No infractions found in this server.')
                .setColor(0x00FF00)
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Create summary of all users with infractions
        const userSummaries = [];
        for (const userId of usersWithInfractions) {
            try {
                const user = await message.client.users.fetch(userId);
                const userInfractions = guildInfractions[userId];
                const warnCount = userInfractions.filter(i => i.type === 'warn').length;
                const timeoutCount = userInfractions.filter(i => i.type === 'timeout').length;
                
                userSummaries.push(
                    `**${user.tag}** (${userInfractions.length} total)\n` +
                    `Warns: ${warnCount} | Timeouts: ${timeoutCount}`
                );
            } catch (error) {
                userSummaries.push(`**Unknown User** (${userId}) - ${guildInfractions[userId].length} infractions`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Server Infractions Summary')
            .setDescription(userSummaries.join('\n\n'))
            .addFields(
                { name: '📊 Server Stats', value: `**Users with infractions:** ${usersWithInfractions.length}\n**Total infractions:** ${usersWithInfractions.reduce((total, userId) => total + guildInfractions[userId].length, 0)}`, inline: false },
                { name: '💡 Usage', value: 'Use `%infractions @user` to see detailed infractions for a specific user.', inline: false }
            )
            .setColor(0xFF6B6B)
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
