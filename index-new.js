require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('./utils/webhook-util');
const CommandHandler = require('./handlers/CommandHandler');

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

// Handle role menu and other interactions
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

// Welcome system
const { handleMemberJoin, handleMemberLeave, handleMemberKickBan } = require('./creation/welcome');
client.on('guildMemberAdd', async (member) => {
    await handleMemberJoin(member);
});
client.on('guildMemberRemove', async (member) => {
    await handleMemberLeave(member);
});
client.on('guildBanAdd', async (ban) => {
    await handleMemberKickBan(ban.user, ban.guild, 'banned');
});

// Message handling
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
            message.attachments.some(att => att.url && att.url.toLowerCase().endsWith('.gif')) ||
            message.embeds.some(embed => (embed.url && embed.url.toLowerCase().endsWith('.gif')) || (embed.image && embed.image.url && embed.image.url.toLowerCase().endsWith('.gif'))) ||
            /https?:\/\/\S+\.gif(\?|$)/i.test(message.content)
        );
        
        if (hasGif) {
            await message.delete();
            const gifBlockMessages = [
                "There's no getting around this! No GIFs while meowlocked!",
                "Nice try, but no GIFs for you! Meowlock is in effect! 🔒",
                "GIFs are blocked while you're meowlocked! Sorry not sorry! 😸"
            ];
            const randomMessage = gifBlockMessages[Math.floor(Math.random() * gifBlockMessages.length)];
            await sendAsFloofWebhook(message, { content: randomMessage });
            return;
        }
        
        // Apply meowlock transformations
        let content = message.content;
        if (meowEntry.style === 'uwu') {
            // UwU transformation logic (simplified)
            content = content.replace(/r/gi, 'w').replace(/l/gi, 'w');
            content = content.replace(/n([aeiou])/gi, 'ny$1');
            content += ' uwu';
        } else if (meowEntry.style === 'meow') {
            // Meow transformation logic (simplified)
            const kawaii = ['uwu', 'owo', 'rawr', 'nyaa~', '>:3', 'x3', '(*^ω^*)', 'ฅ^•ﻌ•^ฅ', 'nya~', 'meow~', 'purr~'];
            content += ` ${kawaii[Math.floor(Math.random() * kawaii.length)]}`;
        }
        
        if (content !== message.content) {
            await message.delete();
            await sendAsFloofWebhook(message, { content: content });
            return;
        }
    }
    // --- End Meowlock Intercept ---
    
    // AFK System
    const { setAfk, showAfk, afkStore } = require('./commands/afk/afk');
    
    // Auto-clear AFK if author is AFK
    if (afkStore && afkStore[message.author.id]) {
        delete afkStore[message.author.id];
        await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Welcome back!')
                    .setDescription('Your AFK status has been removed.')
                    .setColor(0x7289da)
            ]
        });
    }
    
    // If a mentioned user is AFK, show their AFK status
    if (message.mentions && message.mentions.users && message.mentions.users.size > 0) {
        for (const [, user] of message.mentions.users) {
            if (afkStore && afkStore[user.id]) {
                await showAfk(message, user);
                break; // Only show for the first AFK user mentioned
            }
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
    
    // Handle owner commands
    if (message.author.id === OWNER_ID) {
        const { speak, ownerMenu, revive } = require('./owner-commands/owner-commands');
        
        if (commandName === 'floofy') {
            ownerMenu(message);
            return;
        }
        
        if (commandName === 'speak') {
            speak(message, args);
            return;
        }
        
        if (commandName === 'revive') {
            revive(message);
            return;
        }
    }
    
    // Try to handle command with new command handler
    const handled = await commandHandler.handleCommand(message);
    
    // If command wasn't handled by new system, fall back to legacy handlers for now
    if (!handled) {
        // Legacy command handling can go here temporarily
        // This allows for gradual migration
    }
});

// Deleted message tracking (for snipe command)
let lastDeletedMessage = null;

client.on('messageDelete', (message) => {
    if (message.author && !message.author.bot && message.content) {
        lastDeletedMessage = {
            content: message.content,
            author: message.author,
            channel: message.channel,
            timestamp: new Date()
        };
    }
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
