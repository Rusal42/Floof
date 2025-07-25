const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

// Fun/interest roles (edit this list as you wish)
const FUN_ROLES = [
    'gaming', 'anime', 'art', 'music', 'memes', 'books', 'tech', 'pets', 'animals', 'fitness', 'foodies',
    'announcements', 'events', 'giveaways', 'movie night', 'birthday ping',
    'introvert', 'extrovert', 'night owl', 'early bird', 'lurker', 'chatterbox',
    'PC gamer', 'console gamer', 'mobile gamer', 'Switch', 'PlayStation', 'Xbox'
];

const OWNER_ID = '1007799027716329484';
const TARGET_CHANNEL_ID = '1393670713042534480';

/**
 * Usage: %setupfunroles
 * Creates all fun/interest roles and posts select menus in the target channel.
 */
async function setupFunRoles(message) {
    if (message.author.id !== OWNER_ID) return;
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply('Floof needs Manage Roles permission to create and assign roles!');
    }
    const createdRoles = [];
    for (const name of FUN_ROLES) {
        let role = message.guild.roles.cache.find(r => r.name === name);
        if (!role) {
            try {
                role = await message.guild.roles.create({ name, permissions: [], reason: 'Floof fun role setup' });
            } catch (e) { 
                console.error('Error creating role:', name, e);
                continue; 
            }
        }
        if (role) createdRoles.push(role);
    }
    console.log('setupFunRoles: createdRoles:', createdRoles.map(r => ({name: r.name, id: r.id})));

    if (createdRoles.length === 0) {
        console.error('setupFunRoles: No roles found/created!');
        return message.reply('No fun roles were found or created.');
    }

    // Chunk roles into groups of 25 for Discord select menu limit
    const chunkedRoles = [];
    for (let i = 0; i < createdRoles.length; i += 25) {
        chunkedRoles.push(createdRoles.slice(i, i + 25));
    }
    console.log('setupFunRoles: chunkedRoles:', chunkedRoles.map(chunk => chunk.map(r => r.name)));

    const channel = message.guild.channels.cache.get(TARGET_CHANNEL_ID);
    console.log('setupFunRoles: channel:', channel ? {id: channel.id, name: channel.name, isText: channel.isTextBased()} : null);
    if (!channel || !channel.isTextBased()) {
        return message.reply('Could not find the target channel for the fun roles menu!');
    }

    for (let i = 0; i < chunkedRoles.length; i++) {
        const rolesChunk = chunkedRoles[i];
        const menu = new StringSelectMenuBuilder()
            .setCustomId('floof_fun_roles_' + i + '_' + Date.now())
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
    await message.reply('Fun roles menus sent to <#' + TARGET_CHANNEL_ID + '>!');
}

module.exports = { setupFunRoles };
