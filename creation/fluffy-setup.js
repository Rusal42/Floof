const { ChannelType } = require('discord.js');

async function fluffySetup(message) {
    const { sendAsFloofWebhook } = require('../utils/webhook-util');
    
    if (!message.guild.members.me.permissions.has('Administrator')) {
        return sendAsFloofWebhook(message, { content: 'Floof needs Administrator permission to build her fluffy den! (ฅ^•ﻌ•^ฅ)' });
    }
    await sendAsFloofWebhook(message, { content: 'Teehee~ Floof is fluffing up your server! Please wait while I get cozy... 🐾' });

    // Categories and channels definition
    const structure = [
        {
            name: "🐾 Floof's Fluffy Den",
            channels: [
                { name: 'welcome', type: ChannelType.GuildText, topic: 'Welcome to Floof\'s Fluffy Den! Read the rules and get cozy!' },
                { name: 'rules', type: ChannelType.GuildText, topic: 'Stay fluffy and kind! Read the rules before you pounce.' },
                { name: 'announcements', type: ChannelType.GuildText, topic: 'Important news and updates from Floof!' }
            ]
        },
        {
            name: '🌸 Cozy Corner',
            channels: [
                { name: 'fluffy-chat', type: ChannelType.GuildText, topic: 'Chat about anything fluffy, cute, or fun!' },
                { name: 'introductions', type: ChannelType.GuildText, topic: 'Tell us about yourself and meet other floofs!' },
                { name: 'daily-meows', type: ChannelType.GuildText, topic: 'Share your mood or status today! Nyaa~' },
                { name: 'memes-and-giggles', type: ChannelType.GuildText, topic: 'Share memes, jokes, and giggles!' }
            ]
        },
        {
            name: '🐱 Cat Café',
            channels: [
                { name: 'cat-pics', type: ChannelType.GuildText, topic: 'Share your cutest cat and pet photos!' },
                { name: 'pet-gallery', type: ChannelType.GuildText, topic: 'All pets are welcome here!' },
                { name: 'floof-art', type: ChannelType.GuildText, topic: 'Share your art, drawings, and doodles!' },
                { name: 'fan-art', type: ChannelType.GuildText, topic: 'Show off your Floof fan art!' }
            ]
        },
        {
            name: '🎮 Playful Paws',
            channels: [
                { name: 'gaming-lounge', type: ChannelType.GuildText, topic: 'Talk about games and find friends to play with!' },
                { name: 'bot-commands', type: ChannelType.GuildText, topic: 'Use Floof\'s commands and minigames here!' },
                { name: 'minigames', type: ChannelType.GuildText, topic: 'Text minigames and fun!' }
            ]
        },
        {
            name: '💬 Fluff Support',
            channels: [
                { name: 'help-desk', type: ChannelType.GuildText, topic: 'Need help? Ask here and a friendly floof will help!' },
                { name: 'suggestions', type: ChannelType.GuildText, topic: 'Share your ideas to make the den even fluffier!' },
                { name: 'mod-mail', type: ChannelType.GuildText, topic: 'Contact the mod team privately.' }
            ]
        },
        {
            name: '🎵 Purr & Play',
            channels: [
                { name: 'purr-party', type: ChannelType.GuildVoice, topic: 'Hang out and purr together!' },
                { name: 'music-room', type: ChannelType.GuildVoice, topic: 'Listen to music and vibe!' },
                { name: 'afk-nap', type: ChannelType.GuildVoice, topic: 'For sleepy floofs who need a nap.' },
                { name: 'group-chat', type: ChannelType.GuildVoice, topic: 'General voice chat for all floofs.' }
            ]
        },
        {
            name: '🌈 Secret Fluff',
            channels: [
                { name: 'mod-lounge', type: ChannelType.GuildText, topic: 'Private lounge for mods.' },
                { name: 'event-planning', type: ChannelType.GuildText, topic: 'Plan fun events and surprises!' }
            ]
        },
        {
            name: '🛠️ Floof Dev Den',
            channels: [
                { name: 'floof-dev-chat', type: ChannelType.GuildText, topic: 'Discuss Floof\'s development and features.' },
                { name: 'floof-ideas', type: ChannelType.GuildText, topic: 'Brainstorm and suggest new ideas for Floof!' },
                { name: 'floof-changelog', type: ChannelType.GuildText, topic: 'See what\'s new with Floof!' },
                { name: 'floof-testing', type: ChannelType.GuildText, topic: 'A place for bot testing and experiments.' }
            ]
        }
    ];

    // Create categories and channels
    for (const category of structure) {
        let cat;
        try {
            cat = await message.guild.channels.create({
                name: category.name,
                type: ChannelType.GuildCategory
            });
        } catch (e) {
            continue;
        }
        for (const ch of category.channels) {
            try {
                await message.guild.channels.create({
                    name: ch.name,
                    type: ch.type,
                    topic: ch.topic,
                    parent: cat.id
                });
            } catch {}
        }
    }
    // Try to find the new welcome channel and send a message
    const welcome = message.guild.channels.cache.find(c => c.name === 'welcome');
    if (welcome && welcome.isTextBased()) {
        welcome.send('Welcome to Floof\'s Fluffy Den! Make yourself at home and enjoy the fluff! (ฅ^•ﻌ•^ฅ)♡');
    }
    await sendAsFloofWebhook(message, { content: 'All done! Your server is now extra fluffy and cozy! ✨🐾' });
}

module.exports = { fluffySetup };
