const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'roll',
    description: 'Roll a dice (1-6) or specify sides',
    usage: '%roll [sides]',
    category: 'fun',
    aliases: ['dice', 'r'],
    cooldown: 1,

    async execute(message, args) {
        let sides = 6;
        
        if (args[0]) {
            const parsedSides = parseInt(args[0]);
            if (parsedSides && parsedSides > 1 && parsedSides <= 1000) {
                sides = parsedSides;
            } else if (parsedSides > 1000) {
                return await sendAsFloofWebhook(message, { 
                    content: '🎲 That\'s too many sides! Maximum is 1000.' 
                });
            } else {
                return await sendAsFloofWebhook(message, { 
                    content: '🎲 Please provide a valid number of sides (2-1000)!' 
                });
            }
        }
        
        const result = Math.floor(Math.random() * sides) + 1;
        await sendAsFloofWebhook(message, { 
            content: `🎲 You rolled a **${result}** out of ${sides}!` 
        });
    }
};
