const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    getUserCrimeData,
    attemptNPCBail,
    NPC_FRIENDS
} = require('./utils/crime-manager');

// Bail cooldowns
const bailCooldowns = {};

module.exports = {
    name: 'bail',
    description: 'Pay bail to get out of jail early, or get help from friends',
    usage: '%bail [self/friend/npc] [@user] | %b [self/friend/npc] [@user]',
    category: 'gambling',
    aliases: ['jailbreak', 'freedom', 'release', 'b', 'free'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining, getArresterInfo, releaseUser } = require('./beatup');
        if (!isArrested(userId)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You are not currently arrested!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Check if user allows friend bail
        const { userAllows } = require('./utils/user-preferences');
        if (!userAllows(userId, 'auto_bail_friends')) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You have disabled friend bail requests in your preferences!\n\nEnable with: `%preferences enable auto_bail_friends`')
                        .setColor(0xff0000)
                ]
            });
        }

        if (!message.mentions.users.first()) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please mention a user to request bail from!\nExample: `%bail friend @user`')
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 5 * 1000; // 5 seconds
        
        if (bailCooldowns[userId] && now < bailCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((bailCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Wait **${timeLeft}** more seconds before trying again.`)
                        .setColor(0xffa500)
                ]
            });
        }

        const arrestInfo = getArresterInfo(userId);
        if (!arrestInfo) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Error retrieving arrest information!')
                        .setColor(0xff0000)
                ]
            });
        }

        if (args.length === 0) {
            return await displayBailOptions(message, userId, arrestInfo);
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'pay':
            case 'self':
                return await handleSelfBail(message, userId, arrestInfo);
            case 'friends':
            case 'npc':
                return await handleNPCBail(message, userId, arrestInfo);
            case 'help':
            case 'friend':
                return await handleFriendBail(message, userId, args.slice(1), arrestInfo);
            default:
                return await displayBailOptions(message, userId, arrestInfo);
        }
    }
};

async function displayBailOptions(message, userId, arrestInfo) {
    const remainingTime = Math.ceil(getArrestTimeRemaining(userId) / 60);
    const crimeData = getUserCrimeData(userId);
    
    let description = '**🚔 You are under arrest!**\n\n';
    description += `⏰ **Time Remaining:** ${remainingTime} minutes\n`;
    description += `💸 **Bail Amount:** ${arrestInfo.bailAmount.toLocaleString()} coins\n`;
    description += `🚨 **Arrested For:** ${arrestInfo.reason || 'Criminal Activity'}\n\n`;
    
    description += '**💰 Bail Options:**\n';
    description += `💳 **Pay Yourself:** \`%bail pay\`\n`;
    description += `👥 **Ask NPC Friends:** \`%bail friends\`\n`;
    description += `🤝 **Friend Help:** \`%bail help @friend\`\n\n`;
    
    // Show NPC friends who might help
    if (crimeData.npc_friendships && Object.keys(crimeData.npc_friendships).length > 0) {
        description += '**👥 Your NPC Friends:**\n';
        Object.entries(crimeData.npc_friendships).forEach(([friendId, friendship]) => {
            const friend = NPC_FRIENDS[friendId];
            if (friend) {
                const canHelp = friendship.level >= friend.friendship_required && arrestInfo.bailAmount <= friend.max_bail;
                const helpIcon = canHelp ? '✅' : '❌';
                description += `${friend.emoji} **${friend.name}** (Lv.${friendship.level}) ${helpIcon}\n`;
            }
        });
        description += '\n';
    }
    
    description += '⏰ **Or wait it out and serve your time...**';

    const embed = new EmbedBuilder()
        .setTitle('🚔 Arrest Information')
        .setDescription(description)
        .setColor(0xff6b6b)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleSelfBail(message, userId, arrestInfo) {
    const userBalance = getBalance(userId);
    
    if (userBalance < arrestInfo.bailAmount) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds for bail!\n\n💸 **Bail Cost:** ${arrestInfo.bailAmount.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins\n\nTry asking friends for help or wait it out!`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Set cooldown
    bailCooldowns[userId] = Date.now();

    // Pay bail and release
    subtractBalance(userId, arrestInfo.bailAmount);
    const { releaseUser } = require('./beatup');
    releaseUser(userId);

    const embed = new EmbedBuilder()
        .setTitle('💰 Bail Paid!')
        .setDescription(`You paid **${arrestInfo.bailAmount.toLocaleString()} coins** bail and are now free!\n\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n*You walk out of the police station, a little poorer but wiser...*`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleNPCBail(message, userId, arrestInfo) {
    // Set cooldown
    bailCooldowns[userId] = Date.now();

    const result = attemptNPCBail(userId, arrestInfo.bailAmount);
    
    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ None of your NPC friends can help right now!\n\n💔 Either they don\'t have enough money, aren\'t close enough friends, or they\'re not willing to help.\n\nTry building stronger friendships or ask a real friend for help!')
                    .setColor(0xff0000)
            ]
        });
    }

    // NPC friend bailed you out
    const { releaseUser } = require('./beatup');
    releaseUser(userId);

    const embed = new EmbedBuilder()
        .setTitle('👥 NPC Friend Bail!')
        .setDescription(`${result.friend.emoji} **${result.friend.name}** bailed you out!\n\n💰 They paid **${arrestInfo.bailAmount.toLocaleString()} coins** for your release!\n👥 **Friendship Level:** ${result.friendship_level}\n\n*"Don't worry about it, we're friends!" - ${result.friend.name}*\n\n✨ Your friendship has grown stronger!`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleFriendBail(message, userId, args, arrestInfo) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please mention a friend to ask for help!\nExample: `%bail help @friend`')
                    .setColor(0xff0000)
            ]
        });
    }

    // Get target user
    let friendUser;
    if (message.mentions.users.size > 0) {
        friendUser = message.mentions.users.first();
    } else {
        try {
            friendUser = await message.client.users.fetch(args[0]);
        } catch (error) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ User not found! Please mention a valid user.')
                        .setColor(0xff0000)
                ]
            });
        }
    }

    // Can't bail yourself
    if (friendUser.id === userId) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You cannot bail yourself out this way! Use `%bail pay` instead.')
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if friend can afford bail
    const friendBalance = getBalance(friendUser.id);
    if (friendBalance < arrestInfo.bailAmount) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ <@${friendUser.id}> doesn't have enough coins to bail you out!\n\n💸 **Bail Cost:** ${arrestInfo.bailAmount.toLocaleString()} coins\n💳 **Their Balance:** ${friendBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Send bail request to friend
    const embed = new EmbedBuilder()
        .setTitle('🚔 Bail Request!')
        .setDescription(`<@${friendUser.id}>, your friend <@${userId}> is asking you to bail them out of jail!\n\n💸 **Bail Cost:** ${arrestInfo.bailAmount.toLocaleString()} coins\n💳 **Your Balance:** ${friendBalance.toLocaleString()} coins\n🚨 **Arrested For:** ${arrestInfo.reason || 'Criminal Activity'}\n\nReact with ✅ to pay their bail or ❌ to decline.\n\n*Will you help your friend in their time of need?*`)
        .setColor(0xffa500)
        .setTimestamp();

    const bailMessage = await sendAsFloofWebhook(message, { embeds: [embed] });
    
    // Add reactions for the friend to respond
    if (bailMessage) {
        try {
            await bailMessage.react('✅');
            await bailMessage.react('❌');
            
            // Create reaction collector
            const filter = (reaction, user) => {
                return ['✅', '❌'].includes(reaction.emoji.name) && user.id === friendUser.id;
            };
            
            const collector = bailMessage.createReactionCollector({ filter, time: 60000, max: 1 });
            
            collector.on('collect', async (reaction) => {
                if (reaction.emoji.name === '✅') {
                    // Friend agreed to pay bail
                    const currentFriendBalance = getBalance(friendUser.id);
                    
                    if (currentFriendBalance < arrestInfo.bailAmount) {
                        return await sendAsFloofWebhook(message, {
                            embeds: [
                                new EmbedBuilder()
                                    .setDescription(`❌ <@${friendUser.id}> no longer has enough coins to pay bail!`)
                                    .setColor(0xff0000)
                            ]
                        });
                    }
                    
                    // Process bail payment
                    subtractBalance(friendUser.id, arrestInfo.bailAmount);
                    const { releaseUser } = require('./beatup');
                    releaseUser(userId);
                    
                    const successEmbed = new EmbedBuilder()
                        .setTitle('🤝 Friend Bail Successful!')
                        .setDescription(`<@${friendUser.id}> paid **${arrestInfo.bailAmount.toLocaleString()} coins** to bail out <@${userId}>!\n\n💳 **<@${friendUser.id}>'s New Balance:** ${getBalance(friendUser.id).toLocaleString()} coins\n\n*True friendship in action! <@${userId}> owes you big time.*`)
                        .setColor(0x00ff00)
                        .setTimestamp();
                    
                    await sendAsFloofWebhook(message, { embeds: [successEmbed] });
                } else {
                    // Friend declined
                    const declineEmbed = new EmbedBuilder()
                        .setDescription(`💔 <@${friendUser.id}> declined to pay your bail.\n\n*Looks like you'll have to find another way out...*`)
                        .setColor(0xff6b6b);
                    
                    await sendAsFloofWebhook(message, { embeds: [declineEmbed] });
                }
            });
            
            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    sendAsFloofWebhook(message, {
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`⏰ <@${friendUser.id}> didn't respond to the bail request in time.`)
                                .setColor(0x95a5a6)
                        ]
                    });
                }
            });
            
        } catch (error) {
            console.error('Error adding reactions to bail message:', error);
        }
    }
}
