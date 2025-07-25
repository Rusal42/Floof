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
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjZreGlreDhkb3A5NjZrb3c5b2x1bXMwY3BqdjViamc0Z2RsMmNpaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/OqQOwXiCyJAmA/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bWJtb3ZwZWY0NWIycTBweHRoN280NnIwdXVubHBrMWxldzRkbXg0OCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/l0Iy0QdzD3AA6bgIg/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bWJtb3ZwZWY0NWIycTBweHRoN280NnIwdXVubHBrMWxldzRkbXg0OCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/LO9Y9hKLupIwko9IVd/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bHJ3YW9qczF5bGpyOWg2YXN4azlvZG05ZmMwdzM1NXVkM2R5MzZ4ZCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/YW3obh7zZ4Rj2/giphy.gif'
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
