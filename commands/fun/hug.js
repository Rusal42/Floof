const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'hug',
    description: 'Give someone a warm hug',
    usage: '%hug [@user]',
    category: 'fun',
    aliases: ['embrace'],
    cooldown: 3,

    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;
        const hugger = message.author;
        
        try {
            const res = await fetch('https://api.otakugifs.xyz/gif?reaction=hug');
            const data = await res.json();
            
            let description;
            if (target.id === hugger.id) {
                description = `${hugger} gives themselves a self-hug! 🤗`;
            } else {
                description = `${hugger} gives ${target} a warm hug! 🤗`;
            }
            
            const embed = new EmbedBuilder()
                .setDescription(description)
                .setImage(data.url)
                .setColor(0xffb6c1);
                
            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            console.error('Hug GIF API error:', err);
            let fallbackText;
            if (target.id === hugger.id) {
                fallbackText = `${hugger} gives themselves a self-hug! 🤗`;
            } else {
                fallbackText = `${hugger} gives ${target} a warm hug! 🤗`;
            }
            await sendAsFloofWebhook(message, { content: fallbackText });
        }
    }
};
