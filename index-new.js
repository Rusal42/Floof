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

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Check if message starts with command prefix
    if (!message.content.startsWith('%')) return;
    
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
