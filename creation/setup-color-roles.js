// creation/setup-color-roles.js
const { PermissionsBitField } = require('discord.js');

const COLOR_ROLES = [
  { name: 'Cotton Candy Pink', color: '#ffb6c1' },
  { name: 'Sky Blue', color: '#87ceeb' },
  { name: 'Lavender Dream', color: '#b57edc' },
  { name: 'Mint Green', color: '#98ff98' },
  { name: 'Sunflower Yellow', color: '#ffe066' },
  { name: 'Midnight Black', color: '#222831' },
  { name: 'Snow White', color: '#f8f8ff' }
];

async function postColorMenu(channel, options = {}) {
  const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
  if (!channel || !channel.isTextBased()) throw new Error('Invalid target channel for color menu');
  const guild = channel.guild;
  const colorRoles = COLOR_ROLES.map(r => guild.roles.cache.find(role => role.name === r.name)).filter(Boolean);
  if (colorRoles.length === 0) throw new Error('No color roles found. Run setupColorRoles first.');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('floof_color_select')
    .setPlaceholder('Choose your color!')
    .addOptions(
      colorRoles.map(role => new StringSelectMenuOptionBuilder()
        .setLabel(role.name)
        .setValue(role.id)
      )
    );
  const row = new ActionRowBuilder().addComponents(selectMenu);
  const embed = new EmbedBuilder()
    .setTitle(options.title || '🎨 Choose Your Name Color!')
    .setDescription(options.description || 'Pick a color below. You can only have one color role at a time. Changing your color will remove your old color role.')
    .setColor(0xffb6c1);

  await channel.send({ embeds: [embed], components: [row] });
}

async function handleColorMenuInteraction(interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'floof_color_select') return;
  const member = interaction.member;
  const selectedRoleId = interaction.values[0];
  const colorRoles = COLOR_ROLES
    .map(r => interaction.guild.roles.cache.find(role => role.name === r.name))
    .filter(Boolean);
  // Remove all color roles except the selected one
  for (const role of colorRoles) {
    if (member.roles.cache.has(role.id) && role.id !== selectedRoleId) {
      await member.roles.remove(role).catch(() => {});
    }
  }
  // Add selected color role
  if (!member.roles.cache.has(selectedRoleId)) {
    await member.roles.add(selectedRoleId).catch(() => {});
  }
  await interaction.reply({ content: 'Your color role has been updated! ✨', flags: 64 });
}

async function setupColorRoles(guild, memberRoleName = 'member') {
  if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    throw new Error('Manage Roles permission required to create color roles');
  }
  const memberRole = guild.roles.cache.find(r => r.name.toLowerCase() === memberRoleName.toLowerCase());
  if (!memberRole) throw new Error('Could not find the Member role.');
  let createdRoles = [];
  for (const { name, color } of COLOR_ROLES) {
    let role = guild.roles.cache.find(r => r.name === name);
    if (!role) {
      role = await guild.roles.create({ name, color, permissions: 0, reason: 'Floof color role setup' });
    }
    createdRoles.push(role);
  }
  // Sort roles above Member
  for (const role of createdRoles) {
    if (role.position <= memberRole.position) {
      await role.setPosition(memberRole.position + 1);
    }
  }
  return createdRoles;
}

// Backward-compatible commands
async function colormenu(message) {
  try {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ You need Administrator to use this command. Use `%config colormenu` instead.');
    }
    await setupColorRoles(message.guild);
    // optional channel mention as first arg
    const maybeChannel = (message.content.split(/\s+/)[1]) || '';
    const channel = /^<#\d+>$/.test(maybeChannel)
      ? message.guild.channels.cache.get(maybeChannel.replace(/[^\d]/g, ''))
      : message.channel;
    await postColorMenu(channel);
  } catch (err) {
    await message.reply(String(err.message || err));
  }
}

async function sendColorMenu(message) {
  try {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ You need Administrator to use this command. Use `%config colormenu` instead.');
    }
    const maybeChannel = (message.content.split(/\s+/)[1]) || '';
    const channel = /^<#\d+>$/.test(maybeChannel)
      ? message.guild.channels.cache.get(maybeChannel.replace(/[^\d]/g, ''))
      : message.channel;
    await postColorMenu(channel);
  } catch (err) {
    await message.reply(String(err.message || err));
  }
}

module.exports = {
  colormenu,
  handleColorMenuInteraction,
  sendColorMenu,
  setupColorRoles,
  postColorMenu
};
