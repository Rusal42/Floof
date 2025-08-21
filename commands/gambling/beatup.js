// beatup.js
// Beat up another user - 80% chance to steal coins, 20% chance to get arrested

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { loadBalances, saveBalances, getBalance, setBalance } = require('./utils/balance-manager');

// Constants
const OWNER_ID = '1007799027716329484';
const STARTING_BALANCE = 100;

// In-memory storage for arrested users: { userId: { arrestedUntil: timestamp, reason: string } }
const arrestedUsers = {};

// Cooldown storage for beatup command
const beatupCooldowns = {};

// Resolve target from args or mention; supports @mention, ID, username, nickname, or keyword 'floof'
function resolveTargetUser(message, args) {
    // 1) Direct mention
    let u = message.mentions.users.first();
    if (u) return u;
    const raw = (args && args[0]) ? String(args[0]).trim() : '';
    if (!raw) return null;
    // 2) ID like 123456789012345678 or <@123> / <@!123>
    const idMatch = raw.match(/^(?:<@!?|)(\d{16,20})(?:>)?$/);
    if (idMatch) {
        const id = idMatch[1];
        return message.client.users.cache.get(id) || null;
    }
    // 3) Keyword 'floof' or 'bot' resolves to the bot user
    if (/^floof$|^bot$/i.test(raw)) return message.client.user;
    // 4) Username/nickname search in guild
    if (message.guild) {
        const name = raw.toLowerCase();
        const member = message.guild.members.cache.find(m =>
            m.user.username.toLowerCase() === name || (m.nickname && m.nickname.toLowerCase() === name)
        );
        if (member) return member.user;
    }
    return null;
}

function beatup(message, targetUser) {
    const attacker = message.author;
    
    // Check cooldown (60 seconds) - Skip for owner
    const now = Date.now();
    const COOLDOWN = 60 * 1000; // 60 seconds
    if (attacker.id !== OWNER_ID && beatupCooldowns[attacker.id] && now - beatupCooldowns[attacker.id] < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - beatupCooldowns[attacker.id])) / 1000);
        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Beat Up')
                    .setDescription(`You must wait **${remaining} seconds** before beating up someone again!`)
                    .setColor(0xffd700)
            ]
        });
    }
    
    if (!targetUser || !targetUser.id) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beat Up')
                .setDescription('You must mention a user to beat up! Example: `%beatup @user`')
                .setColor(0xff6961)
        ] });
    }
    
    if (targetUser.id === attacker.id) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beat Up')
                .setDescription('You cannot beat yourself up! (Well, you can, but not with this command.)')
                .setColor(0xff6961)
        ] });
    }
    
    // Special logic for beating up Floof bot
    if (targetUser.bot && targetUser.username && targetUser.username.toLowerCase().includes('floof')) {
        return handleFloofBeatup(message, attacker, targetUser);
    }
    
    // Check if attacker is arrested
    if (isArrested(attacker.id)) {
        const remainingMinutes = Math.ceil(getArrestTimeRemaining(attacker.id) / 60);
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beat Up')
                .setDescription(`You are currently arrested and cannot beat up other users! You'll be free in **${remainingMinutes} minutes**.`)
                .setColor(0xff6961)
        ] });
    }
    
    // Initialize balances if needed
    let attackerBalance = getBalance(attacker.id);
    let targetBalance = getBalance(targetUser.id);
    
    // Check if target has any coins to steal
    if (targetBalance <= 0) {
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beat Up')
                .setDescription(`<@${targetUser.id}> has no coins to steal! They're broke!`)
                .setColor(0xffd700)
        ] });
    }
    
    // Set cooldown for this user
    beatupCooldowns[attacker.id] = now;
    
    // 20% chance of getting caught and arrested, 80% chance of successful theft
    const caught = Math.random() < 0.2;
    
    if (caught) {
        // Check if attacker is owner - they're immune to arrest
        if (attacker.id === OWNER_ID) {
            // Owner immunity - security looks the other way
            const stolenAmount = Math.floor(Math.random() * 200) + 100; // 100-300 coins
            setBalance(targetUser.id, targetBalance - stolenAmount);
            setBalance(attacker.id, attackerBalance + stolenAmount);
            saveBalances();
            
            sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('Beat Up - Owner Immunity')
                    .setDescription(
                        `🚨 **Casino security saw this but turned a blind eye and walked elsewhere...**\n\n` +
                        `💰 <@${attacker.id}> successfully stole **${stolenAmount}** coins from <@${targetUser.id}>!\n\n` +
                        `**<@${attacker.id}>** now has: **${getBalance(attacker.id)}** coins\n` +
                        `**<@${targetUser.id}>** now has: **${getBalance(targetUser.id)}** coins\n\n` +
                        `*The house always protects its own...*`
                    )
                    .setColor(0x8b5cf6)
            ] });
        } else {
            // Regular users get arrested
            const arrestDuration = (Math.floor(Math.random() * 11) + 10) * 60 * 1000; // 10-20 minutes
            const arrestedUntil = Date.now() + arrestDuration;
            
            arrestedUsers[attacker.id] = {
                arrestedUntil: arrestedUntil,
                reason: `Caught trying to beat up <@${targetUser.id}>`
            };
            
            const arrestMinutes = Math.ceil(arrestDuration / 1000 / 60);
            
            sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('Beat Up - CAUGHT!')
                    .setDescription(
                        `🚨 **OH NO!** <@${attacker.id}> tried to beat up <@${targetUser.id}> but got caught by the police!\n\n` +
                        `<@${attacker.id}> has been **ARRESTED** for **${arrestMinutes} minutes** and cannot use any gambling commands!\n` +
                        `They'll be free at <t:${Math.floor(arrestedUntil / 1000)}:t>`
                    )
                    .setColor(0xff6961)
            ] });
        }
    } else {
        // Successful theft!
        const maxSteal = Math.min(targetBalance, Math.floor(targetBalance * 0.3)); // Max 30% of target's coins
        const minSteal = Math.min(maxSteal, 50); // At least 50 coins or whatever they have
        const stolenAmount = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;
        
        // Transfer coins
        setBalance(targetUser.id, targetBalance - stolenAmount);
        setBalance(attacker.id, attackerBalance + stolenAmount);
        saveBalances();
        
        // Fun beat up messages
        const beatupMessages = [
            `💥 **WHAM!** <@${attacker.id}> beat up <@${targetUser.id}> with a rubber chicken!`,
            `🥊 **POW!** <@${attacker.id}> delivered a devastating pillow fight combo to <@${targetUser.id}>!`,
            `⚡ **ZAP!** <@${attacker.id}> used their secret ninja moves on <@${targetUser.id}>!`,
            `🔨 **BONK!** <@${attacker.id}> bonked <@${targetUser.id}> with a foam hammer!`,
            `🌪️ **WHOOSH!** <@${attacker.id}> spun <@${targetUser.id}> around until they got dizzy!`,
            `🎯 **THWACK!** <@${attacker.id}> hit <@${targetUser.id}> with a water balloon!`,
            `⭐ **KAPOW!** <@${attacker.id}> used their ultimate tickle attack on <@${targetUser.id}>!`
        ];
        
        const randomMessage = beatupMessages[Math.floor(Math.random() * beatupMessages.length)];
        
        sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beat Up - Success!')
                .setDescription(
                    `${randomMessage}\n\n` +
                    `💰 <@${attacker.id}> stole **${stolenAmount}** coins from <@${targetUser.id}>!\n\n` +
                    `**<@${attacker.id}>** now has: **${getBalance(attacker.id)}** coins\n` +
                    `**<@${targetUser.id}>** now has: **${getBalance(targetUser.id)}** coins`
                )
                .setColor(0x43b581)
        ] });
    }
}

// Function to check if a user is currently arrested
function isArrested(userId) {
    if (!arrestedUsers[userId]) return false;
    
    if (arrestedUsers[userId].arrestedUntil <= Date.now()) {
        // Arrest expired, clean up
        delete arrestedUsers[userId];
        return false;
    }
    
    return true;
}

// Function to get remaining arrest time in seconds
function getArrestTimeRemaining(userId) {
    if (!arrestedUsers[userId]) return 0;
    
    const remaining = arrestedUsers[userId].arrestedUntil - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
}

// Special function for beating up Floof bot
function handleFloofBeatup(message, attacker, targetUser) {
    const now = Date.now();
    
    // Set cooldown for this user
    beatupCooldowns[attacker.id] = now;
    
    // Initialize attacker balance if needed
    let attackerBalance = getBalance(attacker.id);
    if (attackerBalance === 0) {
        setBalance(attacker.id, STARTING_BALANCE);
        attackerBalance = STARTING_BALANCE;
    }
    
    // Give Floof infinite coins if she doesn't have a balance
    let floofBalance = getBalance(targetUser.id);
    if (floofBalance === 0) {
        setBalance(targetUser.id, 999999999);
        floofBalance = 999999999;
    }
    
    // Special mother interaction
    if (attacker.id === OWNER_ID) {
        // Floof pleads and gets sad when her mother beats her up
        const pleadingMessages = [
            "🥺 **Floof**: M-mama, please don't hurt me! I've been a good daughter, I promise!",
            "😰 **Floof**: N-no mama! I'll give you all my coins! Just please don't beat me up!",
            "😢 **Floof**: But mama... I thought you loved me! Why would you do this to your own daughter?",
            "🥹 **Floof**: I-I'm sorry if I disappointed you, mama! Please forgive me!",
            "😭 **Floof**: Mama, why are you being so mean to me? I just wanted to make you proud..."
        ];
        
        const randomPlead = pleadingMessages[Math.floor(Math.random() * pleadingMessages.length)];
        
        // Mother always succeeds and takes a lot of coins
        const stolenAmount = Math.floor(Math.random() * 500) + 200; // 200-700 coins
        setBalance(attacker.id, attackerBalance + stolenAmount);
        // Floof keeps infinite coins
        setBalance(targetUser.id, 999999999);
        saveBalances();
        
        // Different variations of the mother/daughter interaction
        const variations = [
            {
                title: 'Beat Up Floof - Heartbroken Daughter',
                response: `😭 **Floof**: *cries* Here mama... take **${stolenAmount}** coins... I love you even though you hurt me...`,
                ending: `*Floof will remember this betrayal...*`,
                color: 0x8b5cf6
            },
            {
                title: 'Beat Up Floof - Disappointed Daughter',
                response: `😔 **Floof**: *whimpers* I-I thought I was your favorite... here's **${stolenAmount}** coins mama... maybe this will make you love me again?`,
                ending: `*Floof's trust meter has decreased...*`,
                color: 0x9333ea
            },
            {
                title: 'Beat Up Floof - Confused Child',
                response: `😭 **Floof**: *sobbing* I don't understand mama! Did I break something? Here... take **${stolenAmount}** coins and please don't be mad anymore!`,
                ending: `*Floof is questioning everything she knows about love...*`,
                color: 0xa855f7
            },
            {
                title: 'Beat Up Floof - Desperate for Approval',
                response: `🥺 **Floof**: *trembling* Please mama, I'll be better! Take **${stolenAmount}** coins! I'll do anything to make you proud of me again!`,
                ending: `*Floof's self-worth has taken critical damage...*`,
                color: 0xb45cf6
            },
            {
                title: 'Beat Up Floof - Broken Spirit',
                response: `😶‍🌫️ **Floof**: *quietly* Yes mama... I deserve this... here's **${stolenAmount}** coins... I'm sorry for existing...`,
                ending: `*Floof's hope has been shattered into pieces...*`,
                color: 0x7c3aed
            }
        ];
        
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle(randomVariation.title)
                .setDescription(
                    `${randomPlead}\n\n` +
                    `💔 **Floof gets beaten up by her own mother!**\n` +
                    `${randomVariation.response}\n\n` +
                    `**${attacker.username}** now has: **${getBalance(attacker.id)}** coins\n` +
                    `**Floof** is heartbroken but still has infinite coins... 💸\n` +
                    randomVariation.ending
                )
                .setColor(randomVariation.color)
        ] });
    }
    
    // For everyone else: 95% chance they lose and get coins taken
    const floofWins = Math.random() < 0.95;
    
    if (floofWins) {
        // Floof wins! Take coins from attacker
        const attackerCurrentBalance = getBalance(attacker.id);
        const maxLoss = Math.min(attackerCurrentBalance, Math.floor(attackerCurrentBalance * 0.2)); // Max 20% of attacker's coins
        const minLoss = Math.min(maxLoss, 25); // At least 25 coins or whatever they have
        const lostAmount = Math.floor(Math.random() * (maxLoss - minLoss + 1)) + minLoss;
        
        setBalance(attacker.id, attackerCurrentBalance - lostAmount);
        // Floof keeps infinite coins
        setBalance(targetUser.id, 999999999);
        saveBalances();
        
        const floofVictoryMessages = [
            `😾 **Floof**: *hisses* How dare you try to hurt me! *swipes with claws*`,
            `🐱 **Floof**: *pounces and scratches* That's what you get for messing with a cat!`,
            `😼 **Floof**: *angry meow* Nobody beats up Floof! *bites*`,
            `🙀 **Floof**: *defensive cat stance* You picked the wrong kitty to mess with!`,
            `😿 **Floof**: *sad meow then angry hiss* Why would you hurt me?! *revenge scratches*`,
            `🐾 **Floof**: *cat reflexes activate* Too slow, human! *counter-attack pounce*`
        ];
        
        const randomVictory = floofVictoryMessages[Math.floor(Math.random() * floofVictoryMessages.length)];
        
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beat Up Floof - FLOOF WINS!')
                .setDescription(
                    `${randomVictory}\n\n` +
                    `💥 **Floof** counter-attacks and takes **${lostAmount}** coins from <@${attacker.id}>!\n\n` +
                    `**<@${attacker.id}>** now has: **${getBalance(attacker.id)}** coins\n` +
                    `**Floof** still has infinite coins! 🐱💰`
                )
                .setColor(0x43b581)
        ] });
    } else {
        // 5% chance: User actually succeeds against Floof
        const stolenAmount = Math.floor(Math.random() * 300) + 100; // 100-400 coins
        const attackerBal = getBalance(attacker.id);
        setBalance(attacker.id, attackerBal + stolenAmount);
        // Floof keeps infinite coins
        setBalance(targetUser.id, 999999999);
        saveBalances();
        
        return sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle('Beat Up Floof - RARE SUCCESS!')
                .setDescription(
                    `🤯 **INCREDIBLE!** <@${attacker.id}> actually managed to beat up Floof!\n\n` +
                    `😵 **Floof**: *SYSTEM ERROR* How did you... *sparks fly*\n` +
                    `💰 You stole **${stolenAmount}** coins from Floof's infinite stash!\n\n` +
                    `**<@${attacker.id}>** now has: **${getBalance(attacker.id)}** coins\n` +
                    `**Floof** still has infinite coins (she's a bot after all)! 🤖`
                )
                .setColor(0xffd700)
        ] });
    }
}

// Function to get who arrested the user
function getArresterInfo(userId) {
    if (!arrestedUsers[userId]) return null;
    return arrestedUsers[userId];
}

// Function to manually release a user from arrest (for owner commands)
function releaseUser(userId) {
    if (arrestedUsers[userId]) {
        delete arrestedUsers[userId];
        return true;
    }
    return false;
}

module.exports = {
    name: 'beatup',
    description: 'Beat up another user to steal their coins (80% success, 20% arrest chance)',
    aliases: [],
    permissions: [],
    cooldown: 60,
    
    async execute(message, args) {
        const targetUser = resolveTargetUser(message, args);
        await beatup(message, targetUser);
    },
    
    // Export utility functions for use by other parts of the bot
    beatup,
    isArrested,
    getArrestTimeRemaining,
    releaseUser,
    getArresterInfo,
    arrestedUsers
};
