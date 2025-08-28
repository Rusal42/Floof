const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
  name: 'rolemenu',
  description: 'Create and manage selectable role menus',
  category: 'general',
  permissions: [PermissionsBitField.Flags.ManageRoles],
  aliases: [],

  /**
   * Usage:
   * %rolemenu create <label> [#channel] <role1> <role2> ...
   * - label: short label shown in the select placeholder/title (e.g. pronouns)
   * - #channel: optional; where to send the menu (defaults to current channel)
   * - roleN: role mention, role ID, or exact role name (single word); roles will be created if missing
   */
  async execute(message, args) {
    if (!message.guild) return;

    const sub = (args.shift() || '').toLowerCase();

    if (sub !== 'create') {
      return message.reply('Usage: %rolemenu create <label> [#channel] <role1> <role2> ...');
    }

    // Permission checks
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply('❌ You need Manage Roles to use this command.');
    }
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply('❌ I need Manage Roles to create and assign roles.');
    }

    // Label
    const label = args.shift();
    if (!label) {
      return message.reply('❌ Please provide a label.\nExample: %rolemenu create pronouns he/him she/her they/them');
    }

    // Optional channel
    let targetChannel = message.channel;
    if (args[0] && args[0].match(/^<#\d+>$/)) {
      const chanId = args.shift().replace(/<#(\d+)>/, '$1');
      const ch = message.guild.channels.cache.get(chanId);
      if (!ch || ch.type !== ChannelType.GuildText) {
        return message.reply('❌ Please mention a valid text channel.');
      }
      targetChannel = ch;
    }

    // Roles
    if (!args.length) {
      return message.reply('❌ Please specify at least one role. You can mention roles, use IDs, or exact names.');
    }

    const roles = [];
    for (const token of args) {
      let role = null;
      // <@&id>
      const mentionMatch = token.match(/^<@&(\d+)>$/);
      if (mentionMatch) {
        role = message.guild.roles.cache.get(mentionMatch[1]) || null;
      }
      // ID
      if (!role && /^\d{5,}$/.test(token)) {
        role = message.guild.roles.cache.get(token) || null;
      }
      // Name (single-token)
      if (!role) {
        role = message.guild.roles.cache.find(r => r.name === token) || null;
      }

      // Create if missing
      if (!role) {
        try {
          role = await message.guild.roles.create({
            name: token,
            permissions: 0,
            reason: 'Floof role menu setup'
          });
        } catch (e) {
          // Skip on failure to create
          continue;
        }
      }

      if (role) roles.push(role);
    }

    if (roles.length === 0) {
      return message.reply('❌ No valid roles were provided or created.');
    }

    // Build select menu
    const customId = 'floof_role_menu_' + Date.now();
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(`Choose your ${label}!`)
      .setMinValues(0)
      .setMaxValues(Math.min(roles.length, 25))
      .addOptions(
        roles.slice(0, 25).map(role => new StringSelectMenuOptionBuilder()
          .setLabel(role.name.substring(0, 100))
          .setValue(role.id)
          .setEmoji('🐾')
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);
    const embed = new EmbedBuilder()
      .setTitle(`🐾 Pick your ${label}!`)
      .setDescription(`Select one or more ${label} below!`)
      .setColor(0xffb6c1);

    try {
      await targetChannel.send({ embeds: [embed], components: [row] });
      return message.reply(`✅ Role menu created in ${targetChannel.toString()}`);
    } catch (e) {
      return message.reply('❌ Failed to send role menu. Do I have permission to send messages and use components there?');
    }
  }
};
