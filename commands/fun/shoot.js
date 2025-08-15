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
            'https://i.giphy.com/4CRg29WJn1mqMlPhYv.gif',
            'https://i.giphy.com/28p7K4xfPHK8w.gif',
            'https://i.giphy.com/10ZuedtImbopos.gif',
            'https://i.giphy.com/UtaKZbGPUaXc1dR1F0.gif'
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
