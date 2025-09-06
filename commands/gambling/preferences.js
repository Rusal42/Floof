const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

// Path to preferences data
const preferencesPath = path.join(__dirname, '../../data/user-preferences.json');

// Load preferences data
function loadPreferences() {
    try {
        if (fs.existsSync(preferencesPath)) {
            return JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
    return {};
}

// Save preferences data
function savePreferences(data) {
    try {
        fs.writeFileSync(preferencesPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

module.exports = {
    name: 'preferences',
    description: 'Manage your gambling and bot preferences',
    usage: '%preferences [setting] [value]',
    category: 'gambling',
    aliases: ['prefs', 'settings'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        const preferences = loadPreferences();
        
        if (!preferences[userId]) {
            preferences[userId] = {
                notifications: true,
                autoPlay: false,
                riskLevel: 'medium',
                displayMode: 'detailed'
            };
        }

        const userPrefs = preferences[userId];

        // If no arguments, show current preferences
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('🎛️ Your Preferences')
                .setDescription('Here are your current gambling preferences:')
                .addFields(
                    { name: '🔔 Notifications', value: userPrefs.notifications ? 'Enabled' : 'Disabled', inline: true },
                    { name: '🎮 Auto Play', value: userPrefs.autoPlay ? 'Enabled' : 'Disabled', inline: true },
                    { name: '⚠️ Risk Level', value: userPrefs.riskLevel, inline: true },
                    { name: '📊 Display Mode', value: userPrefs.displayMode, inline: true }
                )
                .setFooter({ text: 'Use %preferences <setting> <value> to change settings' })
                .setColor(0x00ff00);

            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Handle setting changes
        const setting = args[0].toLowerCase();
        const value = args[1]?.toLowerCase();

        if (!value) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a value for the setting!\n💡 **Example:** `%preferences notifications on`'
            });
        }

        switch (setting) {
            case 'notifications':
            case 'notifs':
                if (['on', 'true', 'yes', 'enable'].includes(value)) {
                    userPrefs.notifications = true;
                } else if (['off', 'false', 'no', 'disable'].includes(value)) {
                    userPrefs.notifications = false;
                } else {
                    return await sendAsFloofWebhook(message, {
                        content: '❌ Invalid value! Use `on` or `off` for notifications.'
                    });
                }
                break;

            case 'autoplay':
            case 'auto':
                if (['on', 'true', 'yes', 'enable'].includes(value)) {
                    userPrefs.autoPlay = true;
                } else if (['off', 'false', 'no', 'disable'].includes(value)) {
                    userPrefs.autoPlay = false;
                } else {
                    return await sendAsFloofWebhook(message, {
                        content: '❌ Invalid value! Use `on` or `off` for auto play.'
                    });
                }
                break;

            case 'risk':
            case 'risklevel':
                if (['low', 'medium', 'high'].includes(value)) {
                    userPrefs.riskLevel = value;
                } else {
                    return await sendAsFloofWebhook(message, {
                        content: '❌ Invalid risk level! Use `low`, `medium`, or `high`.'
                    });
                }
                break;

            case 'display':
            case 'displaymode':
                if (['simple', 'detailed'].includes(value)) {
                    userPrefs.displayMode = value;
                } else {
                    return await sendAsFloofWebhook(message, {
                        content: '❌ Invalid display mode! Use `simple` or `detailed`.'
                    });
                }
                break;

            default:
                return await sendAsFloofWebhook(message, {
                    content: '❌ Unknown setting! Available settings: `notifications`, `autoplay`, `risk`, `display`'
                });
        }

        // Save preferences
        preferences[userId] = userPrefs;
        savePreferences(preferences);

        const embed = new EmbedBuilder()
            .setTitle('✅ Preferences Updated')
            .setDescription(`Successfully updated **${setting}** to **${value}**`)
            .setColor(0x00ff00);

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};