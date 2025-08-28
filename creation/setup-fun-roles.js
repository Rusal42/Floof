const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

// Fun/interest roles (edit this list as you wish)
const FUN_ROLES = [
    'gaming', 'anime', 'art', 'music', 'memes', 'books', 'tech', 'pets', 'animals', 'fitness', 'foodies',
    'announcements', 'events', 'giveaways', 'movie night', 'birthday ping',
    'introvert', 'extrovert', 'night owl', 'early bird', 'lurker', 'chatterbox',
    'PC gamer', 'console gamer', 'mobile gamer', 'Switch', 'PlayStation', 'Xbox'
];

async function postFunRolesMenus(channel, roleNames) {
    if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid target channel for fun roles menu');
    }
    const guild = channel.guild;
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        throw new Error('Manage Roles permission required to create/assign roles');
    }
    const names = Array.isArray(roleNames) && roleNames.length ? roleNames : FUN_ROLES;
    const createdRoles = [];
    for (const name of names) {
        let role = guild.roles.cache.find(r => r.name === name);
        if (!role) {
            try {
                role = await guild.roles.create({ name, permissions: 0, reason: 'Floof fun role setup' });
            } catch (e) {
                continue;
            }
        }
        if (role) createdRoles.push(role);
    }
    if (createdRoles.length === 0) {
        throw new Error('No fun roles were found or created');
    }
    const chunkedRoles = [];
    for (let i = 0; i < createdRoles.length; i += 25) {
        chunkedRoles.push(createdRoles.slice(i, i + 25));
    }
    for (let i = 0; i < chunkedRoles.length; i++) {
        const rolesChunk = chunkedRoles[i];
        const menu = new StringSelectMenuBuilder()
            .setCustomId('floof_role_menu_' + i + '_' + Date.now())
            .setPlaceholder('Choose your fun roles!')
            .setMinValues(0)
            .setMaxValues(rolesChunk.length)
            .addOptions(rolesChunk.map(role => new StringSelectMenuOptionBuilder()
                .setLabel(role.name)
                .setValue(role.id)
                .setEmoji('🎉')
            ));
        const row = new ActionRowBuilder().addComponents(menu);
        const embed = new EmbedBuilder()
            .setTitle('🎉 Pick your Fun Roles!')
            .setDescription('Select one or more fun/interest roles below!')
            .setColor(0x00bfff);
        await channel.send({ embeds: [embed], components: [row] });
    }
}

module.exports = { postFunRolesMenus };
