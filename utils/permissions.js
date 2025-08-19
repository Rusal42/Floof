const { PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('./webhook-util');

/**
 * Checks member permissions and replies with a standardized error if missing.
 * @param {import('discord.js').Message} message
 * @param {bigint[]|bigint} perms - Single permission or array of PermissionFlagsBits
 * @param {string} actionDesc - Short description of the action, e.g. "manage voice channel settings"
 * @returns {Promise<boolean>} true if permitted, false if handled error
 */
async function requirePerms(message, perms, actionDesc = 'perform this action') {
  const needed = Array.isArray(perms) ? perms : [perms];
  const member = message.member;
  if (!member) return false;

  const missing = needed.filter((p) => !member.permissions.has(p));
  if (missing.length === 0) return true;

  const permNames = missing.map((p) => permName(p)).join(', ');
  await sendAsFloofWebhook(message, {
    content: `❌ You need **${permNames}** permission${missing.length > 1 ? 's' : ''} to ${actionDesc}!`
  });
  return false;
}

/**
 * Checks the bot's own permissions in a channel and replies if missing.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').GuildChannel|import('discord.js').ThreadChannel} channel
 * @param {bigint[]|bigint} perms
 * @param {string} actionDesc
 * @returns {Promise<boolean>}
 */
async function requireBotPermsInChannel(message, channel, perms, actionDesc = 'perform this action') {
  const needed = Array.isArray(perms) ? perms : [perms];
  const me = message.guild?.members?.me;
  if (!me) return false;
  const permissions = channel?.permissionsFor?.(me);
  if (!permissions) return false;
  const missing = needed.filter((p) => !permissions.has(p));
  if (missing.length === 0) return true;

  const permNames = missing.map((p) => permName(p)).join(', ');
  await sendAsFloofWebhook(message, {
    content: `❌ I need **${permNames}** permission${missing.length > 1 ? 's' : ''} in ${channel} to ${actionDesc}!`
  });
  return false;
}

function permName(bit) {
  // Map a few common ones nicely; fall back to bit value
  switch (bit) {
    case PermissionFlagsBits.Administrator: return 'Administrator';
    case PermissionFlagsBits.ManageGuild: return 'Manage Server';
    case PermissionFlagsBits.ManageChannels: return 'Manage Channels';
    case PermissionFlagsBits.ManageRoles: return 'Manage Roles';
    case PermissionFlagsBits.ManageMessages: return 'Manage Messages';
    case PermissionFlagsBits.BanMembers: return 'Ban Members';
    case PermissionFlagsBits.KickMembers: return 'Kick Members';
    case PermissionFlagsBits.ModerateMembers: return 'Timeout Members';
    case PermissionFlagsBits.ViewAuditLog: return 'View Audit Log';
    case PermissionFlagsBits.SendMessages: return 'Send Messages';
    case PermissionFlagsBits.Connect: return 'Connect';
    case PermissionFlagsBits.MoveMembers: return 'Move Members';
    case PermissionFlagsBits.ViewChannel: return 'View Channel';
    default:
      return String(bit);
  }
}

module.exports = { requirePerms, requireBotPermsInChannel };
