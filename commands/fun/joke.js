const { sendAsFloofWebhook } = require('../../utils/webhook-util');

module.exports = {
    name: 'joke',
    description: 'Tells a random joke',
    usage: '%joke',
    category: 'fun',
    aliases: ['j'],
    cooldown: 3,

    async execute(message, args) {
        const jokes = [
            'Why did the cat join Discord? To make purr-fect friends!',
            'Why did the scarecrow win an award? Because he was outstanding in his field!',
            'Why don\'t skeletons fight each other? They don\'t have the guts.',
            'What do you call cheese that isn\'t yours? Nacho cheese!',
            'Why did the math book look sad? Because it had too many problems.',
            'What do you call a sleeping bull? A bulldozer!',
            'Why don\'t scientists trust atoms? Because they make up everything!',
            'What did the ocean say to the beach? Nothing, it just waved!',
            'Why did the cookie go to the doctor? Because it felt crumbly!',
            'What do you call a bear with no teeth? A gummy bear!'
        ];
        
        const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
        await sendAsFloofWebhook(message, { content: `😄 ${randomJoke}` });
    }
};
