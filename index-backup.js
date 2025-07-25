require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { sendAsFloofWebhook } = require('./utils/webhook-util');

// Set your Discord user ID here
const OWNER_ID = '1007799027716329484';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences // Needed for presenceUpdate
    ]
});

client.once('ready', () => {
    console.log(`🟢 Floof is online as ${client.user.tag}!`);
});

// Handle button interactions for blackjack
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Handle blackjack button interactions
    if (interaction.customId === 'blackjack_hit' || interaction.customId === 'blackjack_stand') {
        const { handleBlackjackInteraction } = require('./commands/gambling/blackjack-handler');
        await handleBlackjackInteraction(interaction);
    }
});

// Auto-leave any server not owned by OWNER_ID
client.on('guildCreate', async (guild) => {
    try {
        if (guild.ownerId !== OWNER_ID) {
            await guild.leave();
            console.log(`Left guild ${guild.name} (${guild.id}) because it is not owned by the bot owner.`);
        } else {
            console.log(`Joined approved guild: ${guild.name} (${guild.id})`);
        }
    } catch (error) {
        console.error('Error processing guildCreate:', error);
    }
});


const { handleRoleMenuInteraction } = require('./creation/role-menu');
const { handleRulesMenuInteraction } = require('./creation/rules-menu');
const { handleColorMenuInteraction } = require('./creation/setup-color-roles');
client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu()) {
        // Handle color select menu first, then role menu
        await handleColorMenuInteraction(interaction);
        await handleRoleMenuInteraction(interaction);
    }
    if (interaction.isButton()) {
        await handleRulesMenuInteraction(interaction);
    }
});

const { handleMemberJoin, handleMemberLeave, handleMemberKickBan } = require('./creation/welcome');
client.on('guildMemberAdd', async (member) => {
    await handleMemberJoin(member);
});
client.on('guildMemberRemove', async (member) => {
    await handleMemberLeave(member);
    // Optionally: Detect kicks here in the future
});
client.on('guildBanAdd', async (ban) => {
    await handleMemberKickBan(ban.user, ban.guild, 'banned');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    // --- Meowlock Intercept ---
    const fs = require('fs');
    const path = require('path');
    const meowlockPath = path.join(__dirname, 'meowlock.json');
    const guildId = message.guild?.id;
    if (!guildId) return; // Only run in guilds
    let allLocks = {};
    if (fs.existsSync(meowlockPath)) allLocks = JSON.parse(fs.readFileSync(meowlockPath));
    const locked = Array.isArray(allLocks[guildId]) ? allLocks[guildId] : [];
    const meowEntry = locked.find(entry => entry.id === message.author.id);
    if (meowEntry) {
        // Block GIFs for meowlocked users
        const hasGif = (
            // Attachments: check for .gif extension
            message.attachments.some(att => att.url && att.url.toLowerCase().endsWith('.gif')) ||
            // Embeds: check for GIF URLs in embeds
            message.embeds.some(embed => (embed.url && embed.url.toLowerCase().endsWith('.gif')) || (embed.image && embed.image.url && embed.image.url.toLowerCase().endsWith('.gif'))) ||
            // Direct links in message content
            /https?:\/\/\S+\.gif(\?|$)/i.test(message.content)
        );
        if (hasGif) {
            await message.delete();
            const { sendAsFloofWebhook } = require('./utils/webhook-util');
            const gifBlockMessages = [
                "There's no getting around this! No GIFs while meowlocked!",
                "Nya~! Even GIFs can't escape the meowlock.",
                "Floof says: GIFs are forbidden for the meowlocked!",
                "No GIFs for you! The meowlock is absolute.",
                "Meowlocked users can't use GIFs, sorry!",
                "You can't outsmart the meowlock. No GIFs!"
            ];
            const blockMsg = gifBlockMessages[Math.floor(Math.random() * gifBlockMessages.length)];
            await sendAsFloofWebhook(message, { content: blockMsg });
            return;
        }
        // Catify message
        let catMsg = message.content;
        if (meowEntry.style === 'nya') {
            // Enhanced stutter words and kawaii interjections
            // Super intense meowlock
            const kawaii = ['uwu', 'owo', 'rawr', 'nyaa~', '>:3', 'x3', '(*^ω^*)', 'ฅ^•ﻌ•^ฅ', 'nya~', 'meow~', 'purr~'];
            // Strongly mess up the first word
            let wordsArr = catMsg.split(' ');
            if (wordsArr[0].length > 2) {
                // Always stutter and prepend kawaii interjection
                const kawaiiWord = kawaii[Math.floor(Math.random() * kawaii.length)];
                wordsArr[0] = kawaiiWord + ' ' + wordsArr[0][0] + '-' + wordsArr[0];
            }
            // Randomly stutter most other words
            for (let i = 1; i < wordsArr.length; i++) {
                if (wordsArr[i].length > 2 && Math.random() < 0.7) {
                    wordsArr[i] = wordsArr[i][0] + '-' + wordsArr[i];
                }
            }
            catMsg = wordsArr.join(' ');
            // Replace common words
            catMsg = catMsg.replace(/\b(is|are|am|was|were|the|my|your|you|i)\b/gi, 'nya');
            // Insert kawaii interjections randomly
            let words = catMsg.split(' ');
            for (let i = 1; i < words.length; i++) {
                if (Math.random() < 0.3) {
                    words.splice(i, 0, kawaii[Math.floor(Math.random() * kawaii.length)]);
                    i++;
                }
            }
            catMsg = words.join(' ');
            // Random ending
            const nyaEndings = [
                'nya~ uwu', 'nyaa! >w<', 'uwu~', '(*^ω^*) nya!', 'nyaa owo', 'nya~ :3', 'nyaa~', 'nyan~', 'nya! uwu', 'nyaaa~', 'nya~ ฅ^•ﻌ•^ฅ', 'nya! x3', 'nyaa! (*≧ω≦)', 'nya~ purr~', 'nya owo', 'nya~ uwu owo'
            ];
            catMsg = catMsg + ' ' + nyaEndings[Math.floor(Math.random() * nyaEndings.length)];
        } else if (meowEntry.style === 'meow') {
            // Enhanced meow stutter and interjections
            // Super intense meowlock
            const kawaii = ['uwu', 'owo', 'rawr', 'nyaa~', '>:3', 'x3', '(*^ω^*)', 'ฅ^•ﻌ•^ฅ', 'nya~', 'meow~', 'purr~'];
            // Strongly mess up the first word
            let wordsArr = catMsg.split(' ');
            if (wordsArr[0].length > 2) {
                // Always stutter and prepend kawaii interjection
                const kawaiiWord = kawaii[Math.floor(Math.random() * kawaii.length)];
                wordsArr[0] = kawaiiWord + ' ' + wordsArr[0][0] + '-meow' + wordsArr[0];
            }
            // Randomly stutter most other words
            for (let i = 1; i < wordsArr.length; i++) {
                if (wordsArr[i].length > 2 && Math.random() < 0.7) {
                    wordsArr[i] = wordsArr[i][0] + '-meow' + wordsArr[i];
                }
            }
            catMsg = wordsArr.join(' ');
            // Replace common words
            catMsg = catMsg.replace(/\b(is|are|am|was|were|the|my|your|you|i)\b/gi, 'meow');
            // Insert kawaii interjections randomly
            let words = catMsg.split(' ');
            for (let i = 1; i < words.length; i++) {
                if (Math.random() < 0.3) {
                    words.splice(i, 0, kawaii[Math.floor(Math.random() * kawaii.length)]);
                    i++;
                }
            }
            catMsg = words.join(' ');
            // Random ending
            const meowEndings = [
                'meow~', 'purr~', 'meow owo', 'rawr x3', 'meow! :3', 'meow uwu', 'meow! >w<', 'meow~ :3', 'meow! x3', 'meow~ uwu', 'meow! ฅ^•ﻌ•^ฅ', 'meow~ purr~', 'meow owo', 'meow~ uwu owo', 'meow nyan~'
            ];
            catMsg = 'Meow! ' + catMsg + ' ' + meowEndings[Math.floor(Math.random() * meowEndings.length)];
        }
        // Send via webhook
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
            username: message.member ? message.member.displayName : message.author.username,
            avatarURL: message.author.displayAvatarURL({ dynamic: true, size: 4096 }),
            content: catMsg
        });
        await message.delete();
        return;
    }
    // --- End Meowlock Intercept ---
    const { setAfk, showAfk, afkStore } = require('./commands/afk/afk');
    // 1. Auto-clear AFK if author is AFK
    if (afkStore && afkStore[message.author.id]) {
        console.log('DEBUG AFK CLEARED:', { user: message.author.id, afkStore });
        delete afkStore[message.author.id];
        await sendAsFloofWebhook(message, {
            embeds: [
                new (require('discord.js').EmbedBuilder)()
                    .setTitle('Welcome back!')
                    .setDescription('Your AFK status has been removed.')
                    .setColor(0x7289da)
            ]
        });
    }

    const content = message.content.trim();
    const lower = content.toLowerCase();

    // Only AFK command: %afk [reason]
    if (lower.startsWith('%afk')) {
        const reason = content.slice(4).trim();
        await setAfk(message, reason);
        return;
    }

    // If a mentioned user is AFK, show their AFK status
    if (message.mentions && message.mentions.users && message.mentions.users.size > 0) {
        for (const [, user] of message.mentions.users) {
            if (afkStore && afkStore[user.id]) {
                await showAfk(message, user);
                // Only show for the first AFK user mentioned
                break;
            }
        }
    }
    const args = content.split(/\s+/);

    // 2. %afk command logic
    if (args[0].toLowerCase() === '%afk') {
        if (message.mentions.users.size > 0) {
            // Show AFK for mentioned user
            const user = message.mentions.users.first();
            showAfk(message, user);
        } else {
            // Set AFK for self
            setAfk(message, args.slice(1).join(' '));
        }
        return;
    }

    // 3. Notify if pinging or replying to an AFK user (embed style, no duplicates)
    const afkUsersToNotify = new Set();
    // Mentions
    if (message.mentions.users.size > 0) {
        for (const [, user] of message.mentions.users) {
            afkUsersToNotify.add(user.id);
        }
    }
    // Reply check
    if (message.reference && message.reference.messageId) {
        try {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMsg && repliedMsg.author && !afkUsersToNotify.has(repliedMsg.author.id)) {
                afkUsersToNotify.add(repliedMsg.author.id);
            }
        } catch (e) { /* ignore */ }
    }
    if (afkUsersToNotify.size > 0) {
        
        for (const userId of afkUsersToNotify) {
            const user = await message.client.users.fetch(userId).catch(() => null);
            if (user) showAfk(message, user);
        }
    }
    const { timeout, warn, viewInfractions, clearInfractions, showSnipe, clearSnipe } = require('./commands/moderation-commands');

    if (lower === '%s') {
        await showSnipe(message);
        return;
    }
    if (lower === '%sclear') {
        await clearSnipe(message);
        return;
    }
    if (lower === '%floof' || lower === '%floof') {
        const { funMenu } = require('./commands/fun-commands');
        funMenu(message);
        return;
    }
    // Owner-only commands
    if (message.author.id === OWNER_ID) {
        const { speak, ownerMenu, revive } = require('./owner-commands/owner-commands');
        if (args[0].toLowerCase() === '%floofy') {
            ownerMenu(message);
            return;
        }
        if (args[0].toLowerCase() === '%revive') {
            await revive(message);
            return;
        }
        if (args[0].toLowerCase() === '%fluffysetup') {
            const { fluffySetup } = require('./creation/fluffy-setup');
            fluffySetup(message);
            return;
        }
        if (args[0].toLowerCase() === '%makerolemenu') {
            const { makeRoleMenu } = require('./creation/role-menu');
            makeRoleMenu(message, args);
            return;
        }
        if (args[0].toLowerCase() === '%colormenu') {
            const { colormenu } = require('./creation/setup-color-roles');
            colormenu(message);
            return;
        }
        if (args[0].toLowerCase() === '%makerulesmenu') {
            const { makeRulesMenu } = require('./creation/rules-menu');
            makeRulesMenu(message, args);
            return;
        }
        if (args[0].toLowerCase() === '%fluffysnap') {
            const { fluffySnap } = require('./creation/fluffy-snap');
            fluffySnap(message);
            return;
        }

        if (args[0].toLowerCase() === '%speak') {
            const text = args.slice(1).join(' ');
            speak(message, text);
            return;
        }
        if (args[0].toLowerCase() === '%nukeall') {
            const { execute: nukeall } = require('./owner-commands/nukeall');
            nukeall(message);
            return;
        }
        if (args[0].toLowerCase() === '%av') {
            const { avatar } = require('./owner-commands/owner-commands');
            // Try mention, then user ID, then fallback
            let userArg = undefined;
            if (message.mentions.users.first()) {
                userArg = message.mentions.users.first().id;
            } else if (args[1]) {
                userArg = args[1];
            }
            avatar(message, userArg);
            return;
        }
        if (args[0].toLowerCase() === '%release') {
            const { release } = require('./commands/gambling/owner-gambling');
            // Try mention, then user ID
            let userArg = undefined;
            if (message.mentions.users.first()) {
                userArg = message.mentions.users.first().id;
            } else if (args[1]) {
                userArg = args[1];
            }
            release(message, userArg);
            return;
        }
        if (args[0].toLowerCase() === '%meowlock') {
            const { meowlock } = require('./owner-commands/owner-commands');
            let userArg, style;
            if (message.mentions.users.first()) {
                userArg = message.mentions.users.first().id;
                style = args[2] ? args[2].toLowerCase() : undefined;
            } else {
                userArg = args[1];
                style = args[2] ? args[2].toLowerCase() : undefined;
            }
            meowlock(message, userArg, style);
            return;
        }
        if (args[0].toLowerCase() === '%meowunlock') {
            const { meowunlock } = require('./owner-commands/owner-commands');
            let userArg;
            if (message.mentions.users.first()) {
                userArg = message.mentions.users.first().id;
            } else {
                userArg = args[1];
            }
            meowunlock(message, userArg);
            return;
        }
        if (args[0].toLowerCase() === '%meowlockclear') {
            const { meowlockclear } = require('./owner-commands/owner-commands');
            meowlockclear(message);
            return;
        }
        if (args[0].toLowerCase() === '%meowlocked') {
            const { meowlocked } = require('./owner-commands/owner-commands');
            meowlocked(message);
            return;
        }
        // Add more owner-only commands here
    }
    // %joke
    if (args[0].toLowerCase() === '%joke') {
        const { joke } = require('./commands/fun-commands');
        joke(message);
        return;
    }
    // %floofgambling
    if (args[0].toLowerCase() === '%floofgambling') {
        const { gamblingMenu } = require('./commands/gambling/gambling-menu');
        gamblingMenu(message);
        return;
    }
    // %ownergamble <amount>
    if (args[0].toLowerCase() === '%ownergamble') {
        const { ownerGamble } = require('./commands/gambling/owner-gambling');
        const amount = args[1];
        ownerGamble(message, amount);
        return;
    }
    // %donate <@user> <amount>
    if (args[0].toLowerCase() === '%donate') {
        const { donate } = require('./commands/gambling/gambling');
        const targetUser = message.mentions.users.first();
        const amount = args[2];
        donate(message, targetUser, amount);
        return;
    }
    // %coinflip <heads|tails> <amount>
    if (args[0].toLowerCase() === '%coinflip') {
        const { coinflip } = require('./commands/gambling/gambling');
        const side = args[1];
        const amount = args[2];
        coinflip(message, side, amount);
        return;
    }
    // %beg
    if (args[0].toLowerCase() === '%beg') {
        const { beg } = require('./commands/gambling/gambling');
        beg(message);
        return;
    }
    // %work
    if (args[0].toLowerCase() === '%work') {
        const { work } = require('./commands/gambling/gambling');
        work(message);
        return;
    }
    // %blackjack <amount>
    if (args[0].toLowerCase() === '%blackjack') {
        const { blackjack } = require('./commands/gambling/blackjack');
        const amount = args[1];
        blackjack(message, amount);
        return;
    }
    // %slots <amount>
    if (args[0].toLowerCase() === '%slots') {
        const { slots } = require('./commands/gambling/slots');
        const amount = args[1];
        slots(message, amount);
        return;
    }
    // %leaderboard
    if (args[0].toLowerCase() === '%leaderboard') {
        const { leaderboard } = require('./commands/gambling/leaderboard');
        leaderboard(message);
        return;
    }
    // %beatup <@user>
    if (args[0].toLowerCase() === '%beatup') {
        const { beatup } = require('./commands/gambling/beatup');
        const targetUser = message.mentions.users.first();
        beatup(message, targetUser);
        return;
    }
    // %balance
    if (args[0].toLowerCase() === '%balance' || args[0].toLowerCase() === '%bal') {
        const { balance } = require('./commands/gambling/gambling');
        // If a user is mentioned, use their ID; else, use the second argument (could be a user ID); else undefined
        let userArg = undefined;
        if (message.mentions.users.first()) {
            userArg = message.mentions.users.first().id;
        } else if (args[1]) {
            userArg = args[1];
        }
        balance(message, userArg);
        return;
    }
    // %give <amount> [@user]
    if (args[0].toLowerCase() === '%give') {
        const { give } = require('./commands/gambling/owner-gambling');
        const amount = args[1];
        // Try to get the first mentioned user's ID, or undefined
        const userMention = message.mentions.users.first() ? message.mentions.users.first().id : undefined;
        give(message, amount, userMention);
        return;
    }
    // %8ball <question>
    if (args[0].toLowerCase() === '%8ball') {
        const { eightBall } = require('./commands/fun-commands');
        const question = args.slice(1).join(' ');
        eightBall(message, question);
        return;
    }
    // %cat
    if (args[0].toLowerCase() === '%cat') {
        const { cat } = require('./commands/fun-commands');
        cat(message);
        return;
    }
    // %hug
    if (args[0].toLowerCase() === '%hug') {
        const { hug } = require('./commands/fun-commands');
        hug(message);
        return;
    }
    // %pat
    if (args[0].toLowerCase() === '%pat') {
        const { pat } = require('./commands/fun-commands');
        pat(message);
        return;
    }
    // %slap
    if (args[0].toLowerCase() === '%setupfunroles') {
        const { setupFunRoles } = require('./creation/setup-fun-roles');
        await setupFunRoles(message);
        return;
    }
    if (args[0].toLowerCase() === '%slap') {
        const { slap } = require('./commands/fun-commands');
        slap(message);
        return;
    }
    // %kiss
    if (args[0].toLowerCase() === '%kiss') {
        const { kiss } = require('./commands/fun-commands');
        kiss(message);
        return;
    }
    // %poke
    if (args[0].toLowerCase() === '%poke') {
        const { poke } = require('./commands/fun-commands');
        poke(message);
        return;
    }
    // %cuddle
    if (args[0].toLowerCase() === '%cuddle') {
        const { cuddle } = require('./commands/fun-commands');
        cuddle(message);
        return;
    }
    // %highfive
    if (args[0].toLowerCase() === '%highfive') {
        const { highfive } = require('./commands/fun-commands');
        highfive(message);
        return;
    }
    // %bite
    if (args[0].toLowerCase() === '%bite') {
        const { bite } = require('./commands/fun-commands');
        bite(message);
        return;
    }
    // %blush
    if (args[0].toLowerCase() === '%blush') {
        const { blush } = require('./commands/fun-commands');
        blush(message);
        return;
    }
    // %wave
    if (args[0].toLowerCase() === '%wave') {
        const { wave } = require('./commands/fun-commands');
        wave(message);
        return;
    }
    // %dance
    if (args[0].toLowerCase() === '%dance') {
        const { dance } = require('./commands/fun-commands');
        dance(message);
        return;
    }
    // %shoot
    if (args[0].toLowerCase() === '%shoot') {
        const { shoot } = require('./commands/fun-commands');
        shoot(message);
        return;
    }
    // %roll
    if (args[0].toLowerCase() === '%roll') {
        const { roll } = require('./commands/fun-commands');
        roll(message);
        return;
    }

    if (lower === '%floofadmin') {
        const { floofAdminMenu } = require('./commands/moderation-commands');
        floofAdminMenu(message);
        return;
    }
    if (lower === '%floofmod') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            message.reply('You need the Timeout Members permission to use this command.');
            return;
        }
        const { modMenu } = require('./commands/moderation-commands');
        modMenu(message);
        return;
    }
    if (lower === '%floof') {
        const { funMenu } = require('./commands/fun-commands');
        funMenu(message);
        return;
    }
    if (lower === '%floof') {
        const { funMenu } = require('./commands/fun-commands');
        funMenu(message);
        return;
    }
    if (lower === '%ping') {
        await message.reply('Pong! 🏓');
        return;
    }

    // %timeout @user|userID duration(s) [reason]
    if (args[0].toLowerCase() === '%timeout') {
        let user = message.mentions.members.first();
        let durationArgIdx = 2;
        if (!user && args[1]) {
            // Try to fetch by user ID
            try {
                user = await message.guild.members.fetch(args[1]);
                durationArgIdx = 2;
            } catch (e) {
                return message.reply('Could not find a user with that mention or ID. Usage: %timeout @user|userID 60 [reason]');
            }
        }
        if (!user) {
            const { EmbedBuilder } = require('discord.js');
const embed = new EmbedBuilder()
    .setDescription('Please mention a user or provide a user ID. Usage: %timeout @user|userID 60 [reason]')
    .setColor(0x7289da);
return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        const duration = parseInt(args[durationArgIdx], 10);
        const reason = args.slice(durationArgIdx + 1).join(' ') || undefined;
        if (!duration || isNaN(duration)) {
            return message.reply('Please provide a valid duration in seconds. Usage: %timeout @user|userID 60 [reason]');
        }
        timeout(message, user, duration * 1000, reason);
        return;
    }
    // %warn @user|userID [reason]
    if (args[0].toLowerCase() === '%warn') {
        let user = message.mentions.members.first();
        let reasonArgIdx = 2;
        if (!user && args[1]) {
            try {
                user = await message.guild.members.fetch(args[1]);
                reasonArgIdx = 2;
            } catch (e) {
                return message.reply('Could not find a user with that mention or ID. Usage: %warn @user|userID [reason]');
            }
        }
        if (!user) {
            const { EmbedBuilder } = require('discord.js');
const embed = new EmbedBuilder()
    .setDescription('Please mention a user or provide a user ID. Usage: %warn @user|userID [reason]')
    .setColor(0x7289da);
return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        const reason = args.slice(reasonArgIdx).join(' ') || undefined;
        warn(message, user, reason);
        return;
    }
    // %infractions @user or userID
    if (args[0].toLowerCase() === '%infractions') {
        let user = message.mentions.members.first();
        if (!user && args[1]) {
            try {
                user = await message.guild.members.fetch(args[1]);
            } catch (e) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setDescription('Could not find a user with that mention or ID. Usage: %infractions @user|userID')
                    .setColor(0x7289da);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }
        if (!user) {
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setDescription('Please mention a user or provide a user ID. Usage: %infractions @user|userID')
                .setColor(0x7289da);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        viewInfractions(message, user);
        return;
    }
    // %clearinfractions @user or userID
    if (args[0].toLowerCase() === '%clearinfractions') {
        let user = message.mentions.members.first();
        if (!user && args[1]) {
            try {
                user = await message.guild.members.fetch(args[1]);
            } catch (e) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setDescription('Could not find a user with that mention or ID. Usage: %clearinfractions @user|userID')
                    .setColor(0x7289da);
                return sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }
        if (!user) {
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setDescription('Please mention a user or provide a user ID. Usage: %clearinfractions @user|userID')
                .setColor(0x7289da);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }
        clearInfractions(message, user);
        return;
    }
    // %userid @user
    if (args[0].toLowerCase() === '%userid' && message.mentions.members.first()) {
        if (!message.member.permissions.has('Administrator')) {
            message.reply('You need to be an admin to use this command.');
            return;
        }
        const user = message.mentions.members.first();
        const { userid } = require('./commands/moderation-commands');
        userid(message, user);
        return;
    }
    
    // %kick @user|userID [reason]
    if (args[0].toLowerCase() === '%kick') {
        const { floofKick, floofKickId } = require('./commands/moderation-commands');
        // Check if it's a mention or user ID
        if (message.mentions.members.first()) {
            floofKick(message, args);
        } else {
            floofKickId(message, args);
        }
        return;
    }
    
    // %ban @user|userID [reason]
    if (args[0].toLowerCase() === '%ban') {
        const { floofBan, floofBanId } = require('./commands/moderation-commands');
        // Check if it's a mention or user ID
        if (message.mentions.members.first()) {
            floofBan(message, args);
        } else {
            floofBanId(message, args);
        }
        return;
    }
    
    // %unban userID
    if (args[0].toLowerCase() === '%unban') {
        const { floofUnban } = require('./commands/moderation-commands');
        floofUnban(message, args);
        return;
    }
});

// In-memory storage for the most recently deleted message
let lastDeletedMessage = null;

client.on('messageDelete', (message) => {
    // Only store if the message is not from a bot and has content
    if (!message.author || message.author.bot) return;
    lastDeletedMessage = {
        content: message.content,
        authorTag: message.author.tag,
        authorId: message.author.id,
        channelId: message.channel.id,
        deletedAt: new Date(),
        attachments: message.attachments.map(att => att.url)
    };
});

function getLastDeletedMessage() {
    return lastDeletedMessage;
}

function clearLastDeletedMessage() {
    lastDeletedMessage = null;
}

module.exports.getLastDeletedMessage = getLastDeletedMessage;
module.exports.clearLastDeletedMessage = clearLastDeletedMessage;

client.login(process.env.DISCORD_BOT_TOKEN);