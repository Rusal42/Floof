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
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWJ4bWVoaWRqNnozbm1ieGM3YnZ4cnFjM2N5cXIwcWhnaTN5MDBzeSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/LML5ldpTKLPelFtBfY/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWJ4bWVoaWRqNnozbm1ieGM3YnZ4cnFjM2N5cXIwcWhnaTN5MDBzeSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6k6iDdi5NN8ZO/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWJ4bWVoaWRqNnozbm1ieGM3YnZ4cnFjM2N5cXIwcWhnaTN5MDBzeSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/a6pzK009rlCak/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3d3JkeG45bG94ZWthbmx1MTh3bmE2M3Y0cnp5NzA4ZG9oOWJ4ajI4eiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oEdv44BQhHojnGY7u/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWJ4bWVoaWRqNnozbm1ieGM3YnZ4cnFjM2N5cXIwcWhnaTN5MDBzeSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/sFKyfExMBYWpSEbcml/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MGR1eTRxZjgxeXo4MXk0YXk5eDN0azk3MXBuaHgyajNlemQ1M2gxOSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jURLx4mtSwPAY/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dWRhazdmaHFha205cmkwZGFkbDZxM2tvNm94Z29yYjY0aXh4ZG8zNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lrDAgsYq0eomhwoESZ/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MGJiM2ZiaDM5MzkyeGdsdHYwaDE1ejBva3B0aGQyM2praGNncDBoeCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/N4AIdLd0D2A9y/giphy.gif',
            'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MGJiM2ZiaDM5MzkyeGdsdHYwaDE1ejBva3B0aGQyM2praGNncDBoeCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/bfEOX1UuyCqVq/giphy.gif'
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
