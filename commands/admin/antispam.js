const { EmbedBuilder, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { requirePerms } = require('../../utils/permissions');
const fs = require('fs');
const path = require('path');

// Store antispam settings in memory and file
const antispamPath = path.join(__dirname, '../../data/antispam.json');
let antispamSettings = {};

// Load existing settings
if (fs.existsSync(antispamPath)) {
    try {
        antispamSettings = JSON.parse(fs.readFileSync(antispamPath, 'utf8'));
    } catch (error) {
        console.error('Error loading antispam settings:', error);
        antispamSettings = {};
    }
}

// Save settings to file
function saveSettings() {
    try {
        const dir = path.dirname(antispamPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(antispamPath, JSON.stringify(antispamSettings, null, 2));
    } catch (error) {
        console.error('Error saving antispam settings:', error);
    }
}

module.exports = {
    name: 'antispam',
    aliases: ['spam'],
    description: 'Configure anti-spam protection for the server',
    usage: '%antispam [on/off/status/config]',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageMessages],
    cooldown: 3,

    async execute(message, args) {
        const ok = await requirePerms(message, PermissionsBitField.Flags.ManageMessages, 'configure anti-spam');
        if (!ok) return;

        const guildId = message.guild.id;
        
        // Initialize guild settings if they don't exist
        if (!antispamSettings[guildId]) {
            antispamSettings[guildId] = {
                enabled: false,
                maxMessages: 5,
                timeWindow: 10000, // 10 seconds
                muteTime: 300000, // 5 minutes
                deleteMessages: true
            };
        }

        const settings = antispamSettings[guildId];

        if (!args.length || args[0].toLowerCase() === 'status') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Anti-Spam Settings')
                .setDescription(`Anti-spam protection is currently **${settings.enabled ? 'ENABLED' : 'DISABLED'}**`)
                .addFields(
                    { name: '📊 Current Settings', value: `**Max Messages:** ${settings.maxMessages}\n**Time Window:** ${settings.timeWindow / 1000} seconds\n**Mute Duration:** ${settings.muteTime / 60000} minutes\n**Delete Spam:** ${settings.deleteMessages ? 'Yes' : 'No'}`, inline: false },
                    { name: '⚙️ Commands', value: '`%antispam on` - Enable anti-spam\n`%antispam off` - Disable anti-spam\n`%antispam config` - Configure settings', inline: false }
                )
                .setColor(settings.enabled ? 0x00FF00 : 0xFF0000)
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const action = args[0].toLowerCase();

        switch (action) {
            case 'on':
            case 'enable':
                settings.enabled = true;
                saveSettings();
                
                const enableEmbed = new EmbedBuilder()
                    .setDescription('✅ Anti-spam protection has been **enabled**!')
                    .setColor(0x00FF00)
                    .addFields({
                        name: '📋 Current Settings',
                        value: `Users will be muted for ${settings.muteTime / 60000} minutes if they send more than ${settings.maxMessages} messages in ${settings.timeWindow / 1000} seconds.`,
                        inline: false
                    })
                    .setFooter({ text: `Enabled by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                return sendAsFloofWebhook(message, { embeds: [enableEmbed] });

            case 'off':
            case 'disable':
                settings.enabled = false;
                saveSettings();
                
                const disableEmbed = new EmbedBuilder()
                    .setDescription('❌ Anti-spam protection has been **disabled**.')
                    .setColor(0xFF0000)
                    .setFooter({ text: `Disabled by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                return sendAsFloofWebhook(message, { embeds: [disableEmbed] });

            case 'config':
            case 'configure':
                const configEmbed = new EmbedBuilder()
                    .setTitle('⚙️ Anti-Spam Configuration')
                    .setDescription('Current anti-spam settings for this server:')
                    .addFields(
                        { name: '📊 Settings', value: `**Status:** ${settings.enabled ? 'Enabled' : 'Disabled'}\n**Max Messages:** ${settings.maxMessages}\n**Time Window:** ${settings.timeWindow / 1000} seconds\n**Mute Duration:** ${settings.muteTime / 60000} minutes\n**Delete Spam:** ${settings.deleteMessages ? 'Yes' : 'No'}`, inline: false },
                        { name: '💡 How it works', value: `If a user sends more than **${settings.maxMessages} messages** within **${settings.timeWindow / 1000} seconds**, they will be automatically muted for **${settings.muteTime / 60000} minutes**.`, inline: false },
                        { name: '🔧 Commands', value: '`%antispam on/off` - Toggle protection\n`%antispam status` - View current settings\n\n*Advanced configuration coming soon!*', inline: false }
                    )
                    .setColor(0x3498DB)
                    .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                return sendAsFloofWebhook(message, { embeds: [configEmbed] });

            default:
                const helpEmbed = new EmbedBuilder()
                    .setDescription('❌ Invalid option. Use `%antispam on`, `%antispam off`, `%antispam status`, or `%antispam config`.')
                    .setColor(0xFF0000);

                return sendAsFloofWebhook(message, { embeds: [helpEmbed] });
        }
    },

    // Export settings for use in message handler
    getSettings: (guildId) => antispamSettings[guildId] || null,
    
    // Function to handle spam detection (to be called from message handler)
    handleSpam: async (message) => {
        const guildId = message.guild?.id;
        if (!guildId || !antispamSettings[guildId]?.enabled) return false;

        const settings = antispamSettings[guildId];
        const userId = message.author.id;
        const now = Date.now();

        // Initialize user tracking
        if (!message.client.spamTracker) {
            message.client.spamTracker = new Map();
        }

        const userKey = `${guildId}-${userId}`;
        const userMessages = message.client.spamTracker.get(userKey) || [];

        // Clean old messages outside time window
        const recentMessages = userMessages.filter(timestamp => now - timestamp < settings.timeWindow);
        recentMessages.push(now);

        message.client.spamTracker.set(userKey, recentMessages);

        // Check if user exceeded limit
        if (recentMessages.length > settings.maxMessages) {
            try {
                // Delete spam messages if enabled
                if (settings.deleteMessages) {
                    await message.delete().catch(() => {});
                }

                // Timeout the user
                await message.member.timeout(settings.muteTime, 'Anti-spam: Exceeded message limit');

                // Clear user's spam tracker
                message.client.spamTracker.delete(userKey);

                // Log the action
                const logEmbed = new EmbedBuilder()
                    .setTitle('🛡️ Anti-Spam Action')
                    .setDescription(`**${message.author.tag}** has been muted for spam.`)
                    .addFields(
                        { name: '📊 Details', value: `**Messages:** ${recentMessages.length}/${settings.maxMessages}\n**Time Window:** ${settings.timeWindow / 1000}s\n**Mute Duration:** ${settings.muteTime / 60000}m`, inline: true },
                        { name: '👤 User', value: `${message.author} (${message.author.id})`, inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                // Try to send to mod log or channel
                await sendAsFloofWebhook(message, { embeds: [logEmbed] });

                return true;
            } catch (error) {
                console.error('Error handling spam:', error);
                return false;
            }
        }

        return false;
    }
};
