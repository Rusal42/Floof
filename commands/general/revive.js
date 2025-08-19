const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs').promises;
const path = require('path');

// Configuration file path - using absolute path to data directory
const CONFIG_FILE = path.join(process.cwd(), 'data', 'server-configs.json');

module.exports = {
    name: 'revive',
    description: 'Ping the configured revive role with a custom embedded message to revive chat',
    usage: '%revive <your message>',
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

        // Require a custom message
        const custom = args.join(' ').trim();
        if (!custom) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Please provide a message. Usage: `%revive <your message>`'
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📣 Revive Ping')
            .setDescription(custom)
            .setColor(0xF1C40F)
            .setFooter({ text: `Requested by ${message.member.displayName}` });

        await message.channel.send({
            content: `${role}`,
            embeds: [embed]
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
