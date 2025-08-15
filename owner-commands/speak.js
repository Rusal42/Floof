const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { isOwner } = require('../utils/owner-util');

module.exports = {
    name: 'speak',
    description: 'Make the bot speak a message through webhook',
    usage: '%speak <message>',
    category: 'general',
    aliases: ['say'],
    ownerOnly: true,
    cooldown: 3,

    async execute(message, args) {
        // Check if user is owner
        if (!isOwner(message.author.id)) {
            return message.reply('❌ Only bot owners can use this command!');
        }

        const text = args.join(' ');
        if (!text || text === '') {
            return message.reply('Please provide a message for me to speak!');
        }

        await message.channel.send(text);
        await message.delete().catch(() => {});
    }
};
