const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'cat',
    description: 'Shows a random cat image',
    usage: '%cat',
    category: 'fun',
    aliases: ['kitty', 'kitten'],
    cooldown: 3,

    async execute(message, args) {
        try {
            const res = await fetch('https://api.thecatapi.com/v1/images/search');
            const data = await res.json();
            
            if (data[0] && data[0].url) {
                const embed = new EmbedBuilder()
                    .setTitle('🐾 Here\'s a cat for you!')
                    .setImage(data[0].url)
                    .setColor(0xffb6c1);
                await sendAsFloofWebhook(message, { embeds: [embed] });
            } else {
                await sendAsFloofWebhook(message, { content: 'Could not fetch a cat image right now. 😿' });
            }
        } catch (err) {
            console.error('Cat API error:', err);
            await sendAsFloofWebhook(message, { content: 'Error fetching cat image. 😿' });
        }
    }
};
