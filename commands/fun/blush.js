const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'blush',
    description: 'Blush with a GIF',
    usage: '%blush',
    category: 'fun',
    aliases: ['shy'],
    cooldown: 3,

    async execute(message, args) {
        const blushGifs = [
            'https://i.giphy.com/klmpEcFgXzrYQ.gif',
            'https://i.giphy.com/XTK2z2iSD3tmw.gif',
            'https://i.giphy.com/VpcYdQpElriNy.gif',
            'https://i.giphy.com/UUjkoeNhnn0K4.gif',
            'https://i.giphy.com/yHeHqyoRLBBSM.gif'
        ];

        const randomGif = blushGifs.length > 0 ? blushGifs[Math.floor(Math.random() * blushGifs.length)] : null;
        const sender = message.member ? message.member.displayName : message.author.username;
        let description = `**${sender}** is blushing! 😳`;
        
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setImage(randomGif)
            .setColor(0xffb6c1);
            
        sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
