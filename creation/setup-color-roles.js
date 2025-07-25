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

async function sendColorMenu(message) {
  const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
  const memberRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'member');
  if (!memberRole) return message.reply('Could not find the Member role.');
  const colorRoles = COLOR_ROLES.map(r => message.guild.roles.cache.find(role => role.name === r.name)).filter(Boolean);
  if (colorRoles.length === 0) return message.reply('No color roles found. Please run %setupcolorroles first!');

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
    .setTitle('🎨 Choose Your Name Color!')
    .setDescription('Pick a color below. You can only have one color role at a time. Changing your color will remove your old color role.')
    .setColor(0xffb6c1);

  // Send to your role channel
  const roleChannel = message.guild.channels.cache.get('1393670713042534480');
  if (roleChannel && roleChannel.isTextBased()) {
    await roleChannel.send({ embeds: [embed], components: [row] });
  } else {
    await message.reply('Could not find the role channel to send the color menu!');
  }
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

async function colormenu(message) {
  const OWNER_ID = '1007799027716329484';
  const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
  if (message.author.id !== OWNER_ID) return message.reply('Only the owner can use this command!');
  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.reply('I need the Manage Roles permission to create color roles!');
  }
  const memberRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'member');
  if (!memberRole) return message.reply('Could not find the Member role.');
  let createdRoles = [];
  for (const { name, color } of COLOR_ROLES) {
    let role = message.guild.roles.cache.find(r => r.name === name);
    if (!role) {
      role = await message.guild.roles.create({ name, color, permissions: 0, reason: 'Floof color role setup' });
    }
    createdRoles.push(role);
  }
  // Sort roles above Member
  for (const role of createdRoles) {
    if (role.position <= memberRole.position) {
      await role.setPosition(memberRole.position + 1);
    }
  }
  // Now send the color menu
  const colorRoles = COLOR_ROLES.map(r => message.guild.roles.cache.find(role => role.name === r.name)).filter(Boolean);
  if (colorRoles.length === 0) return message.reply('No color roles found.');
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
    .setTitle('🎨 Choose Your Name Color!')
    .setDescription('Pick a color below. You can only have one color role at a time. Changing your color will remove your old color role.')
    .setColor(0xffb6c1);
  const roleChannel = message.guild.channels.cache.get('1393670713042534480');
  if (roleChannel && roleChannel.isTextBased()) {
    await roleChannel.send({ embeds: [embed], components: [row] });
  } else {
    await message.reply('Could not find the role channel to send the color menu!');
  }
}

module.exports = {
  colormenu,
  handleColorMenuInteraction,
  sendColorMenu
};
