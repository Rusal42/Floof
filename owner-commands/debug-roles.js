const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { isOwner } = require('../utils/owner-util');

module.exports = {
    name: 'debug-roles',
    aliases: ['dr'],
    description: 'Debug role hierarchy and permissions',
    usage: '%debug-roles [pattern]',
    category: 'owner',
    ownerOnly: true,

    async execute(message, args) {
        if (!isOwner(message.author.id)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Only the bot owner can use this command.'
            });
        }

        const pattern = args.join(' ') || 'level';
        const guild = message.guild;
        const botMember = guild.members.me;
        const botHighestRole = botMember.roles.highest;

        // Find all roles matching pattern
        const allMatchingRoles = guild.roles.cache.filter(role => 
            role.name.toLowerCase().includes(pattern.toLowerCase())
        );

        // Separate by deletable/non-deletable
        const deletableRoles = allMatchingRoles.filter(role => 
            role.position < botHighestRole.position && !role.managed
        );

        const nonDeletableRoles = allMatchingRoles.filter(role => 
            role.position >= botHighestRole.position || role.managed
        );

        const embed = new EmbedBuilder()
            .setTitle('🔍 Role Debug Information')
            .setColor('#00BFFF')
            .addFields(
                {
                    name: '🤖 Bot Information',
                    value: [
                        `**Bot Role:** ${botHighestRole.name}`,
                        `**Bot Position:** ${botHighestRole.position}`,
                        `**Manage Roles:** ${botMember.permissions.has('ManageRoles') ? '✅' : '❌'}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `📊 Roles containing "${pattern}"`,
                    value: [
                        `**Total Found:** ${allMatchingRoles.size}`,
                        `**Deletable:** ${deletableRoles.size}`,
                        `**Non-Deletable:** ${nonDeletableRoles.size}`
                    ].join('\n'),
                    inline: false
                }
            );

        if (deletableRoles.size > 0) {
            const deletableList = deletableRoles.map(role => 
                `${role.name} (pos: ${role.position})`
            ).slice(0, 10).join('\n');
            
            embed.addFields({
                name: '✅ Deletable Roles',
                value: deletableList + (deletableRoles.size > 10 ? `\n... and ${deletableRoles.size - 10} more` : ''),
                inline: false
            });
        }

        if (nonDeletableRoles.size > 0) {
            const nonDeletableList = nonDeletableRoles.map(role => {
                const reason = role.managed ? '(managed)' : `(pos: ${role.position} >= ${botHighestRole.position})`;
                return `${role.name} ${reason}`;
            }).slice(0, 10).join('\n');
            
            embed.addFields({
                name: '❌ Non-Deletable Roles',
                value: nonDeletableList + (nonDeletableRoles.size > 10 ? `\n... and ${nonDeletableRoles.size - 10} more` : ''),
                inline: false
            });
        }

        if (nonDeletableRoles.size > 0) {
            embed.addFields({
                name: '💡 Solution',
                value: [
                    '**To delete higher roles:**',
                    '1. Move bot role above level roles in Server Settings',
                    '2. Or use Discord\'s built-in role management',
                    '3. Ensure bot has "Manage Roles" permission'
                ].join('\n'),
                inline: false
            });
        }

        return await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
