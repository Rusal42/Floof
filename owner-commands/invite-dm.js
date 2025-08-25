const { PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'invitedm',
  aliases: ['dm-invite', 'dmserver'],
  description: 'Owner-only: DM non-mod members in this server with an invite/link. Use responsibly.',
  usage: '%invitedm <preview|run> [inviteLink] [limit] --source <id>  (Target server is fixed/hardcoded; cannot target current server as source)',
  category: 'owner',
  ownerOnly: true,

  async execute(message, args) {
    // Must run in a guild
    if (!message.guild) {
      return message.reply('❌ Run this in a server.');
    }

    const sub = (args[0] || '').toLowerCase();
    if (!['preview', 'run'].includes(sub)) {
      return message.reply(
        'Usage: %invitedm <preview|run> [sourceGuildId] [inviteLink] [limit]  OR  --source <id>  (Target is hardcoded; cannot source current server)\n' +
        'Examples:\n' +
        '• %invitedm preview 222222222222222222\n' +
        '• %invitedm preview --source 222...\n' +
        '• %invitedm run 222222222222222222\n' +
        '• %invitedm run --source 222...\n' +
        '• %invitedm run 100                      (optional cap)\n' +
        '• %invitedm run https://discord.gg/yourcode'
      );
    }

    // Parse flags (--source only; target is hardcoded below)
    const rawArgs = args.slice(1);
    let sourceGuild = message.guild;
    let targetGuild = message.guild;
    let flagSourceId = null;
    for (let i = 0; i < rawArgs.length; i++) {
      const token = rawArgs[i];
      if (token === '--source' && rawArgs[i + 1]) {
        flagSourceId = rawArgs[i + 1];
        i++;
        continue;
      }
    }
    // Build cleaned args without flags
    let cleaned = args.filter((t) => !['--source', flagSourceId].includes(t));

    // If --source not provided, allow first positional after subcommand to be a source guild ID
    const looksLikeGuildId = (s) => typeof s === 'string' && /^\d{17,20}$/.test(s);
    if (!flagSourceId && looksLikeGuildId(cleaned[1])) {
      flagSourceId = cleaned[1];
      // remove that token from cleaned
      cleaned = cleaned.filter((t, i) => !(i === 1));
    }

    // Require a source at this point and disallow using current server as source
    if (!flagSourceId) {
      return message.reply('❌ You must specify a source guild: pass it as the first argument after the subcommand, or use --source <guildId>.');
    }

    // Resolve guilds
    const fetchGuild = async (id) => {
      try { return await message.client.guilds.fetch(id); } catch { return null; }
    };
    if (flagSourceId) {
      if (flagSourceId === message.guild.id) {
        return message.reply('❌ The source guild cannot be the server where you run this command. Use another guildId with --source.');
      }
      const g = await fetchGuild(flagSourceId);
      if (!g) return message.reply('❌ Source guild not found or bot not in it.');
      sourceGuild = g;
    }
    // Hardcoded target guild override
    const HARDCODED_TARGET_GUILD_ID = '1393659651832152185';
    const hardTarget = await fetchGuild(HARDCODED_TARGET_GUILD_ID);
    if (!hardTarget) {
      return message.reply('❌ Hardcoded target guild is not available. Ensure the bot is in guild 1393659651832152185.');
    }
    targetGuild = hardTarget;

    // Invite/link resolution from cleaned args (target guild)
    let inviteLink = cleaned[1] || process.env.BOT_INVITE_LINK || '';
    if (sub === 'run' && !inviteLink) {
      // Prefer vanity URL if available
      if (targetGuild.vanityURLCode) {
        inviteLink = `https://discord.gg/${targetGuild.vanityURLCode}`;
      } else {
        // Try to create a fresh invite for a channel in the TARGET guild
        const findInvitableChannel = () => {
          const me = targetGuild.members.me;
          const canCreate = (ch) => ch && ch.isTextBased() && ch.viewable && ch.permissionsFor(me)?.has(PermissionsBitField.Flags.CreateInstantInvite);

          // 0) Optional hardcoded channel override (env)
          const HARDCODED_TARGET_CHANNEL_ID = process.env.HARDCODED_TARGET_CHANNEL_ID || null;
          if (HARDCODED_TARGET_CHANNEL_ID) {
            const hard = targetGuild.channels.cache.get(HARDCODED_TARGET_CHANNEL_ID);
            if (canCreate(hard)) return hard;
          }

          // 1) Prefer Community server Rules/Resources area (rulesChannelId)
          const rulesId = targetGuild.rulesChannelId;
          if (rulesId) {
            const rules = targetGuild.channels.cache.get(rulesId);
            if (canCreate(rules)) return rules;
          }

          // 2) Channels named 'resources' or 'rules'
          const named = targetGuild.channels.cache.find(ch => canCreate(ch) && typeof ch.name === 'string' && (/^resources?$/i.test(ch.name) || /^rules$/i.test(ch.name)));
          if (named) return named;

          // 3) System channel
          const sysId = targetGuild.systemChannelId;
          if (sysId) {
            const sys = targetGuild.channels.cache.get(sysId);
            if (canCreate(sys)) return sys;
          }

          // 4) Any text channel with Create Invite
          return targetGuild.channels.cache.find(ch => canCreate(ch));
        };
        const channel = findInvitableChannel();
        if (!channel) {
          return message.reply('❌ I cannot create an invite in the target guild. Grant me Create Invite in a text channel.');
        }
        try {
          const invite = await targetGuild.invites.create(channel.id, {
            maxAge: 0, // never expire
            maxUses: 0, // unlimited
            unique: true,
            reason: `Floof invitedm initiated by ${message.author.tag}`
          });
          inviteLink = `https://discord.gg/${invite.code}`;
        } catch (err) {
          console.error('Failed to create invite:', err);
          return message.reply('❌ I could not generate an invite for the target guild. Provide a link or grant me Create Invite.');
        }
      }
    }

    // Optional limit (owner can cap a batch); default means "all remaining"
    const limitArg = cleaned[2];
    const limit = Number.isInteger(Number(limitArg)) ? Math.max(1, Math.min(100000, Number(limitArg))) : null;

    // Persistent DM-tracker so each user is only DM'd once per guild
    const TRACK_PATH = path.join(__dirname, '..', 'dm-tracker.json');
    const loadTracker = () => {
      try {
        if (!fs.existsSync(TRACK_PATH)) return {};
        const raw = fs.readFileSync(TRACK_PATH, 'utf8');
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        console.error('Failed to read dm-tracker.json:', e);
        return {};
      }
    };
    const saveTracker = (data) => {
      try {
        fs.writeFileSync(TRACK_PATH, JSON.stringify(data, null, 2), 'utf8');
      } catch (e) {
        console.error('Failed to write dm-tracker.json:', e);
      }
    };
    const tracker = loadTracker();
    const targetId = targetGuild.id;
    if (!tracker[targetId]) tracker[targetId] = {};

    // Permissions considered as moderation/staff
    const excludedPerms = [
      PermissionsBitField.Flags.Administrator,
      PermissionsBitField.Flags.ManageGuild,
      PermissionsBitField.Flags.KickMembers,
      PermissionsBitField.Flags.BanMembers,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageRoles,
      PermissionsBitField.Flags.ModerateMembers,
    ];

    // Fetch all members (may take time on large servers)
    await message.channel.send(`⏳ Fetching members from source: ${sourceGuild.name}...`);
    let members;
    try {
      members = await sourceGuild.members.fetch();
    } catch (e) {
      console.error('Failed to fetch members:', e);
      return message.reply('❌ Could not fetch members. I need Members intent enabled.');
    }

    // Build target guild membership set to avoid DMing people already in target
    let targetMembers;
    try {
      targetMembers = await targetGuild.members.fetch();
    } catch (e) {
      console.error('Failed to fetch target guild members:', e);
      return message.reply('❌ Could not fetch target guild members (need Members intent there too).');
    }
    const inTarget = new Set(targetMembers.map(m => m.id));

    // Filter targets (eligible, and not previously DM'd in this guild)
    const targets = members.filter(m => {
      if (!m || !m.user) return false;
      if (m.user.bot) return false;
      const perms = m.permissions;
      if (!perms) return true; // DM-able regular user
      // Exclude anyone with any of the staff perms
      if (excludedPerms.some(flag => perms.has(flag))) return false;
      // Skip if already in TARGET guild
      if (inTarget.has(m.id)) return false;
      // Skip if already DM'd before in this guild
      return !tracker[targetId][m.id];
    });

    if (!targets.size) {
      return message.reply('No eligible members found (after excluding bots and staff).');
    }

    if (sub === 'preview') {
      return message.reply(`🔎 Preview: ${targets.size} member(s) in ${sourceGuild.name} will be invited to ${targetGuild.name} (excluding staff and existing members).`);
    }

    // RUN mode
    const allTargets = Array.from(targets.values());
    const toSend = limit ? allTargets.slice(0, limit) : allTargets;
    if (!toSend.length) {
      return message.reply('Nothing to do. Everyone eligible has already been DM\'d.');
    }
    await message.reply(`📨 Starting DM batch: ${toSend.length} member(s) from ${sourceGuild.name} → ${targetGuild.name}. Pacing 3–6s.`);

    let ok = 0, fail = 0;
    for (let i = 0; i < toSend.length; i++) {
      const member = toSend[i];
      // Compose message
      const content = `Hey! We\'d love to see you in ${targetGuild.name}. Join here: ${inviteLink}`;
      try {
        const dm = await member.createDM();
        await dm.send({ content });
        ok++;
        tracker[targetId][member.id] = { at: Date.now(), source: sourceGuild.id };
      } catch (err) {
        fail++;
      }

      // Progress update every 10 DMs
      if ((i + 1) % 10 === 0 || i === toSend.length - 1) {
        message.channel.send(`Progress: ${i + 1}/${toSend.length} • ✅ ${ok} • ❌ ${fail}`).catch(() => {});
        // Periodic save
        saveTracker(tracker);
      }

      // Random delay 3–6s between DMs to be gentle on rate limits
      const delay = 3000 + Math.floor(Math.random() * 3000);
      await new Promise(res => setTimeout(res, delay));
    }

    // Final save
    saveTracker(tracker);
    return message.reply(`Done. ✅ Sent: ${ok} • ❌ Failed: ${fail}`);
  }
};
