const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load per-guild configured channels
function getGuildConfig(guildId) {
    try {
        const configPath = path.join(process.cwd(), 'data', 'server-configs.json');
        if (!fs.existsSync(configPath)) return {};
        const all = JSON.parse(fs.readFileSync(configPath, 'utf8') || '{}');
        return all[guildId] || {};
    } catch {
        return {};
    }
}

// List of random welcome messages
const RANDOM_WELCOMES = [
    'Welcome to the den, {member}! 🐾',
    'A wild {member} appeared! Everyone say hi! ✨',
    'Yay! {member} just joined us! 🎉',
    'Fluff up the pillows, {member} is here! 🛏️',
    'So glad you made it, {member}! 💖',
    'Give a warm welcome to {member}! ☀️',
    'The den just got fluffier! Welcome, {member}! 😺',
    'Welcome, {member}! Don’t forget to grab a snack! 🍪',
    'Hi {member}! Hope you brought your fluffiest vibes! 🌸',
    'Everyone, roll out the red carpet for {member}! 🎬'
];

// Custom welcome message handler
async function handleMemberJoin(member) {
    const cfg = getGuildConfig(member.guild.id);
    const rulesChannelId = cfg.rulesChannel;
    const welcomeChannelId = cfg.welcomeChannel;

    // If no welcome channel configured, do nothing (prevent unwanted messages)
    if (!welcomeChannelId) return;

    // Compose welcome text
    const welcomeText = RANDOM_WELCOMES[Math.floor(Math.random() * RANDOM_WELCOMES.length)].replace('{member}', `<@${member.user.id}>`);
    const descParts = [
        `Hi <@${member.user.id}>, welcome to the fluffiest place on Discord!`
    ];
    if (rulesChannelId) {
        descParts.push(`Please read <#${rulesChannelId}> to get started and agree to the rules. Once you agree, you'll get access to the rest of the server!`);
    }
    descParts.push(`If you need help, just ask a mod or mention Floof! ✨🐾`);

    const embed = new EmbedBuilder()
        .setTitle("Welcome to Floof's Fluffy Den!")
        .setDescription(descParts.join('\n\n'))
        .setColor(0xffb6c1)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

    const targetChannel = welcomeChannelId ? member.guild.channels.cache.get(welcomeChannelId) : null;
    if (targetChannel && targetChannel.isTextBased()) {
        await targetChannel.send({ content: welcomeText, embeds: [embed] });
    }
}

async function handleMemberLeave(member) {
    // Check if this was a kick by looking at audit logs
    let wasKicked = false;
    
    try {
        // Fetch recent audit logs for member kicks
        const auditLogs = await member.guild.fetchAuditLogs({
            type: 20, // MEMBER_KICK
            limit: 5
        });
        
        // Check if there's a recent kick for this user (within last 5 seconds)
        const kickLog = auditLogs.entries.find(entry => 
            entry.target.id === member.user.id && 
            Date.now() - entry.createdTimestamp < 5000
        );
        
        if (kickLog) {
            wasKicked = true;
            // Handle as kick with "good riddance" message
            await handleMemberKickBan(member.user, member.guild, 'kicked');
            return;
        }
    } catch (error) {
        console.log('Could not fetch audit logs for kick detection:', error.message);
    }
    
    // If not kicked, treat as voluntary leave with nice goodbye
    const embed = new EmbedBuilder()
        .setTitle('A floof has left the den...')
        .setDescription(`${member.user.tag} has left the server. We\'ll miss you! (｡•́︿•̀｡)\n\nMay your adventures be fluffy and bright!`)
        .setColor(0xadd8e6)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Floof waves a fluffy paw goodbye!' });
    
    const cfg = getGuildConfig(member.guild.id);
    // If no welcome channel configured, do nothing
    if (!cfg.welcomeChannel) return;
    const embedChannel = member.guild.channels.cache.get(cfg.welcomeChannel);
    if (embedChannel && embedChannel.isTextBased()) {
        await embedChannel.send({ embeds: [embed] });
    }
}

async function handleMemberKickBan(user, guild, action = 'banned') {
    // Compose a playful but clear goodbye embed for kicks/bans
    const embed = new EmbedBuilder()
        .setTitle(action === 'banned' ? 'A floof has been banned!' : 'A floof was kicked out!')
        .setDescription(`${user.tag} was ${action} from the den. Good riddance! 🚫\n\nFloof hopes the vibes are fluffier now!`)
        .setColor(0xff6961)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Floof keeps the den safe and cozy!' });
    
    const cfg = getGuildConfig(guild.id);
    // If no welcome channel configured, do nothing
    if (!cfg.welcomeChannel) return;
    const welcomeChannel = guild.channels.cache.get(cfg.welcomeChannel);
    if (welcomeChannel && welcomeChannel.isTextBased()) {
        await welcomeChannel.send({ embeds: [embed] });
    }
}

module.exports = { handleMemberJoin, handleMemberLeave, handleMemberKickBan };


