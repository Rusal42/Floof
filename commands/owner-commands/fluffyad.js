const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { isOwner } = require('../../utils/owner-util');

module.exports = {
    name: 'fluffyad',
    description: 'Advertise the Fluffy server with invite and information',
    usage: '%fluffyad',
    category: 'owner',
    aliases: ['fluffy-ad', 'advertise', 'serverad'],
    cooldown: 10,

    async execute(message, args) {
        // Check if user is bot owner
        if (!isOwner(message.author.id)) {
            return await sendAsFloofWebhook(message, {
                content: '❌ Only the bot owner can use this command.'
            });
        }

        // Array of cat images for variety
        const catImages = [
            'https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg',
            'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg',
            'https://cdn2.thecatapi.com/images/bpc.jpg',
            'https://cdn2.thecatapi.com/images/MTgwODA3MA.jpg',
            'https://cdn2.thecatapi.com/images/9j5.jpg',
            'https://cdn2.thecatapi.com/images/e35.jpg',
            'https://cdn2.thecatapi.com/images/MTY4ODE2Mw.jpg',
            'https://cdn2.thecatapi.com/images/ag4.jpg'
        ];

        // Select a random cat image
        const randomCatImage = catImages[Math.floor(Math.random() * catImages.length)];

        const embed = new EmbedBuilder()
            .setTitle('🐱 Join the Fluffy Community! 🐱')
            .setDescription([
                '**Welcome to Fluffy - The Ultimate Cat-Loving Discord Server!**',
                '',
                '🎮 **What we offer:**',
                '• Active and friendly community of cat enthusiasts',
                '• Fun games, events, and activities',
                '• Cat photo sharing and appreciation',
                '• Helpful and welcoming members',
                '• Regular community events and contests',
                '• Safe and moderated environment',
                '',
                '🌟 **Why join us?**',
                '• Meet fellow cat lovers from around the world',
                '• Share your adorable cat photos and stories',
                '• Participate in fun community challenges',
                '• Get support and advice from experienced cat owners',
                '• Enjoy a drama-free, positive atmosphere',
                '',
                '**Ready to join the fluffiest community on Discord?**'
            ].join('\n'))
            .setColor('#FF69B4')
            .setImage(randomCatImage)
            .addFields(
                {
                    name: '🔗 Server Invite',
                    value: '[**Click here to join!**](https://discord.gg/Acpx662Eyg)',
                    inline: true
                },
                {
                    name: '👥 Community',
                    value: 'Cat lovers welcome!',
                    inline: true
                },
                {
                    name: '🎉 Activities',
                    value: 'Games, events & more!',
                    inline: true
                }
            )
            .setFooter({ 
                text: '🐾 Fluffy - Where cat lovers unite! 🐾',
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        try {
            await sendAsFloofWebhook(message, { embeds: [embed] });
            
            // Send a follow-up message with the direct invite link
            setTimeout(async () => {
                await sendAsFloofWebhook(message, {
                    content: '🔗 **Direct invite link:** https://discord.gg/Acpx662Eyg'
                });
            }, 1000);

        } catch (error) {
            console.error('Error sending fluffy advertisement:', error);
            await sendAsFloofWebhook(message, {
                content: '❌ Failed to send advertisement. Please try again.'
            });
        }
    }
};
