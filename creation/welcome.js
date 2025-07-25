const { EmbedBuilder } = require('discord.js');

// Set your rules and welcome channel IDs here
const RULES_CHANNEL_ID = '1393667672511746099';
const WELCOME_CHANNEL_ID = '1393667671609835642';

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
    // Pick a random message
    const welcomeText = RANDOM_WELCOMES[Math.floor(Math.random() * RANDOM_WELCOMES.length)].replace('{member}', `${member}`);
    const embed = new EmbedBuilder()
        .setTitle('Welcome to Floof\'s Fluffy Den!')
        .setDescription(`Hi ${member}, welcome to the fluffiest place on Discord!\n\nPlease read the <#${RULES_CHANNEL_ID}> to get started and agree to the rules. Once you\'ve agreed, you\'ll get access to the rest of the server!\n\nIf you need help, just ask a mod or mention Floof! ✨🐾`)
        .setColor(0xffb6c1)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
    const welcomeChannelId = '1393667671609835642'; // Channel to ping new users in
    const rulesChannelId = '1393667672511746099'; // Channel where the rules are
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (welcomeChannel && welcomeChannel.isTextBased()) {
        await welcomeChannel.send({
            content: `Welcome <@${member.user.id}>! Please read the rules in <#${rulesChannelId}> to gain access to the server.`
        });
    }

    // Send to the hardcoded welcome channel
    const embedChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (embedChannel && embedChannel.isTextBased()) {
        await embedChannel.send({ content: welcomeText, embeds: [embed] });
    }
}

async function handleMemberLeave(member) {
    // Compose a cute, custom goodbye embed
    const embed = new EmbedBuilder()
        .setTitle('A floof has left the den...')
        .setDescription(`${member.user.tag} has left the server. We\'ll miss you! (｡•́︿•̀｡)\n\nMay your adventures be fluffy and bright!`)
        .setColor(0xadd8e6)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Floof waves a fluffy paw goodbye!' });
    const embedChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
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
    const welcomeChannel = guild.channels.cache.find(
        c => c.name === 'welcome' && c.isTextBased()
    );
    if (welcomeChannel) {
        await welcomeChannel.send({ embeds: [embed] });
    }
}

module.exports = { handleMemberJoin, handleMemberLeave, handleMemberKickBan };


