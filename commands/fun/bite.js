const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'bite',
    description: 'Bite someone with a GIF',
    usage: '%bite [@user]',
    category: 'fun',
    aliases: ['chomp'],
    cooldown: 3,

    async execute(message, args) {
        const biteGifs = [
            'https://i.giphy.com/OqQOwXiCyJAmA.gif',
            'https://i.giphy.com/l0Iy0QdzD3AA6bgIg.gif',
            'https://i.giphy.com/LO9Y9hKLupIwko9IVd.gif',
            'https://i.giphy.com/YW3obh7zZ4Rj2.gif'
        ];

        const randomGif = biteGifs[Math.floor(Math.random() * biteGifs.length)];
        const sender = message.member ? message.member.displayName : message.author.username;
        const mentioned = message.mentions.users.first();
        let description;
        
        if (mentioned) {
            description = `**${sender}** bites **${mentioned.username}**! 😈`;
        } else {
            description = `**${sender}** playfully bites the air! 😈`;
        }
        
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setImage(randomGif)
            .setColor(0x8b0000);
            
        sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
