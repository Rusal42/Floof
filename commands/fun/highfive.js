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
            'https://i.giphy.com/xThuWpoG470Q0stGmI.gif',
            'https://i.giphy.com/Xir746WTkWpiM.gif',
            'https://i.giphy.com/VuwYcvElLOnuw.gif',
            'https://i.giphy.com/aGVvqGKFOXIvC.gif'
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
