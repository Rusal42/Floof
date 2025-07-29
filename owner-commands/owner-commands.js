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

    // List all servers the bot is in
    servers: async (message) => {
        const { client } = message;
        const guilds = client.guilds.cache;
        
        // Sort servers by member count (descending)
        const sortedGuilds = guilds.sort((a, b) => b.memberCount - a.memberCount);
        
        // Create a list of server info
        const serverList = sortedGuilds.map(guild => {
            return `**${guild.name}** (${guild.id})\n` +
                   `👥 ${guild.memberCount.toLocaleString()} members | ` +
                   `👑 ${guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown Owner'}\n`;
        });
        
        // Split into chunks of 10 servers per embed
        const chunkSize = 10;
        const chunks = [];
        for (let i = 0; i < serverList.length; i += chunkSize) {
            chunks.push(serverList.slice(i, i + chunkSize));
        }
        
        // Create embeds for each chunk
        const embeds = chunks.map((chunk, index) => {
            return new EmbedBuilder()
                .setTitle(`Servers (${guilds.size} total) - Part ${index + 1}/${chunks.length}`)
                .setDescription(chunk.join('\n'))
                .setColor(0x7289DA)
                .setFooter({ text: `Showing ${chunk.length} servers` });
        });
        
        // Send the first embed
        const reply = await message.channel.send({ embeds: [embeds[0]] });
        
        // If there's only one page, we're done
        if (embeds.length === 1) return;
        
        // Add pagination reactions
        await reply.react('⬅️');
        await reply.react('➡️');
        
        // Pagination logic
        let currentPage = 0;
        const filter = (reaction, user) => {
            return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === message.author.id;
        };
        
        const collector = reply.createReactionCollector({ filter, time: 300000 }); // 5 minutes
        
        collector.on('collect', async (reaction, user) => {
            try {
                await reaction.users.remove(user.id);
                
                if (reaction.emoji.name === '➡️' && currentPage < embeds.length - 1) {
                    currentPage++;
                } else if (reaction.emoji.name === '⬅️' && currentPage > 0) {
                    currentPage--;
                }
                
                await reply.edit({ embeds: [embeds[currentPage]] });
            } catch (error) {
                console.error('Error handling pagination:', error);
            }
        });
        
        collector.on('end', () => {
            reply.reactions.removeAll().catch(console.error);
        });
    },

    // Speak command
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
    funMenu: async (message) => {
        const embed = new EmbedBuilder()
            .setTitle('🎮 Fun Commands')
            .setDescription('Here are all the fun commands you can use! 🎉')
            .addFields(
                { name: '🎲 Games', value: '`%8ball <question>` - Ask the magic 8ball a question\n`%roll [sides]` - Roll a die (default 6 sides)\n`%joke` - Get a random joke' },
                { name: '🎭 Actions', value: '`%hug [@user]` - Give someone a hug\n`%kiss [@user]` - Blow a kiss\n`%pat [@user]` - Pat someone\n`%slap [@user]` - Slap someone' },
                { name: '💃 Social', value: '`%dance [@user]` - Show off your moves\n`%highfive [@user]` - High five someone\n`%wave [@user]` - Wave hello' },
                { name: '🐾 Animals', value: '`%cat` - Get a random cat picture\n`%dog` - Get a random dog picture\n`%fox` - Get a random fox picture' },
                { name: '😊 Reactions', value: '`%blush` - Show your embarrassment\n`%poke [@user]` - Poke someone\n`%shoot [@user]` - Pew pew!' }
            )
            .setColor(0x9B59B6)
            .setFooter({ text: 'Floof Bot Commands', iconURL: message.client.user.displayAvatarURL() })
            .setTimestamp();
        
        await sendAsFloofWebhook(message, { embeds: [embed] });
    },
    
    gamblingMenu: async (message) => {
        const embed = new EmbedBuilder()
            .setTitle('🎰 Gambling Commands')
            .setDescription('Try your luck with these gambling commands! 🎲')
            .addFields(
                { name: '💰 Balance', value: '`%balance` - Check your current balance\n`%work` - Earn some coins\n`%beg` - Try begging for coins\n`%donate <@user> <amount>` - Share your wealth' },
                { name: '🎲 Games', value: '`%slots <bet>` - Play slots\n`%roulette <bet> <red/black/number>` - Play roulette\n`%blackjack <bet>` - Play blackjack\n`%coinflip <bet> <heads/tails>` - Flip a coin' },
                { name: '🏆 Leaderboard', value: '`%leaderboard` - See who has the most coins\n`%richest` - Top 10 richest users' },
                { name: '🎮 Game Help', value: '`%blackjack help` - Blackjack rules\n`%slots help` - Slots information\n`%roulette help` - Roulette rules' }
            )
            .setColor(0xE91E63)
            .setFooter({ text: 'Gambling is for entertainment only!', iconURL: message.client.user.displayAvatarURL() })
            .setTimestamp();
            
        await sendAsFloofWebhook(message, { embeds: [embed] });
    },
    
    modMenu: async (message) => {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Moderation Commands')
            .setDescription('Keep your server safe with these moderation tools! 🔒')
            .addFields(
                { name: '🔨 Punishments', value: '`%warn <@user> [reason]` - Warn a user\n`%kick <@user> [reason]` - Kick a user\n`%ban <@user> [reason]` - Ban a user\n`%timeout <@user> <time> [reason]` - Timeout a user' },
                { name: '👥 User Management', value: '`%whois <@user>` - Get detailed user information\n`%av [@user]` - View user avatar' },
                { name: '🧹 Cleanup', value: '`%purge <amount>` - Delete messages\n`%clear <amount>` - Clear messages\n`%slowmode <time>` - Set slowmode' },
                { name: '⚙️ Settings', value: '`%modlog <#channel>` - Set mod log channel\n`%automod` - Configure auto-moderation\n`%antispam` - Toggle anti-spam' }
            )
            .setColor(0x3498DB)
            .setFooter({ text: 'Requires moderation permissions', iconURL: message.client.user.displayAvatarURL() })
            .setTimestamp();
            
        await sendAsFloofWebhook(message, { embeds: [embed] });
    },
    
    ownerMenu: async (message) => {
        const embed = new EmbedBuilder()
            .setTitle('👑 Owner Commands')
            .setDescription('Server owner exclusive commands! ⚙️')
            .addFields(
                { 
                    name: '⚙️ Server Management', 
                    value: '`%leaveservers` - Leave servers where owner is not a member\n`%meowlock <@user> <style>` - Meowlock a user\n`%meowunlock <@user>` - Remove meowlock\n`%meowlockclear` - Clear all meowlocks' 
                },
                { 
                    name: '⚠️ Dangerous', 
                    value: '`%nukeall` - Nuke the server (use with caution)'
                },
                { 
                    name: '📊 Stats', 
                    value: '`%meowlocked` - List meowlocked users\n`%servers` - List all servers' 
                }
            )
            .setColor(0xF1C40F)
            .setFooter({ 
                text: `Requested by ${message.author.tag}`, 
                iconURL: message.author.displayAvatarURL() 
            })
            .setTimestamp();
            
        await sendAsFloofWebhook(message, { 
            embeds: [embed]
        });
    }
};
