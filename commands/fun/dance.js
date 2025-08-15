const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'dance',
    description: 'Dance with someone or by yourself with a GIF',
    usage: '%dance [@user]',
    category: 'fun',
    aliases: ['boogie'],
    cooldown: 3,

    async execute(message, args) {
        const danceGifs = [
            'https://i.giphy.com/LML5ldpTKLPelFtBfY.gif',
            'https://i.giphy.com/6k6iDdi5NN8ZO.gif',
            'https://i.giphy.com/a6pzK009rlCak.gif',
            'https://i.giphy.com/3oEdv44BQhHojnGY7u.gif',
            'https://i.giphy.com/jURLx4mtSwPAY.gif'
        ];

        const randomGif = danceGifs[Math.floor(Math.random() * danceGifs.length)];
        const sender = message.member ? message.member.displayName : message.author.username;
        const mentioned = message.mentions.users.first();
        let description;
        
        if (mentioned) {
            description = `**${sender}** dances with **${mentioned.username}**! 💃`;
        } else {
            description = `**${sender}** starts dancing! 💃`;
        }
        
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setImage(randomGif)
            .setColor(0xffd700);
            
        sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
