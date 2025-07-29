const { PermissionsBitField, ChannelType, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../utils/webhook-util');

module.exports = {
    name: 'nukeall',
    description: 'Deletes all channels and creates 25 spam channels (owner only)',
    ownerOnly: true,
    permissions: ['Administrator'],
    category: 'owner',

    async execute(message) {
        // Check if the command is being used in a guild
        if (!message.guild) {
            return message.reply('This command can only be used in a server.');
        }
        // Check bot permissions
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return sendAsFloofWebhook(message, { 
                content: 'Uh-oh! Floof needs Administrator permission to do a mega-nyaaa! (｡•́︿•̀｡)' 
            });
        }

        // Send initial message
        const initialMsg = await sendAsFloofWebhook(message, { 
            content: 'Hehe~ Floof is about to do a big clean-up... hold on tight! 💥✨ (ฅ^•ﻌ•^ฅ)' 
        });

        try {
            // Delete all channels
            const channels = message.guild.channels.cache.filter(ch => ch.type !== ChannelType.GuildCategory);
            const deletePromises = [];
            
            // Delete channels in chunks to avoid rate limits
            const chunkSize = 5;
            const channelArray = Array.from(channels.values());
            
            for (let i = 0; i < channelArray.length; i += chunkSize) {
                const chunk = channelArray.slice(i, i + chunkSize);
                await Promise.all(chunk.map(channel => 
                    channel.delete().catch(e => console.error(`Error deleting channel ${channel.name}:`, e))
                ));
                
                // Add a small delay between chunks
                if (i + chunkSize < channelArray.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            await initialMsg.edit({ 
                content: 'Hehe~ All channels have been nuked! Creating new ones... 💣✨ (≧◡≦)' 
            });
        } catch (error) {
            console.error('Error deleting channels:', error);
            return sendAsFloofWebhook(message, { 
                content: 'Oops! Something went wrong while nuking channels. (╥_╥)' 
            });
        }

        try {
            // Create new channels
            const channelNames = [
                'floof-was-here-uwu', 'nyaa-zone', 'cat-bomb', 'meow-invasion',
                'floofified', 'purrfect-chaos', 'nyan-pocalypse', 'kitten-corner',
                'fluffy-destruction', 'paw-print', 'catparty', 'floof-explosion',
                'meowsterpiece', 'feline-frenzy', 'floofocalypse', 'nyanland',
                'catnipped', 'purr-pocalypse', 'floof-squad', 'whisker-wipeout',
                'kitty-catastrophe', 'floofed-up', 'purrfect-mess', 'cataclysm', 'floofmania'
            ];
            
            const newChannels = [];
            const channelsToCreate = 25; // Reduced from 100 to 25 as per description
            
            // Create channels in chunks
            const chunkSize = 5;
            for (let i = 0; i < channelsToCreate; i += chunkSize) {
                const chunkPromises = [];
                
                for (let j = 0; j < chunkSize && i + j < channelsToCreate; j++) {
                    const randomName = channelNames[Math.floor(Math.random() * channelNames.length)] + 
                                     '-' + Math.floor(Math.random() * 10000);
                    
                    chunkPromises.push(
                        message.guild.channels.create({
                            name: randomName,
                            type: ChannelType.GuildText,
                            reason: 'Nuked by ' + message.author.tag
                        }).catch(e => {
                            console.error('Error creating channel:', e);
                            return null;
                        })
                    );
                }
                
                // Wait for chunk to complete
                const chunkResults = await Promise.all(chunkPromises);
                newChannels.push(...chunkResults.filter(Boolean));
                
                // Add delay between chunks
                if (i + chunkSize < channelsToCreate) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Notify channels are being spammed
            await initialMsg.edit({ 
                content: 'Hehe~ Creating chaos with cat spam in the new channels! 🐱💣✨'
            });
            
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
                'UwU what\'s this? FLOOF!',
                'Nyaaa~ so much floof!',
                'Paws everywhere! 🐾🐾',
                'Floofocalypse now!',
            ];
            
            // Spam in channels
            try {
                const spamPromises = [];
                
                for (const channel of newChannels) {
                    if (channel && channel.send) {
                        // 3 random text spams
                        for (let i = 0; i < 3; i++) {
                            const spam = spamTexts[Math.floor(Math.random() * spamTexts.length)];
                            spamPromises.push(
                                channel.send(spam).catch(() => {})
                            );
                            await new Promise(res => setTimeout(res, 200));
                        }
                        // 2 random cat image embeds
                        for (let i = 0; i < 2; i++) {
                            const imageUrl = catImages[Math.floor(Math.random() * catImages.length)];
                            spamPromises.push(
                                channel.send({
                                    embeds: [{
                                        title: 'Nya~ Cat Bomb! 🐾',
                                        image: { url: imageUrl },
                                        color: 0xfadadd
                                    }]
                                }).catch(() => {})
                            );
                            await new Promise(res => setTimeout(res, 200));
                        }
                    }
                }
                
                await Promise.all(spamPromises);
                
                // Send completion message
                const first = newChannels.find(c => c && c.send);
                if (first) {
                    try {
                        await first.send({
                            embeds: [{
                                title: 'Nuke Complete! 💥',
                                description: 'All channels have been nuked and replaced with floofy chaos! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
                                color: 0xff69b4,
                                footer: { text: 'Nuked by ' + message.author.tag },
                                timestamp: new Date()
                            }]
                        }).catch(() => {});
                    } catch (error) {
                        console.error('Error sending completion message:', error);
                    }
                }
                
                // Clean up initial message
                await initialMsg.edit({ 
                    content: 'Nuke complete! Enjoy the floofy chaos! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
                    embeds: []
                });
                
            } catch (error) {
                console.error('Error during spamming:', error);
                await initialMsg.edit({ 
                    content: 'Nuke mostly complete, but there was an error spamming some channels. (╥_╥)'
                });
            }
        } catch (error) {
            console.error('Error in nukeall command:', error);
            await initialMsg.edit({ 
                content: 'Oops! Something went wrong during the nuke. (╥_╥)'
            });
        }
    }
};
