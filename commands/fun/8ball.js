const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: '8ball',
    description: 'Ask the magic 8-ball a question',
    usage: '%8ball <question>',
    category: 'fun',
    aliases: ['eightball', 'magic8ball'],
    cooldown: 2,

    async execute(message, args) {
        if (!args.length) {
            return await sendAsFloofWebhook(message, { 
                content: '❓ Please ask the magic 8-ball a question! Usage: `%8ball <question>`' 
            });
        }

        const responses = [
            'It is certain.', 'Without a doubt.', 'You may rely on it.', 'Yes, definitely.', 'As I see it, yes.',
            'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.', 'Reply hazy, try again.',
            'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Don\'t count on it.',
            'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
        ];
        
        const reply = responses[Math.floor(Math.random() * responses.length)];
        await sendAsFloofWebhook(message, { content: `🎱 ${reply}` });
    }
};
