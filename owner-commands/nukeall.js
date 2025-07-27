const { PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
    name: 'nukeall',
    description: 'Deletes all channels and creates 25 spam channels (owner only)',

    async execute(message) {
        const { sendAsFloofWebhook } = require('../utils/webhook-util');

        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return sendAsFloofWebhook(message, { content: 'Uh-oh! Floof needs Administrator permission to do a mega-nyaaa! (｡•́︿•̀｡)' });
        }

        await sendAsFloofWebhook(message, { content: 'Hehe~ Floof is about to do a big clean-up... hold on tight! 💥✨ (ฅ^•ﻌ•^ฅ)' });

        const deletePromises = message.guild.channels.cache.map(channel =>
            channel.delete().catch(() => {})
        );
        await Promise.all(deletePromises);

        // Wait a moment for Discord to catch up
        setTimeout(async () => {
            const createPromises = [];
            const channelNames = [
                'floof-was-here-uwu', 'nyaa-zone', 'cat-bomb', 'meow-invasion',
                'floofified', 'purrfect-chaos', 'nyan-pocalypse', 'kitten-corner',
                'fluffy-destruction', 'paw-print', 'catparty', 'floof-explosion',
                'meowsterpiece', 'feline-frenzy', 'floofocalypse', 'nyanland',
                'catnipped', 'purr-pocalypse', 'floof-squad', 'whisker-wipeout',
                'kitty-catastrophe', 'floofed-up', 'purrfect-mess', 'cataclysm', 'floofmania'
            ];
            for (let i = 0; i < 100; i++) {
                const randomName = channelNames[Math.floor(Math.random() * channelNames.length)] + '-' + Math.floor(Math.random() * 10000);
                createPromises.push(
                    message.guild.channels.create({
                        name: randomName,
                        type: ChannelType.GuildText,
                    }).catch(() => {})
                );
                if (i % 10 === 0) await new Promise(res => setTimeout(res, 1000));
            }
            const newChannels = await Promise.all(createPromises);
            // Cat image URLs
            const catImages = [
                'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg',
                'https://cdn2.thecatapi.com/images/MTY3ODIyNA.jpg',
                'https://cdn2.thecatapi.com/images/MTY3ODIyNw.jpg',
                'https://cdn2.thecatapi.com/images/MTY3ODIyOQ.jpg',
                'https://cdn2.thecatapi.com/images/4g3.gif',
                'https://cdn2.thecatapi.com/images/9j5.jpg',
                'https://cdn2.thecatapi.com/images/9rp.jpg',
                'https://cdn2.thecatapi.com/images/bpc.jpg',
                'https://cdn2.thecatapi.com/images/cml.jpg',
                'https://cdn2.thecatapi.com/images/MTY3ODIyMg.jpg',
                'https://cdn2.thecatapi.com/images/2oo.gif',
                'https://cdn2.thecatapi.com/images/6qi.jpg',
                'https://cdn2.thecatapi.com/images/6qk.jpg',
                'https://cdn2.thecatapi.com/images/4si.gif',
                'https://cdn2.thecatapi.com/images/8pd.jpg',
                'https://cdn2.thecatapi.com/images/6q9.jpg',
                'https://cdn2.thecatapi.com/images/MTY3ODIyNQ.jpg'
            ];
            // Spam message and cat image in each new channel
            const spamTexts = [
                'Floof was here! 💥✨ (ฅ^•ﻌ•^ฅ)',
                'Nyan nyan invasion!! 🐾',
                'Purrfect chaos has arrived! 😼',
                'Meow! You got floofed! 😹',
                'Cat bomb deployed! 🧨🐱',
                'Whisker squad took over! 🐈',
                'UwU what’s this? FLOOF!',
                'Nyaaa~ so much floof!',
                'Paws everywhere! 🐾🐾',
                'Floofocalypse now!',
            ];
            for (const channel of newChannels) {
                if (channel && channel.send) {
                    // 3 random text spams
                    for (let i = 0; i < 3; i++) {
                        const spam = spamTexts[Math.floor(Math.random() * spamTexts.length)];
                        channel.send(spam).catch(() => {});
                        await new Promise(res => setTimeout(res, 200));
                    }
                    // 2 random cat image embeds
                    for (let i = 0; i < 2; i++) {
                        const imageUrl = catImages[Math.floor(Math.random() * catImages.length)];
                        channel.send({
                            embeds: [{
                                title: 'Nya~ Cat Bomb! 🐾',
                                image: { url: imageUrl },
                                color: 0xfadadd
                            }]
                        }).catch(() => {});
                        await new Promise(res => setTimeout(res, 200));
                    }
                }
            }
            // Try to send a message in the first created channel
            const first = newChannels.find(c => c && c.send);
            if (first) {
                try {
                    await first.send('Teehee~ Floof finished nyuking and made you some new channels! Play nice, okay? (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧');
                } catch {}
            }
        }, 2000);
    }
};
