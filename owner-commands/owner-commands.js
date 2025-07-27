// owner-commands.js
// Commands only the bot owner (by user ID) can run.

const { sendAsFloofWebhook } = require('../utils/webhook-util');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    meowlocked: async (message) => {
        const fs = require('fs');
        const path = require('path');
        const { EmbedBuilder } = require('discord.js');
        const { sendAsFloofWebhook } = require('../utils/webhook-util');
        const meowlockPath = path.join(__dirname, '../meowlock.json');
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) {
            try {
                allLocks = JSON.parse(fs.readFileSync(meowlockPath));
            } catch (e) {
                allLocks = {};
            }
        }
        const guildId = message.guild?.id;
        if (!guildId) return message.reply('This command can only be used in a server.');
        const locked = allLocks[guildId] || [];
        if (locked.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No users are currently meowlocked in this server!')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        // Fetch user tags
        const userTags = await Promise.all(
            locked.map(async entry => {
                try {
                    const user = await message.client.users.fetch(entry.id);
                    return `**${user.tag}** (${entry.style})`;
                } catch {
                    return `Unknown User (${entry.id}) (${entry.style})`;
                }
            })
        );
        const embed = new EmbedBuilder()
            .setTitle('Meowlocked Users')
            .setDescription(userTags.join('\n'))
            .setColor(0xB57EDC);
        sendAsFloofWebhook(message, { embeds: [embed] });
    },

    // Example owner command

    speak: async (message, text) => {
        if (!text) return message.reply('Please provide a message for me to speak!');
        await sendAsFloofWebhook(message, { content: text });
        await message.delete();
    },
    avatar: async (message, userArg) => {
        let user = message.mentions.users.first();
        if (!user && userArg) {
            try {
                user = await message.client.users.fetch(userArg);
            } catch (e) {
                return message.reply('Could not find that user by ID.');
            }
        }
        if (!user) user = message.author;
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 4096 });
        // Find or create a webhook for this channel
        let webhook;
        const webhooks = await message.channel.fetchWebhooks();
        webhook = webhooks.find(wh => wh.owner && wh.owner.id === message.client.user.id);
        if (!webhook) {
            webhook = await message.channel.createWebhook({
                name: 'Floof Webhook',
                avatar: message.client.user.displayAvatarURL()
            });
        }
        await webhook.send({
            username: 'Floof',
            avatarURL: message.client.user.displayAvatarURL(),
            embeds: [
                {
                    title: `${user.tag}'s Avatar`,
                    image: { url: avatarURL },
                    color: 0xffb6c1
                }
            ]
        });
        await message.delete();
    },
    meowlock: async (message, args) => {
        const fs = require('fs');
        const path = require('path');
        const meowlockPath = path.join(__dirname, '../meowlock.json');
        
        // Check if we have both user and style
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('Usage: %meowlock <@user|userID> <meow|nya>')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const userArg = args[0];
        const style = args[1].toLowerCase();

        if (!['nya', 'meow'].includes(style)) {
            const embed = new EmbedBuilder()
                .setDescription('Please specify a style: nya or meow. Usage: %meowlock @user meow')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        let user = message.mentions.users.first();
        
        // If no mention, try to fetch by ID
        if (!user && userArg) {
            try {
                user = await message.client.users.fetch(userArg);
            } catch (e) {
                const embed = new EmbedBuilder()
                    .setDescription('Could not find that user by ID.')
                    .setColor(0xB57EDC);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }

        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription('Please mention a user or provide a valid user ID.')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        // Rest of the meowlock logic here
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) {
            try {
                allLocks = JSON.parse(fs.readFileSync(meowlockPath));
            } catch (e) {
                allLocks = {};
            }
        }
        
        const guildId = message.guild?.id;
        if (!guildId) {
            const embed = new EmbedBuilder()
                .setDescription('This command can only be used in a server.')
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        
        if (!allLocks[guildId]) allLocks[guildId] = [];
        let locked = allLocks[guildId];
        
        // Remove existing lock for this user if present
        locked = locked.filter(entry => entry.id !== user.id);
        locked.push({ id: user.id, style });
        allLocks[guildId] = locked;
        
        try {
            fs.writeFileSync(meowlockPath, JSON.stringify(allLocks, null, 2));
            const embed = new EmbedBuilder()
                .setDescription(`✅ ${user.tag} is now meowlocked with style: ${style}!`)
                .setColor(0xB57EDC);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        } catch (err) {
            console.error('[meowlock] Write failed:', err);
            const embed = new EmbedBuilder()
                .setDescription('Failed to save meowlock data: ' + err.message)
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
    },
    meowunlock: async (message, userArg) => {
        const fs = require('fs');
        const path = require('path');
        const meowlockPath = path.join(__dirname, '../meowlock.json');
        let user = message.mentions.users.first();
        if (!user && userArg) {
            try {
                user = await message.client.users.fetch(userArg);
            } catch (e) {
                return message.reply('Could not find that user by ID.');
            }
        }
        if (!user) {
    const embed = new EmbedBuilder()
        .setDescription('Please mention a user or provide a user ID.')
        .setColor(0xB57EDC);
    return sendAsFloofWebhook(message, { embeds: [embed] });
}
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) allLocks = JSON.parse(fs.readFileSync(meowlockPath));
        const guildId = message.guild?.id;
        if (!guildId) return message.reply('This command can only be used in a server.');
        const before = (allLocks[guildId] || []).length;
        if (allLocks[guildId]) {
            allLocks[guildId] = allLocks[guildId].filter(entry => entry.id !== user.id);
        }
        fs.writeFileSync(meowlockPath, JSON.stringify(allLocks, null, 2));
        if ((allLocks[guildId] || []).length < before) {
            const embed = new EmbedBuilder()
    .setDescription(`${user.tag} is no longer meowlocked!`)
    .setColor(0xB57EDC);
sendAsFloofWebhook(message, { embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
    .setDescription(`${user.tag} was not meowlocked.`)
    .setColor(0xB57EDC);
sendAsFloofWebhook(message, { embeds: [embed] });
        }
    },
    revive: async (message) => {
        const OWNER_ID = '1007799027716329484'; // Replace with your actual owner ID if different
        if (message.author.id !== OWNER_ID) {
            return message.reply('Only Floof\'s owner can use this command!');
        }
        // Revive role ID
        const reviveRoleId = '1394483353310330880';
        const questions = [
            'If you could have any superpower, what would it be?',
            'What\'s your favorite comfort food?',
            'Share a random fun fact about yourself!',
            'What song do you have on repeat lately?',
            'If you could visit any place in the world, where would you go?',
            'What\'s your favorite way to relax?',
            'What\'s a hobby you\'ve always wanted to try?',
            'What\'s the last show or movie you watched?',
            'What\'s something that made you smile recently?',
            'What\'s your go-to game to play with friends?'
        ];
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        await message.channel.send({
            content: `<@&${reviveRoleId}> Let's get active! Question: ${randomQuestion}`
        });
        await message.delete();
    },
    meowlockclear: async (message) => {
        const fs = require('fs');
        const path = require('path');
        const meowlockPath = path.join(__dirname, '../meowlock.json');
        let allLocks = {};
        if (fs.existsSync(meowlockPath)) allLocks = JSON.parse(fs.readFileSync(meowlockPath));
        const guildId = message.guild?.id;
        if (!guildId) return message.reply('This command can only be used in a server.');
        if (allLocks[guildId]) {
            delete allLocks[guildId];
            fs.writeFileSync(meowlockPath, JSON.stringify(allLocks, null, 2));
        }
        const embed = new EmbedBuilder()
            .setDescription('All meowlocks in this server have been cleared!')
            .setColor(0xB57EDC);
        sendAsFloofWebhook(message, { embeds: [embed] });
    },
    funMenu: (message) => {
        const embed = new EmbedBuilder()
            .setTitle('🎉 Fun Commands')
            .addFields([
                { name: 'Entertainment', value: '`%joke` `%8ball <question>` `%cat` `%roll [sides]` `%blush`', inline: true },
                { name: 'Social Positive', value: '`%hug [@user]` `%pat [@user]` `%kiss [@user]` `%wave [@user]` `%highfive [@user]` `%cuddle [@user]` `%dance [@user]`', inline: true },
                { name: 'Social Playful', value: '`%slap [@user]` `%bite [@user]` `%poke [@user]` `%shoot [@user]`', inline: true }
            ])
            .setColor(0x7289da);
        sendAsFloofWebhook(message, { embeds: [embed] });
    },
    gamblingMenu: (message) => {
        const embed = new EmbedBuilder()
            .setTitle('🎰 Gambling Commands')
            .addFields([
                { name: 'Economy', value: '`%balance` `%work` `%beg` `%donate <@user> <amount>`', inline: true },
                { name: 'Games', value: '`%coinflip <amount>` `%blackjack <amount>` `%slots <amount>`', inline: true },
                { name: 'Other', value: '`%leaderboard`', inline: true }
            ])
            .setColor(0xffd700);
        sendAsFloofWebhook(message, { embeds: [embed] });
    },
    modMenu: (message) => {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Moderation Commands')
            .addFields([
                { name: 'Actions', value: '`%warn <@user> [reason]` `%timeout <@user> <duration> [reason]`', inline: true },
                { name: 'Punishment', value: '`%kick <@user> [reason]` `%ban <@user> [reason]`', inline: true },
                { name: 'Info', value: '`%whois <@user>`', inline: true }
            ])
            .setColor(0xff6b6b);
        sendAsFloofWebhook(message, { embeds: [embed] });
    },
    ownerMenu: (message) => {
        const embed = new EmbedBuilder()
            .setTitle('👑 Owner Commands')
            .addFields([
                { name: 'Bot Control', value: '`%speak <message>` `%av [@user]` `%revive`', inline: true },
                { name: 'Meowlock', value: '`%meowlock @user [style]` `%meowunlock @user` `%meowlockclear` `%meowlocked`', inline: true }
            ])
            .setColor(0xfadadd);
        sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
