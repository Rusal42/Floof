const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

/**
 * Usage: %makerolemenu label role1 role2 ...
 * Example: %makerolemenu pronouns he/him she/her they/them any!
 * Sends a multi-select role menu to a specific channel.
 */
async function makeRoleMenu(message, args) {
    const OWNER_ID = '1007799027716329484';
    const TARGET_CHANNEL_ID = '1393670713042534480';
    if (message.author.id !== OWNER_ID) return;
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply('Floof needs Manage Roles permission to create and assign roles!');
    }
    if (!args[1]) {
        return message.reply('Usage: %makerolemenu label role1 role2 ...');
    }
    const label = args[1];
    const roleNames = args.slice(2);
    if (!roleNames.length) {
        return message.reply('Please specify at least one role!');
    }

    // Create roles if missing
    const roles = [];
    for (const name of roleNames) {
        let role = message.guild.roles.cache.find(r => r.name === name);
        if (!role) {
            try {
                role = await message.guild.roles.create({ name, permissions: 0, reason: 'Floof role menu setup' });
            } catch (e) { continue; }
        }
        roles.push(role);
    }

    // Build select menu
    const menu = new StringSelectMenuBuilder()
        .setCustomId('floof_role_menu_' + Date.now())
        .setPlaceholder('Choose your ' + label + '!')
        .setMinValues(0)
        .setMaxValues(roles.length)
        .addOptions(roles.map(role => new StringSelectMenuOptionBuilder()
            .setLabel(role.name)
            .setValue(role.id)
            .setEmoji('🐾')
        ));

    const row = new ActionRowBuilder().addComponents(menu);
    const embed = new EmbedBuilder()
        .setTitle('🐾 Pick your ' + label + '!')
        .setDescription('Select one or more ' + label + ' below!')
        .setColor(0xffb6c1);

    // Send to the specified channel
    const channel = message.guild.channels.cache.get(TARGET_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
        return message.reply('Could not find the target channel for the role menu!');
    }
    await channel.send({ embeds: [embed], components: [row] });
    await message.reply('Role menu sent to <#' + TARGET_CHANNEL_ID + '>!');
}

// Interaction handler (to be called from your main event handler)
async function handleRoleMenuInteraction(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('floof_role_menu_')) return;
    const member = interaction.member;
    const selectedRoleIds = interaction.values;
    const allRoleIds = interaction.component.options.map(opt => opt.value);
    // Remove roles not selected
    for (const roleId of allRoleIds) {
        if (member.roles.cache.has(roleId) && !selectedRoleIds.includes(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
        }
    }
    // Add selected roles
    for (const roleId of selectedRoleIds) {
        if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => {});
        }
    }
    await interaction.reply({ content: 'Roles updated! (ฅ^•ﻌ•^ฅ)♡', flags: 64 });
}

module.exports = { makeRoleMenu, handleRoleMenuInteraction };
