const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

// Post a role menu to a channel. Creates missing roles by name if needed.
async function postRoleMenu(channel, label, rolesOrNames = []) {
    if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid target channel for role menu');
    }
    const guild = channel.guild;
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        throw new Error('Manage Roles permission required to create/assign roles');
    }
    if (!label) throw new Error('Missing label');
    if (!Array.isArray(rolesOrNames) || rolesOrNames.length === 0) {
        throw new Error('Specify at least one role');
    }

    const roles = [];
    for (const token of rolesOrNames) {
        let role = null;
        // Try ID
        if (/^\d{5,}$/.test(token)) {
            role = guild.roles.cache.get(token) || null;
        }
        // Try name
        if (!role) {
            role = guild.roles.cache.find(r => r.name === token) || null;
        }
        // Create if missing
        if (!role) {
            try {
                role = await guild.roles.create({ name: token, permissions: 0, reason: 'Floof role menu setup' });
            } catch {
                continue;
            }
        }
        if (role) roles.push(role);
    }

    if (roles.length === 0) throw new Error('No valid roles were provided or created');

    const menu = new StringSelectMenuBuilder()
        .setCustomId('floof_role_menu_' + Date.now())
        .setPlaceholder('Choose your ' + label + '!')
        .setMinValues(0)
        .setMaxValues(Math.min(roles.length, 25))
        .addOptions(roles.slice(0, 25).map(role => new StringSelectMenuOptionBuilder()
            .setLabel(role.name)
            .setValue(role.id)
            .setEmoji('🐾')
        ));

    const row = new ActionRowBuilder().addComponents(menu);
    const embed = new EmbedBuilder()
        .setTitle('🐾 Pick your ' + label + '!')
        .setDescription('Select one or more ' + label + ' below!')
        .setColor(0xffb6c1);

    await channel.send({ embeds: [embed], components: [row] });
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

module.exports = { postRoleMenu, handleRoleMenuInteraction };
