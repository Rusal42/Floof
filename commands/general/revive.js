const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs').promises;
const path = require('path');

// Configuration file path - using absolute path to data directory
const CONFIG_FILE = path.join(process.cwd(), 'data', 'server-configs.json');

module.exports = {
    name: 'revive',
    description: 'Ping the configured revive role with a random question to get conversations started',
    usage: '%revive',
    category: 'general',
    aliases: [],
    permissions: [PermissionFlagsBits.ManageChannels],
    cooldown: 30,

    async execute(message, args) {
        // Check if user has Manage Channels permission
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ You need the `Manage Channels` permission to use this command!'
            });
        }

        // Get server configuration
        const config = await this.getConfig(message.guild.id);
        
        if (!config.reviveRole) {
            return await sendAsFloofWebhook(message, {
                content: '❌ No revive role configured for this server. Use `%config revive @role` to set one up!'
            });
        }

        // Check if the role still exists
        const role = message.guild.roles.cache.get(config.reviveRole);
        if (!role) {
            return await sendAsFloofWebhook(message, {
                content: '❌ The configured revive role no longer exists. Please reconfigure with `%config revive @role`'
            });
        }

        // Random questions for conversation starters
        const questions = [
            'If you could have any superpower, what would it be?',
            'What\'s your favorite comfort food?',
            'What\'s the weirdest dream you\'ve ever had?',
            'If you could travel anywhere in the world, where would you go?',
            'What\'s your favorite childhood memory?',
            'If you could meet any historical figure, who would it be?',
            'What\'s your biggest fear?',
            'What\'s the best advice you\'ve ever received?',
            'If you could learn any skill instantly, what would it be?',
            'What\'s your favorite way to spend a rainy day?',
            'If you could only eat one food for the rest of your life, what would it be?',
            'What\'s the most interesting place you\'ve ever visited?',
            'If you could have dinner with anyone, dead or alive, who would it be?',
            'What\'s your favorite book or movie?',
            'If you won the lottery, what\'s the first thing you\'d do?'
        ];

        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        
        await message.channel.send({
            content: `${role} Let's get active! Question: ${randomQuestion}`
        });
        
        // Delete the command message
        await message.delete().catch(() => {});
    },

    async getConfig(guildId) {
        try {
            const data = await fs.readFile(CONFIG_FILE, 'utf8');
            const configs = JSON.parse(data);
            return configs[guildId] || {};
        } catch (error) {
            return {};
        }
    }
};
