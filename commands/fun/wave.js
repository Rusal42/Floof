const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'wave',
    description: 'Wave at someone',
    usage: '%wave [@user]',
    category: 'fun',
    aliases: ['hi', 'hello'],
    cooldown: 2,

    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;
        const waver = message.author;
        
        try {
            const res = await fetch('https://api.otakugifs.xyz/gif?reaction=wave');
            const data = await res.json();
            
            let description;
            if (target.id === waver.id) {
                description = `${waver} waves at everyone! 👋`;
            } else {
                description = `${waver} waves at ${target}! 👋`;
            }
            
            const embed = new EmbedBuilder()
                .setDescription(description)
                .setImage(data.url)
                .setColor(0xffb6c1);
                
            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            console.error('Wave GIF API error:', err);
            let fallbackText;
            if (target.id === waver.id) {
                fallbackText = `${waver} waves at everyone! 👋`;
            } else {
                fallbackText = `${waver} waves at ${target}! 👋`;
            }
            await sendAsFloofWebhook(message, { content: fallbackText });
        }
    }
};
