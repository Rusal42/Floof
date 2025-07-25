// Utility to send messages as Floof via webhook for a cleaner look
const { EmbedBuilder } = require('discord.js');

async function sendAsFloofWebhook(message, options) {
    // options: { content, embeds, files }
    let webhook;
    const webhooks = await message.channel.fetchWebhooks();
    webhook = webhooks.find(wh => wh.owner && wh.owner.id === message.client.user.id);
    if (!webhook) {
        webhook = await message.channel.createWebhook({
            name: 'Floof',
            avatar: message.client.user.displayAvatarURL()
        });
    }
    await webhook.send({
        username: 'Floof',
        avatarURL: message.client.user.displayAvatarURL(),
        ...options
    });
}

module.exports = { sendAsFloofWebhook };
