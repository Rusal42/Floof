const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'highfive',
    description: 'High-five someone with a GIF',
    usage: '%highfive [@user]',
    category: 'fun',
    aliases: ['hi5', 'h5'],
    cooldown: 3,

    async execute(message, args) {
        const highfiveGifs = [
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzVpanVic2x5ZGhpNWN2ZjNyNG40bXBobzJteHk0ejZ3Mmw2d3JiayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xThuWpoG470Q0stGmI/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3YjgzbnhyYTVxNGZ3MHBsZXpxMmJ5cXhiMXFmeDd5M2xiZzZxajNrYSZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/Xir746WTkWpiM/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cTc3a3EyYWF4MHo0MzQyeXM4d3E2Z2F5azFjdmJqbDI4czVpbGxzcyZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/VuwYcvElLOnuw/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cDRucmtiOHN3OXRjNGcxeW11NHZ4YmdyZHpqMHpxM2V3ODl2M25zaSZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/aGVvqGKFOXIvC/giphy.gif'
        ];

        const randomGif = highfiveGifs[Math.floor(Math.random() * highfiveGifs.length)];
        const sender = message.member ? message.member.displayName : message.author.username;
        const mentioned = message.mentions.users.first();
        let description;
        
        if (mentioned) {
            description = `**${sender}** high-fives **${mentioned.username}**! 🙏`;
        } else {
            description = `**${sender}** is looking for a high-five! 🙏`;
        }
        
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setImage(randomGif)
            .setColor(0x87cefa);
            
        sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
