const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'pat',
    description: 'Give someone gentle pats',
    usage: '%pat [@user]',
    category: 'fun',
    aliases: ['headpat'],
    cooldown: 3,

    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;
        const patter = message.author;
        
        try {
            const res = await fetch('https://api.otakugifs.xyz/gif?reaction=pat');
            const data = await res.json();
            
            let description;
            if (target.id === patter.id) {
                description = `${patter} pats themselves! Self-care is important! 😊`;
            } else {
                description = `${patter} gently pats ${target}! 😊`;
            }
            
            const embed = new EmbedBuilder()
                .setDescription(description)
                .setImage(data.url)
                .setColor(0xffb6c1);
                
            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            console.error('Pat GIF API error:', err);
            let fallbackText;
            if (target.id === patter.id) {
                fallbackText = `${patter} pats themselves! Self-care is important! 😊`;
            } else {
                fallbackText = `${patter} gently pats ${target}! 😊`;
            }
            await sendAsFloofWebhook(message, { content: fallbackText });
        }
    }
};
