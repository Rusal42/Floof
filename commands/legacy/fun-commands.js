// fun-commands.js
// Add fun bot commands here. Example: jokes, memes, games, etc.

const { EmbedBuilder } = require('discord.js');

// const fetch = require('node-fetch'); // Not needed - using built-in fetch
const { sendAsFloofWebhook } = require('../../utils/webhook-util');

// Random joke command
function joke(message) {
    const jokes = [
        'Why did the cat join Discord? To make purr-fect friends!',
        'Why did the scarecrow win an award? Because he was outstanding in his field!',
        'Why don’t skeletons fight each other? They don’t have the guts.',
        'What do you call cheese that isn’t yours? Nacho cheese!',
        'Why did the math book look sad? Because it had too many problems.'
    ];
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    sendAsFloofWebhook(message, { content: randomJoke });
}

// Magic 8-ball command
function eightBall(message, question) {
    const responses = [
        'It is certain.', 'Without a doubt.', 'You may rely on it.', 'Yes, definitely.', 'As I see it, yes.',
        'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.', 'Reply hazy, try again.',
        'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Don’t count on it.',
        'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
    ];
    const reply = responses[Math.floor(Math.random() * responses.length)];
    sendAsFloofWebhook(message, { content: `🎱 ${reply}` });
}

// Cat image command
async function cat(message) {
    try {
        const res = await fetch('https://api.thecatapi.com/v1/images/search');
        const data = await res.json();
        if (data[0] && data[0].url) {
            const embed = new EmbedBuilder()
                .setTitle('🐾 Here’s a cat for you!')
                .setImage(data[0].url)
                .setColor(0xffb6c1);
            sendAsFloofWebhook(message, { embeds: [embed] });
        } else {
            sendAsFloofWebhook(message, { content: 'Could not fetch a cat image right now. 😿' });
        }
    } catch (err) {
        sendAsFloofWebhook(message, { content: 'Error fetching cat image. 😿' });
    }
}

// Hug GIF command
function hug(message) {
    const hugGifs = [
        'https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif',
        'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
        'https://media.giphy.com/media/143v0Z4767T15e/giphy.gif',
        'https://media.giphy.com/media/PHZ7v9tfQu0o0/giphy.gif',
        'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif',
        'https://media.giphy.com/media/10BcGXjbHOctZC/giphy.gif',
        'https://media.giphy.com/media/sUIZWMnfd4Mb6/giphy.gif',
        'https://media.giphy.com/media/BXrwTdoho6hkQ/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dGQ5aGY4aWg5MDJpdGt5NmtjaDA5ODRzNnhyeHF4bDV3aWV0d29lciZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/WcYMoQgUdODWo/giphy.gif',
        'https://media.giphy.com/media/5eyhBKLvYhafu/giphy.gif'
    ];
    const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** hugged **${mentioned}**! 🤗`;
    } else {
        description = `**${sender}** sends a big hug to everyone! 🤗`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xffb6c1);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Pat GIF command
function pat(message) {
    const patGifs = [
        'https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif',
        'https://media.giphy.com/media/109ltuoSQT212w/giphy.gif',
        'https://media.giphy.com/media/ye7OTQgwmVuVy/giphy.gif',
        'https://media.giphy.com/media/L2z7dnOduqEow/giphy.gif',
        'https://media.giphy.com/media/12hvLuZ7uzvCvK/giphy.gif',
        'https://media.giphy.com/media/OSq9souL3j5zW/giphy.gif',

    ];
    const randomGif = patGifs[Math.floor(Math.random() * patGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** pats **${mentioned}**! 🐾`;
    } else {
        description = `**${sender}** gives everyone a gentle pat! 🐾`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xffe4b5);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Slap GIF command
function slap(message) {
    const slapGifs = [
        'https://media.giphy.com/media/Gf3AUz3eBNbTW/giphy.gif',
        'https://media.giphy.com/media/jLeyZWgtwgr2U/giphy.gif',
        'https://media.giphy.com/media/RXGNsyRb1hDJm/giphy.gif',
        'https://media.giphy.com/media/Zau0yrl17uzdK/giphy.gif',
        'https://media.giphy.com/media/3XlEk2RxPS1m8/giphy.gif',
        'https://media.giphy.com/media/mEtSQlxqBtWWA/giphy.gif',
        'https://media.giphy.com/media/fO6UtDy5pWYwM/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ajR2dXNhbnl4b3ZwaDIyaThscHF2dnBzejdwd2QyYnptczJ4cGl1OSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Z5zuypybI5dYc/giphy.gif'
    ];
    const randomGif = slapGifs[Math.floor(Math.random() * slapGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** playfully slaps **${mentioned}**! 👋`;
    } else {
        description = `**${sender}** slaps the air! 👋`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xff6961);
    if (randomGif && randomGif.endsWith('.gif')) {
        sendAsFloofWebhook(message, { embeds: [embed] });
    } else {
        sendAsFloofWebhook(message, { content: description + '\n[Slap GIF](' + randomGif + ')' });
    }
}


// Dice roll command
function roll(message) {
    const result = Math.floor(Math.random() * 6) + 1;
    sendAsFloofWebhook(message, { content: `You rolled a **${result}**! 🎲` });
}



function funMenu(message) {
    const embed = new EmbedBuilder()
        .setTitle('🎉 Fun Menu')
        .setDescription([
            '`%joke` — Get a random joke!',
            '`%8ball <question>` — Ask the magic 8-ball.',
            '`%roll` — Roll a dice!',
            '`%cat` — Get a random cat picture!',
            '`%hug [@user]` — Give someone a hug!',
            '`%pat [@user]` — Pat someone!',
            '`%slap [@user]` — Slap someone!',
            '`%kiss [@user]` — Kiss someone!',
            '`%poke [@user]` — Poke someone!',
            '`%cuddle [@user]` — Cuddle!',
            '`%highfive [@user]` — High-five!',
            '`%bite [@user]` — Bite!',
            '`%blush` — Blush!',
            '`%wave [@user]` — Wave!',
            '`%dance [@user]` — Dance!',
            '`%shoot [@user]` — Shoot (playfully)!'
        ].join('\n'))
        .setColor(0xffb6c1)
        .setFooter({ text: 'Have fun with Floof!' });
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Kiss command
function kiss(message) {
    const kissGifs = [
        'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
        'https://media.giphy.com/media/FqBTvSNjNzeZG/giphy.gif',
        'https://media.giphy.com/media/bGm9FuBCGg4SY/giphy.gif',
        'https://media.giphy.com/media/zkppEMFvRX5FC/giphy.gif',
        'https://media.giphy.com/media/KH1CTZtw1iP3W/giphy.gif',
        'https://media.giphy.com/media/4HP0ddZnNVvKU/giphy.gif'
    ];
    const randomGif = kissGifs[Math.floor(Math.random() * kissGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** kissed **${mentioned}**! 💋`;
    } else {
        description = `**${sender}** blows a kiss to everyone! 💋`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xff69b4);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Poke command
function poke(message) {
    const pokeGifs = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXl5dWZ5YWY3MTgyc2R6OTZyNGc1cHE0dGl0aGw5b211NXBrNjEwZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/FdinyvXRa8zekBkcdK/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXl5dWZ5YWY3MTgyc2R6OTZyNGc1cHE0dGl0aGw5b211NXBrNjEwZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/XbvJpFquZy3SAiPRyp/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3azhtbnhsajVnbGZ1dTh2a29uZjJ6ZzlsZ2lwdHB5OGgzNXh4M3NpaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/f4Ieb7p56fwP0euIfr/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3NWprZmt0cTZuYmp2bXowM3RpZzR4cmd6c3Jsb3V0M2xvNDVkaGVpcSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Cy6PX2IRtzbjy/giphy.gif'
    ];
    const randomGif = pokeGifs[Math.floor(Math.random() * pokeGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** pokes **${mentioned}**! 👉`;
    } else {
        description = `**${sender}** pokes the air! 👉`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xffe066);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Cuddle command
function cuddle(message) {
    const cuddleGifs = [
        'https://media.giphy.com/media/143v0Z4767T15e/giphy.gif',
        'https://media.giphy.com/media/PHZ7v9tfQu0o0/giphy.gif',
        'https://media.giphy.com/media/49mdjsMrH7oze/giphy.gif',
        'https://media.giphy.com/media/sUIZWMnfd4Mb6/giphy.gif'
    ];
    const randomGif = cuddleGifs[Math.floor(Math.random() * cuddleGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** cuddles up with **${mentioned}**! 🥰`;
    } else {
        description = `**${sender}** wants a cuddle! 🥰`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xfadadd);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Highfive command
function highfive(message) {
    const highfiveGifs = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzVpanVic2x5ZGhpNWN2ZjNyNG40bXBobzJteHk0ejZ3Mmw2d3JiayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xThuWpoG470Q0stGmI/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3YjgzbnhyYTVxNGZ3MHBsZXpxMmJ5cXhiMXFmeDd5M2xiZzZxajNrYSZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/Xir746WTkWpiM/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cTc3a3EyYWF4MHo0MzQyeXM4d3E2Z2F5azFjdmJqbDI4czVpbGxzcyZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/VuwYcvElLOnuw/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cDRucmtiOHN3OXRjNGcxeW11NHZ4YmdyZHpqMHpxM2V3ODl2M25zaSZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/aGVvqGKFOXIvC/giphy.gif'
    ];
    const randomGif = highfiveGifs[Math.floor(Math.random() * highfiveGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** high-fives **${mentioned}**! 🙏`;
    } else {
        description = `**${sender}** is looking for a high-five! 🙏`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0x87cefa);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Bite command
function bite(message) {
    const biteGifs = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjZreGlreDhkb3A5NjZrb3c5b2x1bXMwY3BqdjViamc0Z2RsMmNpaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/OqQOwXiCyJAmA/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bWJtb3ZwZWY0NWIycTBweHRoN280NnIwdXVubHBrMWxldzRkbXg0OCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/l0Iy0QdzD3AA6bgIg/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bWJtb3ZwZWY0NWIycTBweHRoN280NnIwdXVubHBrMWxldzRkbXg0OCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/LO9Y9hKLupIwko9IVd/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bHJ3YW9qczF5bGpyOWg2YXN4azlvZG05ZmMwdzM1NXVkM2R5MzZ4ZCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/YW3obh7zZ4Rj2/giphy.gif'
    ];

    const randomGif = biteGifs[Math.floor(Math.random() * biteGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** bites **${mentioned}**! 😈`;
    } else {
        description = `**${sender}** playfully bites the air! 😈`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0x8b0000);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Blush command
function blush(message) {
    const blushGifs = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/klmpEcFgXzrYQ/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/XTK2z2iSD3tmw/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/VpcYdQpElriNy/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemdrMGY3czE1YTU0N3JjZG5icTh2MmFxc3c1bG05bXJiZ3R0N2lneiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UUjkoeNhnn0K4/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MDBxNDNrZDI2cXoyd2xtYzlreTB3aW55czlmZGZ1eWxjbnppd3ptYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/yHeHqyoRLBBSM/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3NjZ1OHo3OWx3c25nNGJpbGFqdnU2dGswdjJoY3pweWw5cWZqcjE1cCZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/GRzu5TkwUxjYQ/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZnRjbTluNGt1cHExNThkOThtZmZnOWFtZmZubWh1YzFkZXM3Njl4NSZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/ulWUgCk4F1GGA/giphy.gif'
    ];
    const randomGif = blushGifs.length > 0 ? blushGifs[Math.floor(Math.random() * blushGifs.length)] : null;
    const sender = message.member ? message.member.displayName : message.author.username;
    let description = `**${sender}** is blushing! 😳`;
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xffb6c1);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Wave command
function wave(message) {
    const waveGifs = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZW0wMnk4b3RrZTg1cThlYmt1eTk1YnhodG5mMjI4ZzA5NXI3NzIzayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/yyVph7ANKftIs/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZW0wMnk4b3RrZTg1cThlYmt1eTk1YnhodG5mMjI4ZzA5NXI3NzIzayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/9cZQnwdzUXTDG/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3E3Z3kyaWo4eTRiaW81ZnduMGVhOG44bTRhdTU3Z2s3NDFkZmZ6eCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Fx3VWDj00X8zXDDSLK/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3E3Z3kyaWo4eTRiaW81ZnduMGVhOG44bTRhdTU3Z2s3NDFkZmZ6eCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/AmVFCGRpBsY24/giphy.gif'
    ];
    const randomGif = waveGifs[Math.floor(Math.random() * waveGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** waves at **${mentioned}**! 👋`;
    } else {
        description = `**${sender}** waves to everyone! 👋`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xadd8e6);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Dance command
function dance(message) {
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
        description = `**${sender}** dances with **${mentioned}**! 💃`;
    } else {
        description = `**${sender}** starts dancing! 💃`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0xffd700);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

// Shoot command
function shoot(message) {
    const shootGifs = [
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/4CRg29WJn1mqMlPhYv/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/28p7K4xfPHK8w/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/NQYpTBk2fh4yTnOu67/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2Zzd2J5aWc0MjVvdHByNTk5bG1qcm85cHBmMzBlOG0wZTJlZ3FqbCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/10ZuedtImbopos/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ajM0bDY1cnhnNmc0aHBqajh4MDF6OGZnbGpkN25vMTU4YWp5NTA5cyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UtaKZbGPUaXc1dR1F0/giphy.gif'
    ];
    const randomGif = shootGifs[Math.floor(Math.random() * shootGifs.length)];
    const sender = message.member ? message.member.displayName : message.author.username;
    const mentioned = message.mentions.users.first();
    let description;
    if (mentioned) {
        description = `**${sender}** shoots **${mentioned}**! 🔫`;
    } else {
        description = `**${sender}** shoots into the air! 🔫`;
    }
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(randomGif)
        .setColor(0x808080);
    sendAsFloofWebhook(message, { embeds: [embed] });
}

module.exports = {

    joke,
    eightBall,
    cat,
    hug,
    pat,
    slap,
    roll,
    funMenu,
    kiss,
    poke,
    cuddle,
    highfive,
    bite,
    blush,
    wave,
    dance,
    shoot
};
