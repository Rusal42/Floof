const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'shoot',
    description: 'Shoot someone with a GIF',
    usage: '%shoot [@user]',
    category: 'fun',
    aliases: ['gun', 'bang'],
    cooldown: 3,

    async execute(message, args) {
        const shootGifs = [
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/4CRg29WJn1mqMlPhYv/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/28p7K4xfPHK8w/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/NQYpTBk2fh4yTnOu67/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/10ZuedtImbopos/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ajM0bDY1cnhnNmc0aHBqajh4MDF6OGZnbGpkN25vMTU4YWp5NTA5cyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UtaKZbGPUaXc1dR1F0/giphy.gif'
        ];

        const randomGif = shootGifs[Math.floor(Math.random() * shootGifs.length)];
        const sender = message.member ? message.member.displayName : message.author.username;
        const mentioned = message.mentions.users.first();
        let description;
        
        if (mentioned) {
            description = `**${sender}** shoots **${mentioned.username}**! 🔫`;
        } else {
            description = `**${sender}** shoots into the air! 🔫`;
        }
        
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setImage(randomGif)
            .setColor(0x808080);
            
        sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
