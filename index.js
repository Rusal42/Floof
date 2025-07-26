require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('./utils/webhook-util');
const CommandHandler = require('./handlers/CommandHandler');
const ownerCommands = require('./owner-commands/owner-commands');

// Set your Discord user ID here
const OWNER_ID = process.env.OWNER_ID || '1007799027716329484';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers // Needed for welcome system
    ]
});

// Initialize command handler
const commandHandler = new CommandHandler(client);

client.once('ready', () => {
    console.log(`🟢 Floof is online as ${client.user.tag}!`);
    console.log(`📋 Loaded ${commandHandler.commands.size} commands`);
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

// Import auto moderation
const { handleAutoModeration } = require('./moderation/automod');

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Run auto moderation first
    await handleAutoModeration(message);
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
    
    // Check if message starts with command prefix
    if (!message.content.startsWith('%')) return;
    
    // Handle AFK command specially (since it has complex logic)
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    if (commandName === 'afk') {
        if (message.mentions.users.size > 0) {
            // Show AFK for mentioned user
            const user = message.mentions.users.first();
            showAfk(message, user);
        } else {
            // Set AFK for self
            setAfk(message, args.join(' '));
        }
        return;
    }
    
    // Legacy snipe commands (moderation commands now handled by CommandHandler)
    
    // TODO: Re-implement snipe commands as proper command files
    // if (commandName === 's') {
    //     await showSnipe(message);
    //     return;
    // }
    // if (commandName === 'sclear') {
    //     await clearSnipe(message);
    //     return;
    // }
    
    // Try to handle command with new command handler
    const handled = await commandHandler.handleCommand(message);
    
    // If not handled by command handler, check for owner commands
    if (!handled && message.author.id === OWNER_ID) {
        if (commandName === 'speak') {
            const text = args.join(' ');
            await ownerCommands.speak(message, text);
            return;
        }
        if (commandName === 'floof') {
            await ownerCommands.funMenu(message);
            return;
        }
        if (commandName === 'floofmod') {
            await ownerCommands.modMenu(message);
            return;
        }
        if (commandName === 'floofgambling') {
            await ownerCommands.gamblingMenu(message);
            return;
        }
        if (commandName === 'floofy') {
            await ownerCommands.ownerMenu(message);
            return;
        }
        if (commandName === 'av' || commandName === 'avatar') {
            const userArg = args[0];
            await ownerCommands.avatar(message, userArg);
            return;
        }
        if (commandName === 'meowlock') {
            const userArg = args[0];
            const style = args[1] || 'nya';
            await ownerCommands.meowlock(message, userArg, style);
            return;
        }
        if (commandName === 'meowunlock') {
            const userArg = args[0];
            await ownerCommands.meowunlock(message, userArg);
            return;
        }
        if (commandName === 'meowlockclear') {
            await ownerCommands.meowlockclear(message);
            return;
        }
        if (commandName === 'meowlocked') {
            await ownerCommands.meowlocked(message);
            return;
        }
        if (commandName === 'revive') {
            await ownerCommands.revive(message);
            return;
        }
    }
    
    // If command wasn't handled by new system, it might be a legacy command
    // or an unknown command - no need to do anything else
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