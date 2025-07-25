const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'slap',
    description: 'Slap someone with a GIF',
    usage: '%slap [@user]',
    category: 'fun',
    aliases: ['smack'],
    cooldown: 3,

    async execute(message, args) {
        const slapGifs = [
            'https://media.giphy.com/media/Gf3AUz3eBNbTW/giphy.gif',
            'https://media.giphy.com/media/jLeyZWgtwgr2U/giphy.gif',
            'https://media.giphy.com/media/RXGNsyRb1hDJm/giphy.gif',
            'https://media.giphy.com/media/Zau0yrl17uzdK/giphy.gif',
            'https://media.giphy.com/media/3XlEk2RxPS1m8/giphy.gif',
            'https://media.giphy.com/media/mEtSQlxqBtWWA/giphy.gif',
            'https://media.giphy.com/media/fO6UtDy5pWYwM/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ajR2dXNhbnl4b3ZwaDIyaThscHF2dnBzejdwd2QyYnptczJ4cGl1OSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Z5zuypybI5dYc/giphy.gif'
        ];

        const randomGif = slapGifs[Math.floor(Math.random() * slapGifs.length)];
        const sender = message.member ? message.member.displayName : message.author.username;
        const mentioned = message.mentions.users.first();
        let description;
        
        if (mentioned) {
            description = `**${sender}** playfully slaps **${mentioned.username}**! 👋`;
        } else {
            description = `**${sender}** slaps the air! 👋`;
        }
        
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setImage(randomGif)
            .setColor(0xff6961);
            
        if (randomGif && randomGif.endsWith('.gif')) {
            sendAsFloofWebhook(message, { embeds: [embed] });
        } else {
            sendAsFloofWebhook(message, { content: description + '\n[Slap GIF](' + randomGif + ')' });
        }
    }
};
