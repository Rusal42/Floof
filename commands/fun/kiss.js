const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'kiss',
    description: 'Give someone a kiss',
    usage: '%kiss [@user]',
    category: 'fun',
    aliases: ['smooch'],
    cooldown: 3,

    async execute(message, args) {
        const target = message.mentions.users.first();
        const kisser = message.author;
        
        if (!target) {
            return await sendAsFloofWebhook(message, { 
                content: '💋 Who do you want to kiss? Mention someone!' 
            });
        }
        
        if (target.id === kisser.id) {
            return await sendAsFloofWebhook(message, { 
                content: '💋 You can\'t kiss yourself! That\'s a bit weird...' 
            });
        }
        
        try {
            const res = await fetch('https://api.otakugifs.xyz/gif?reaction=kiss');
            const data = await res.json();
            
            const embed = new EmbedBuilder()
                .setDescription(`${kisser} gives ${target} a kiss! 💋`)
                .setImage(data.url)
                .setColor(0xffb6c1);
                
            await sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            console.error('Kiss GIF API error:', err);
            await sendAsFloofWebhook(message, { 
                content: `${kisser} gives ${target} a kiss! 💋` 
            });
        }
    }
};
