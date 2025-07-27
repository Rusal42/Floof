const { PermissionsBitField } = require('discord.js');

async function fluffySnap(message) {
    const { sendAsFloofWebhook } = require('../utils/webhook-util');
    
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return sendAsFloofWebhook(message, { content: 'Floof needs Administrator permission to do a fluffy snap! (ฅ^•ﻌ•^ฅ)' });
    }
    await sendAsFloofWebhook(message, { content: 'Floof is about to do a super fluffy snap... All channels will be swept away! ✨🐾' });

    // Delete all channels
    const deletePromises = message.guild.channels.cache.map(channel =>
        channel.delete().catch(() => {})
    );
    await Promise.all(deletePromises);
    // Create a single channel so the owner can run %fluffysetup
    let setupChannel;
    try {
        setupChannel = await message.guild.channels.create({
            name: 'fluffy-setup-here',
            type: 0, // ChannelType.GuildText
            topic: 'Run %fluffysetup here to fill the server with fluff!'
        });
        await setupChannel.send('Teehee~ All done! The server is now a blank canvas for extra fluffiness! Run `%fluffysetup` here to fill it with cozy channels! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧');
    } catch {}
}

module.exports = { fluffySnap };
