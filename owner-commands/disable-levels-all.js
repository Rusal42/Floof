const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { isOwner } = require('../utils/owner-util');
const fs = require('fs');
const path = require('path');

const levelConfigPath = path.join(__dirname, '../data/level-config.json');

function loadLevelConfig() {
    if (!fs.existsSync(levelConfigPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(levelConfigPath, 'utf8'));
    } catch (error) {
        console.error('Error loading level config:', error);
        return {};
    }
}

function saveLevelConfig(config) {
    try {
        fs.mkdirSync(path.dirname(levelConfigPath), { recursive: true });
        fs.writeFileSync(levelConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving level config:', error);
    }
}

module.exports = {
    name: 'disablelevelsall',
    description: 'Disable leveling system in all servers (Owner only)',
    usage: '%disablelevelsall',
    category: 'owner',
    ownerOnly: true,

    async execute(message, args) {
        if (!isOwner(message.author.id)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ This command is restricted to the bot owner.'
            });
        }

        const config = loadLevelConfig();
        let disabledCount = 0;
        let totalServers = 0;

        // Get all servers the bot is in
        const guilds = message.client.guilds.cache;
        
        for (const [guildId, guild] of guilds) {
            totalServers++;
            
            // Initialize server config if it doesn't exist
            if (!config[guildId]) {
                config[guildId] = {
                    enabled: false,
                    xpPerMessage: 15,
                    xpCooldown: 60000,
                    levelUpChannel: null,
                    levelRoles: {},
                    multipliers: {},
                    ignoredChannels: [],
                    ignoredRoles: [],
                    autoCreateRoles: true
                };
                disabledCount++;
            } else if (config[guildId].enabled) {
                // Disable if currently enabled
                config[guildId].enabled = false;
                disabledCount++;
            }
        }

        // Save the updated config
        saveLevelConfig(config);

        const embed = new EmbedBuilder()
            .setTitle('🔧 Leveling System Disabled')
            .setDescription(`Successfully disabled leveling system across all servers.`)
            .addFields(
                { name: '📊 Total Servers', value: totalServers.toString(), inline: true },
                { name: '🔒 Disabled', value: disabledCount.toString(), inline: true },
                { name: '✅ Already Disabled', value: (totalServers - disabledCount).toString(), inline: true }
            )
            .setColor(0xFF6B6B)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
