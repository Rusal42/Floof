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
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/klmpEcFgXzrYQ/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/XTK2z2iSD3tmw/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/VpcYdQpElriNy/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UUjkoeNhnn0K4/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MDBxNDNrZDI2cXoyd2xtYzlreTB3aW55czlmZGZ1eWxjbnppd3ptYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/yHeHqyoRLBBSM/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3NjZ1OHo3OWx3c25nNGJpbGFqdnU2dGswdjJoY3pweWw5cWZqcjE1cCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/GRzu5TkwUxjYQ/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZnRjbTluNGt1cHExNThkOThtZmZnOWFtZmZubWh1YzFkZXM3Njl4NSZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/ulWUgCk4F1GGA/giphy.gif'
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
