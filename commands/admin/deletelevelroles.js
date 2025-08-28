const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

// Level tier names must match createlevelroles.js
const LEVEL_TIERS = {
  1: 'Newcomer',
  5: 'Member',
  10: 'Regular',
  15: 'Active',
  20: 'Veteran',
  25: 'Elite',
  30: 'Expert',
  35: 'Master',
  40: 'Champion',
  45: 'Hero',
  50: 'Legend',
  60: 'Mythic',
  70: 'Ascended',
  80: 'Divine',
  90: 'Transcendent',
  100: 'Immortal'
};

function getLevelName(level) {
  // Use numeric-only role names (e.g., '5') to match creation
  return String(level);
}

// Milestone set must match createlevelroles.js behavior
function getMilestoneLevels(start, end) {
  const base = [1, 3, 5, 7, 10, 15];
  for (let l = 20; l <= 100; l += 5) base.push(l);
  const set = new Set(base.filter(l => l >= start && l <= end));
  return Array.from(set).sort((a, b) => a - b);
}

module.exports = {
  name: 'dlr',
  aliases: ['deletelevelroles', 'deleteroleslevels'],
  description: 'Delete milestone level roles (created by %createlevelroles) in a range',
  usage: '%dlr [start] [end] (default 1 100)',
  category: 'admin',
  permissions: [PermissionFlagsBits.Administrator],
  cooldown: 15,

  async execute(message, args) {
    // Admin check
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await sendAsFloofWebhook(message, { content: '❌ You need the **Administrator** permission to use this command.' });
    }

    // Bot perms
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return await sendAsFloofWebhook(message, { content: '❌ I need the **Manage Roles** permission to delete roles!' });
    }

    // Parse range
    let startLevel = 1;
    let endLevel = 100;
    if (args.length >= 1) {
      const s = parseInt(args[0]);
      if (!isNaN(s) && s >= 1 && s <= 100) startLevel = s;
    }
    if (args.length >= 2) {
      const e = parseInt(args[1]);
      if (!isNaN(e) && e >= startLevel && e <= 100) endLevel = e;
    }

    const levels = getMilestoneLevels(startLevel, endLevel);

    // Precompute matches
    const candidates = levels.map(lvl => ({ lvl, name: getLevelName(lvl) }));
    const found = [];
    for (const c of candidates) {
      const role = message.guild.roles.cache.find(r => r.name === c.name);
      if (role) found.push({ ...c, role });
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('🗑️ Delete Level Roles')
      .setColor('#FF4444')
      .setDescription(`About to delete up to **${levels.length}** milestone roles in range Level ${startLevel}-${endLevel}.`)
      .addFields(
        { name: 'Will attempt to delete', value: levels.join(', ') || 'None', inline: false },
        { name: 'Found existing roles', value: found.length ? found.map(f => f.name).slice(0, 15).join('\n') + (found.length > 15 ? `\n...and ${found.length - 15} more` : '') : 'None', inline: false },
        { name: 'Warning', value: '• I can only delete roles below my highest role\n• Managed/integration roles are skipped\n• This action cannot be undone', inline: false }
      )
      .setFooter({ text: 'Click Confirm to proceed or Cancel to abort (30s timeout)' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_dlr').setLabel('Confirm').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_dlr').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const confirmMessage = await sendAsFloofWebhook(message, { embeds: [confirmEmbed], components: [row] });

    try {
      const collector = confirmMessage.channel.createMessageComponentCollector({
        filter: (i) => ['confirm_dlr', 'cancel_dlr'].includes(i.customId) && i.user.id === message.author.id && i.message.id === confirmMessage.id,
        time: 30000,
        max: 1
      });

      collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        // disable buttons
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(row.components[0]).setDisabled(true),
          ButtonBuilder.from(row.components[1]).setDisabled(true)
        );
        await interaction.editReply({ components: [disabledRow] });

        if (interaction.customId === 'cancel_dlr') {
          return await sendAsFloofWebhook(message, { content: '❌ Deletion cancelled.' });
        }

        if (interaction.customId === 'confirm_dlr') {
          return await this.deleteLevelRoles(message, startLevel, endLevel);
        }
      });

      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true),
            ButtonBuilder.from(row.components[1]).setDisabled(true)
          );
          if (!confirmMessage.webhookId) {
            try { await confirmMessage.edit({ components: [disabledRow] }); } catch (_) {}
          }
          await sendAsFloofWebhook(message, { content: '⏰ Confirmation timed out. Deletion cancelled.' });
        }
      });
    } catch (_) {
      return await sendAsFloofWebhook(message, { content: '⏰ Confirmation timed out. Deletion cancelled.' });
    }
  },

  async deleteLevelRoles(message, startLevel, endLevel) {
    const levelsToDelete = getMilestoneLevels(startLevel, endLevel);

    const progressEmbed = new EmbedBuilder()
      .setTitle('🔄 Deleting Level Roles...')
      .setDescription('Please wait while I delete the requested roles.')
      .setColor('#FF9900');

    const progressMessage = await sendAsFloofWebhook(message, { embeds: [progressEmbed] });

    let deleted = 0;
    let skipped = 0;
    const errors = [];

    const me = message.guild.members.me;
    const myTop = me.roles.highest?.position ?? 0;

    let processed = 0;
    for (const level of levelsToDelete) {
      try {
        const name = getLevelName(level);
        const role = message.guild.roles.cache.find(r => r.name === name);
        if (!role) { skipped++; continue; }

        // Safety checks
        if (role.managed || role.comparePositionTo(me.roles.highest) >= 0) {
          skipped++;
          continue;
        }

        await role.delete(`Deleted by Floof Bot via %dlr (Level ${level})`);
        deleted++;

        processed++;
        if (processed % 5 === 0) {
          await new Promise(res => setTimeout(res, 750));
          const update = new EmbedBuilder()
            .setTitle('🔄 Deleting Level Roles...')
            .setDescription(`Progress: ${processed}/${levelsToDelete.length} processed\nDeleted: ${deleted} | Skipped: ${skipped}`)
            .setColor('#FF9900');
          await progressMessage.edit({ embeds: [update] });
        }
      } catch (err) {
        errors.push(`Level ${level}: ${err.message}`);
      }
    }

    const done = new EmbedBuilder()
      .setTitle('✅ Deletion Completed')
      .setColor('#00C853')
      .addFields(
        { name: 'Summary', value: `Deleted: ${deleted}\nSkipped: ${skipped}\nRange: Level ${startLevel}-${endLevel}`, inline: false }
      );

    if (errors.length) {
      done.addFields({ name: 'Errors', value: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''), inline: false });
    }

    // Send completion message via webhook instead of editing
    await sendAsFloofWebhook(message, { embeds: [done] });
  }
};
