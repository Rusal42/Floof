const { GatewayIntentBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { isOwner } = require('../utils/owner-util');

// Owner-only command to enable/disable global reaction mirroring
// Mirrors reactions across any server when the reactor has the booster role in your build server

module.exports = {
    name: 'self-react',
    description: 'Mirror reactions from users who have the booster role in your build server',
    usage: '%self-react <enable|disable|status|setrole|setguild> [id]',
    category: 'owner',
    aliases: ['selfreact', 'mirrorreact'],
    cooldown: 2,
    ownerOnly: true,

    async execute(message, args) {
        const sub = (args[0] || '').toLowerCase();
        const client = message.client;

        // Initialize config with your defaults
        client.selfReactConfig = client.selfReactConfig || {
            enabled: false,
            buildGuildId: '1393659651832152185', // your building server
            boosterRoleId: '1410054474285715476', // your booster role
        };

        if (!sub) {
            return this.showStatus(message);
        }

        if (sub === 'status') {
            return this.showStatus(message);
        }

        if (sub === 'setrole') {
            const roleId = (args[1] || '').replace(/[^0-9]/g, '');
            if (!roleId) return sendAsFloofWebhook(message, { content: 'Usage: %self-react setrole <role_id>' });
            client.selfReactConfig.boosterRoleId = roleId;
            return sendAsFloofWebhook(message, { content: `✅ Booster role set to \`${roleId}\`` });
        }

        if (sub === 'setguild') {
            const guildId = (args[1] || '').replace(/[^0-9]/g, '');
            if (!guildId) return sendAsFloofWebhook(message, { content: 'Usage: %self-react setguild <build_guild_id>' });
            client.selfReactConfig.buildGuildId = guildId;
            return sendAsFloofWebhook(message, { content: `✅ Build server set to \`${guildId}\`` });
        }

        if (sub === 'enable') {
            const cfg = client.selfReactConfig;
            if (!cfg.buildGuildId || !cfg.boosterRoleId) {
                return sendAsFloofWebhook(message, { content: '❌ Please set both build guild and booster role first: `%self-react setguild <id>` and `%self-react setrole <id>`' });
            }
            if (cfg.enabled) {
                return sendAsFloofWebhook(message, { content: 'ℹ️ Self-react mirroring is already enabled.' });
            }
            cfg.enabled = true;
            ensureListenerBound(client);
            return sendAsFloofWebhook(message, { content: '✅ Self-react mirroring ENABLED. Floof will now mirror reactions from boosters across all servers.' });
        }

        if (sub === 'disable') {
            const cfg = client.selfReactConfig;
            if (!cfg.enabled) {
                return sendAsFloofWebhook(message, { content: 'ℹ️ Self-react mirroring is already disabled.' });
            }
            cfg.enabled = false;
            removeListener(client);
            return sendAsFloofWebhook(message, { content: '✅ Self-react mirroring DISABLED.' });
        }

        return this.showStatus(message);
    },

    async showStatus(message) {
        const cfg = message.client.selfReactConfig || {};
        const buildGuild = cfg.buildGuildId ? message.client.guilds.cache.get(cfg.buildGuildId) : null;
        const lines = [
            `• **Enabled:** ${cfg.enabled ? '✅ Yes' : '❌ No'}`,
            `• **Build Server:** ${buildGuild ? `${buildGuild.name} (\`${cfg.buildGuildId}\`)` : cfg.buildGuildId || 'not set'}`,
            `• **Booster Role:** \`${cfg.boosterRoleId || 'not set'}\``,
            `• **Listener:** ${message.client._selfReactListener ? 'bound' : 'not bound'}`,
            `• **Bot Account:** ${message.client.user.bot ? '✅ Yes' : '⚠️ No (violates ToS)'}`,
        ];
        return sendAsFloofWebhook(message, { content: '**Self-React Status:**\n' + lines.join('\n') });
    }
};

// Internal helpers
function ensureListenerBound(client) {
    if (client._selfReactListener) return; // already bound

    // Cache to reduce repeated role fetches
    const boosterCache = new Map(); // userId -> timestamp
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    const listener = async (reaction, user) => {
        try {
            const cfg = client.selfReactConfig;
            if (!cfg?.enabled) return;
            if (user?.bot) return;

            if (reaction?.partial) {
                try { await reaction.fetch(); } catch { return; }
            }

            const msg = reaction.message;
            if (!msg || !msg.guild) return;

            const buildGuildId = cfg.buildGuildId;
            const boosterRoleId = cfg.boosterRoleId;
            if (!buildGuildId || !boosterRoleId) return;

            // Check cache first
            const now = Date.now();
            const cached = boosterCache.get(user.id);
            if (cached && (now - cached) < CACHE_TTL) {
                // User is cached as eligible, proceed to mirror
            } else {
                // Owner bypass: if reactor is an owner, allow without booster role
                const ownerBypass = isOwner(user.id);
                if (!ownerBypass) {
                    // Fetch member in build server and verify role
                    const buildGuild = client.guilds.cache.get(buildGuildId) || await client.guilds.fetch(buildGuildId).catch(() => null);
                    if (!buildGuild) return;
                    const member = await buildGuild.members.fetch(user.id).catch(() => null);
                    if (!member || !member.roles?.cache?.has(boosterRoleId)) return; // not eligible
                }
                boosterCache.set(user.id, now); // cache as eligible
            }

            // Avoid duplicate reactions
            const key = reaction.emoji.id || reaction.emoji.name;
            const existing = msg.reactions.resolve(key);
            if (existing) {
                try {
                    const users = await existing.users.fetch();
                    if (users.has(client.user.id)) return; // already reacted
                } catch { /* ignore fetch errors */ }
            }

            // Mirror the reaction
            try {
                await msg.react(key);
            } catch {
                // Silently ignore permission/rate-limit errors
            }
        } catch {
            // Swallow all errors to avoid crashing
        }
    };

    client.on('messageReactionAdd', listener);
    client._selfReactListener = listener;
}

function removeListener(client) {
    if (!client._selfReactListener) return;
    try {
        client.off('messageReactionAdd', client._selfReactListener);
    } catch { /* ignore */ }
    client._selfReactListener = null;
}

// Startup helper: auto-enable based on ENV or defaults and bind listener without a command
function startSelfReact(client) {
    const buildGuildId = process.env.SELFREACT_GUILD_ID || '1393659651832152185';
    const boosterRoleId = process.env.SELFREACT_ROLE_ID || '1410054474285715476';
    const autoEnable = (process.env.SELFREACT_ENABLE || '1') === '1';
    client.selfReactConfig = client.selfReactConfig || {};
    client.selfReactConfig.enabled = autoEnable;
    client.selfReactConfig.buildGuildId = client.selfReactConfig.buildGuildId || buildGuildId;
    client.selfReactConfig.boosterRoleId = client.selfReactConfig.boosterRoleId || boosterRoleId;
    if (client.selfReactConfig.enabled) ensureListenerBound(client);
}

module.exports.startSelfReact = startSelfReact;