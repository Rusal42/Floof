const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { 
    getUserPreferences,
    updatePreference,
    formatPreferencesDisplay,
    getSettingHelp,
    resetPreferences,
    getPreferenceCategories
} = require('./utils/user-preferences');

module.exports = {
    name: 'preferences',
    description: 'Manage your crime and privacy settings',
    usage: '%preferences [view/toggle/enable/disable/reset/help] [setting] | %p [action] [setting]',
    category: 'gambling',
    aliases: ['prefs', 'settings', 'config', 'pref', 'p'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        if (args.length === 0) {
            // Show all preferences
            const display = formatPreferencesDisplay(userId);
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🔧 Your Preferences')
                        .setDescription(display)
                        .setColor(0x3498db)
                        .setTimestamp()
                ]
            });
        }
        
        const action = args[0].toLowerCase();
        
        if (action === 'reset') {
            const result = resetPreferences(userId);
            
            if (result.success) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🔄 Preferences Reset')
                            .setDescription('✅ All preferences have been reset to default settings!\n\nUse `%preferences` to view your current settings.')
                            .setColor(0x2ecc71)
                            .setTimestamp()
                    ]
                });
            } else {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ Failed to reset preferences. Please try again.')
                            .setColor(0xff0000)
                    ]
                });
            }
        }
        
        if (action === 'list') {
            // Show available settings
            const categories = getPreferenceCategories();
            let display = '**Available Settings:**\n\n';
            
            Object.entries(categories).forEach(([categoryName, settings]) => {
                display += `**${categoryName}:**\n`;
                settings.forEach(setting => {
                    display += `• \`${setting.key}\` - ${setting.name}\n`;
                });
                display += '\n';
            });
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('📋 Available Settings')
                        .setDescription(display)
                        .setColor(0x3498db)
                        .setTimestamp()
                ]
            });
        }
        
        if (args.length < 2) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please specify a setting!\n\n**Usage:**\n• `%preferences toggle <setting>`\n• `%preferences enable <setting>`\n• `%preferences disable <setting>`\n• `%preferences help <setting>`\n• `%preferences list` - Show all settings')
                        .setColor(0xff0000)
                ]
            });
        }
        
        const settingKey = args[1].toLowerCase();
        
        if (action === 'help') {
            const helpInfo = getSettingHelp(settingKey);
            
            if (!helpInfo) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`❌ Setting \`${settingKey}\` not found!\n\nUse \`%preferences list\` to see all available settings.`)
                            .setColor(0xff0000)
                    ]
                });
            }
            
            const preferences = getUserPreferences(userId);
            const currentStatus = preferences[settingKey] ? '✅ Enabled' : '❌ Disabled';
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`ℹ️ ${helpInfo.name}`)
                        .setDescription(`**Category:** ${helpInfo.category}\n**Description:** ${helpInfo.description}\n**Current Status:** ${currentStatus}\n\n**Usage:**\n• \`%preferences toggle ${settingKey}\`\n• \`%preferences enable ${settingKey}\`\n• \`%preferences disable ${settingKey}\``)
                        .setColor(0x3498db)
                        .setTimestamp()
                ]
            });
        }
        
        let newValue;
        if (action === 'toggle') {
            const currentPrefs = getUserPreferences(userId);
            newValue = !currentPrefs[settingKey];
        } else if (action === 'enable') {
            newValue = true;
        } else if (action === 'disable') {
            newValue = false;
        } else {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Invalid action! Use `toggle`, `enable`, `disable`, `help`, `list`, or `reset`.')
                        .setColor(0xff0000)
                ]
            });
        }
        
        const result = updatePreference(userId, settingKey, newValue);
        
        if (!result.success) {
            if (result.reason === 'invalid_preference') {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`❌ Setting \`${settingKey}\` not found!\n\nUse \`%preferences list\` to see all available settings.`)
                            .setColor(0xff0000)
                    ]
                });
            } else {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ Failed to update preference. Please try again.')
                            .setColor(0xff0000)
                    ]
                });
            }
        }
        
        const helpInfo = getSettingHelp(settingKey);
        const statusText = newValue ? '✅ Enabled' : '❌ Disabled';
        const actionText = action === 'toggle' ? 'Toggled' : (newValue ? 'Enabled' : 'Disabled');
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle(`🔧 Preference ${actionText}`)
                    .setDescription(`**${helpInfo ? helpInfo.name : settingKey}:** ${statusText}\n\n${helpInfo ? helpInfo.description : ''}\n\nUse \`%preferences\` to view all your settings.`)
                    .setColor(newValue ? 0x2ecc71 : 0xe74c3c)
                    .setTimestamp()
            ]
        });
    }
};
