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
            'https://i.giphy.com/Gf3AUz3eBNbTW.gif',
            'https://i.giphy.com/jLeyZWgtwgr2U.gif',
            'https://i.giphy.com/RXGNsyRb1hDJm.gif',
            'https://i.giphy.com/Zau0yrl17uzdK.gif',
            'https://i.giphy.com/3XlEk2RxPS1m8.gif'
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
