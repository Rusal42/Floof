// beatup.js
// Beat up another user - 80% chance to steal coins, 20% chance to get arrested

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { loadBalances, saveBalances, getBalance, setBalance } = require('./utils/balance-manager');
const { getActivePet, isUserAFK, updateUserActivity, simulatePetDefense, PET_TYPES } = require('./utils/pet-manager');
const { getSelectedWeapon } = require('./select');
const { getInventory, getItemInfo, hasItem, removeItem } = require('./utils/inventory-manager');
const { getCrimeData } = require('./utils/crime-manager');

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

async function beatup(message, targetUser) {
    const attacker = message.author;
    
    // Update user activity
    updateUserActivity(attacker.id);
    
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
                .setTitle('💀 Street Murder')
                .setDescription('You need a target to kill! Example: `%beatup @user`\n\n🔫 **Tip:** Use `%select weapon` to choose a weapon for more damage and money!\n⚠️ **Warning:** This is violent crime with serious consequences!')
                .setColor(0x8b0000)
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
    
    // Check if target is AFK and has a defending pet
    const targetIsAFK = isUserAFK(targetUser.id);
    const targetPet = getActivePet(targetUser.id);
    let petDefenseResult = null;

    if (targetIsAFK && targetPet) {
        // Pet attempts to defend owner
        const mockAttackerStats = {
            stats: { attack: 20, speed: 15, defense: 10, health: 100 },
            hunger: 80,
            happiness: 80
        };
        petDefenseResult = simulatePetDefense(mockAttackerStats, targetPet);
        
        if (petDefenseResult.defended) {
            // Pet successfully defended - beatup fails
            const targetPetInfo = PET_TYPES[targetPet.type];
            return sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🛡️ Pet Defense Successful!')
                        .setDescription(`👊 You tried to beat up **${targetUser.username}**!\n\n🛡️ **${targetPet.name}** (Lv.${targetPet.level}) successfully defended their AFK owner!\n\n${targetPetInfo.emoji} **${targetPet.name}** blocks your attack and growls menacingly!\n\n💥 **Attack Blocked:** ${petDefenseResult.damage_blocked} damage\n🎯 **Defense Success:** ${petDefenseResult.defense_chance}%\n\n❌ No coins were stolen due to pet protection!`)
                        .setColor(0x43b581)
                        .setTimestamp()
                ]
            });
        }
    }

    // Check if target has bodyguard protection
    const targetCrimeData = getCrimeData(targetUser.id);
    const targetBodyguards = targetCrimeData.bodyguards || {};
    let bodyguardProtection = 0;
    let personalBodyguards = [];

    Object.entries(targetBodyguards).forEach(([type, data]) => {
        if (data.assignment === 'personal' || !data.assignment) {
            const protection = getBodyguardProtection(type);
            if (protection) {
                bodyguardProtection += protection.attack_reduction * data.count;
                personalBodyguards.push({ type, count: data.count, ...protection });
            }
        }
    });

    // Cap protection at 80%
    bodyguardProtection = Math.min(bodyguardProtection, 0.80);

    if (bodyguardProtection > 0 && Math.random() < bodyguardProtection) {
        // Bodyguards successfully protected the target
        const totalBodyguards = personalBodyguards.reduce((sum, bg) => sum + bg.count, 0);
        const protectionPercent = Math.floor(bodyguardProtection * 100);
        
        const bodyguardList = personalBodyguards.map(bg => 
            `${bg.emoji} **${bg.name}** x${bg.count}`
        ).join('\n');

        return sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('🛡️ Bodyguard Protection Activated!')
                    .setDescription(`👊 You tried to beat up **${targetUser.username}**!\n\n🛡️ **${totalBodyguards} Bodyguards** immediately intervened!\n\n${bodyguardList}\n\n💥 **Protection Level:** ${protectionPercent}%\n🚫 **Attack Blocked:** Your assault was neutralized by professional security!\n\n❌ No coins were stolen - the bodyguards earned their pay today!`)
                    .setColor(0x2c2c2c)
                    .setTimestamp()
            ]
        });
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
            
            const arrestStories = [
                `🚨 **POLICE BUST!** <@${attacker.id}> tried to mug <@${targetUser.id}> but undercover cops were watching!`,
                `🚁 **SWAT RAID!** <@${attacker.id}> got caught on security cameras during the robbery and tactical units swarmed the area!`,
                `📱 **911 CALL!** A witness called the police while <@${attacker.id}> was assaulting <@${targetUser.id}>!`,
                `🚔 **PATROL RESPONSE!** <@${attacker.id}> picked the wrong victim - they were an off-duty cop!`,
                `📹 **SURVEILLANCE!** <@${attacker.id}> didn't notice the street cameras recording their violent crime!`
            ];
            
            const arrestStory = arrestStories[Math.floor(Math.random() * arrestStories.length)];
            
            sendAsFloofWebhook(message, { embeds: [
                new EmbedBuilder()
                    .setTitle('🚨 CRIMINAL ARRESTED!')
                    .setDescription(
                        `${arrestStory}\n\n` +
                        `🔒 **CHARGES:** Assault, Armed Robbery, Battery\n` +
                        `⏰ **SENTENCE:** ${arrestMinutes} minutes in county jail\n` +
                        `📅 **RELEASE:** <t:${Math.floor(arrestedUntil / 1000)}:t>\n\n` +
                        `*Crime doesn't pay...*`
                    )
                    .setColor(0xff0000)
            ] });
        }
    } else {
        // Successful theft!
        let maxSteal = Math.min(targetBalance, Math.floor(targetBalance * 0.3)); // Max 30% of target's coins
        const minSteal = Math.min(maxSteal, 50); // At least 50 coins or whatever they have
        
        // Reduce steal amount if pet attempted defense but failed
        if (petDefenseResult && !petDefenseResult.defended) {
            maxSteal = Math.floor(maxSteal * 0.6); // 40% reduction for failed pet defense
        }
        
        // Reduce steal amount based on bodyguard protection (even if they didn't fully block)
        if (bodyguardProtection > 0) {
            const damageReduction = 1 - bodyguardProtection;
            maxSteal = Math.floor(maxSteal * damageReduction);
        }
        
        const stolenAmount = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;
        
        // Transfer coins
        setBalance(targetUser.id, targetBalance - stolenAmount);
        setBalance(attacker.id, attackerBalance + stolenAmount);
        saveBalances();
        
        // Check if attacker has a weapon selected
        const selectedWeapon = getSelectedWeapon(attacker.id);
        let weaponInfo = null;
        let usedAmmo = false;
        
        if (selectedWeapon) {
            weaponInfo = getItemInfo(selectedWeapon);
            // Check if user has ammo for the weapon
            if (weaponInfo && weaponInfo.ammo_type && hasItem(attacker.id, weaponInfo.ammo_type)) {
                // Use 1 ammo
                removeItem(attacker.id, weaponInfo.ammo_type, 1);
                usedAmmo = true;
                // Increase damage and steal amount for weapon use
                maxSteal = Math.floor(maxSteal * 1.5); // 50% more money stolen with weapons
            }
        }
        
        let combatMessages;
        
        if (selectedWeapon && weaponInfo && usedAmmo) {
            // Armed robbery with specific weapon
            const weaponMessages = {
                'pistol': [
                    `🔫 **BANG! BANG!** <@${attacker.id}> pulled out a ${weaponInfo.name} and put two in <@${targetUser.id}>'s chest! Blood splatters as they collapse, **${stolenAmount} coins** spilling from their pockets!`,
                    `🔫 **EXECUTION STYLE!** <@${attacker.id}> pressed the ${weaponInfo.name} to <@${targetUser.id}>'s head and pulled the trigger! Brain matter paints the wall as **${stolenAmount} coins** scatter across the floor!`,
                    `🔫 **DRIVE-BY SHOOTING!** <@${attacker.id}> rolled up and emptied the ${weaponInfo.name} clip into <@${targetUser.id}>'s car! They bled out while <@${attacker.id}> grabbed **${stolenAmount} coins** from the wreckage!`
                ],
                'rifle': [
                    `🔫 **SNIPER SHOT!** <@${attacker.id}> took out <@${targetUser.id}> from 200 yards with a ${weaponInfo.name}! Their head exploded like a watermelon as **${stolenAmount} coins** flew everywhere!`,
                    `🔫 **ASSAULT RIFLE SPRAY!** <@${attacker.id}> opened up with the ${weaponInfo.name} on full auto! <@${targetUser.id}> was shredded by bullets as **${stolenAmount} coins** mixed with their blood!`,
                    `🔫 **HUNTING ACCIDENT!** <@${attacker.id}> 'accidentally' shot <@${targetUser.id}> with a ${weaponInfo.name} while 'hunting'! They looted **${stolenAmount} coins** from the 'accident' scene!`
                ],
                'crossbow': [
                    `🏹 **MEDIEVAL EXECUTION!** <@${attacker.id}> put a crossbow bolt through <@${targetUser.id}>'s skull! The arrow pinned them to a tree as **${stolenAmount} coins** fell from their dying hands!`,
                    `🏹 **SILENT KILL!** <@${attacker.id}> stalked <@${targetUser.id}> and put a bolt through their spine! They couldn't scream as <@${attacker.id}> took **${stolenAmount} coins** from their paralyzed body!`
                ],
                'flamethrower': [
                    `🔥 **BURNED ALIVE!** <@${attacker.id}> torched <@${targetUser.id}> with a ${weaponInfo.name}! They screamed as their flesh melted, dropping **${stolenAmount} coins** before turning to ash!`,
                    `🔥 **HUMAN TORCH!** <@${attacker.id}> set <@${targetUser.id}> on fire and watched them run around screaming! The coins (**${stolenAmount}**) were the only thing left unburned!`
                ],
                'laser': [
                    `⚡ **VAPORIZED!** <@${attacker.id}> disintegrated <@${targetUser.id}> with a ${weaponInfo.name}! Nothing remained but a pile of ash and **${stolenAmount} coins**!`,
                    `⚡ **LASER SURGERY!** <@${attacker.id}> cut <@${targetUser.id}> in half with the ${weaponInfo.name}! Their top half slid off as **${stolenAmount} coins** spilled from their pockets!`
                ],
                'speaker': [
                    `🔊 **SONIC BOOM!** <@${attacker.id}> blasted <@${targetUser.id}> with sound waves until their eardrums burst and brain hemorrhaged! **${stolenAmount} coins** fell from their convulsing hands!`,
                    `🔊 **FREQUENCY KILL!** <@${attacker.id}> found <@${targetUser.id}>'s resonant frequency and shattered their bones! They died screaming as **${stolenAmount} coins** scattered!`
                ]
            };
            
            combatMessages = weaponMessages[selectedWeapon] || [
                `💀 **WEAPON KILL!** <@${attacker.id}> used their ${weaponInfo.name} to brutally murder <@${targetUser.id}> and stole **${stolenAmount} coins** from their corpse!`
            ];
        } else {
            // Unarmed combat - hand-to-hand violence
            combatMessages = [
                `👊 **BRUTAL BEATDOWN!** <@${attacker.id}> beat <@${targetUser.id}> to death with their bare hands! Blood and teeth scattered as **${stolenAmount} coins** fell from their broken body!`,
                `🔪 **KNIFE FIGHT!** <@${attacker.id}> pulled a switchblade and gutted <@${targetUser.id}> like a fish! Their intestines spilled out with **${stolenAmount} coins**!`,
                `🔨 **BLUNT FORCE!** <@${attacker.id}> caved in <@${targetUser.id}>'s skull with a crowbar! Brain matter leaked out as **${stolenAmount} coins** mixed with the blood!`,
                `💀 **STRANGLED!** <@${attacker.id}> choked <@${targetUser.id}> to death with their bare hands! Their eyes bulged out as **${stolenAmount} coins** fell from their dying grasp!`,
                `🚗 **HIT AND RUN!** <@${attacker.id}> ran over <@${targetUser.id}> repeatedly until they were just a red stain on the pavement! **${stolenAmount} coins** were scattered in the tire tracks!`,
                `⚡ **ELECTROCUTION!** <@${attacker.id}> tased <@${targetUser.id}> until their heart stopped! Smoke rose from their corpse as **${stolenAmount} coins** fell from their twitching hands!`
            ];
        }
        
        const randomMessage = combatMessages[Math.floor(Math.random() * combatMessages.length)];
        
        let successMsg = `${randomMessage}\n\n`;
        
        // Add pet defense information if applicable
        if (petDefenseResult && !petDefenseResult.defended) {
            const targetPetInfo = PET_TYPES[targetPet.type];
            successMsg += `🛡️ **${targetPet.name}** (Lv.${targetPet.level}) tried to defend but failed! (${petDefenseResult.defense_chance}% chance)\n`;
            successMsg += `🐾 **Pet Defense Penalty:** -40% coins stolen\n\n`;
        }
        
        // Add bodyguard defense information if applicable
        if (bodyguardProtection > 0) {
            const protectionPercent = Math.floor(bodyguardProtection * 100);
            const totalBodyguards = personalBodyguards.reduce((sum, bg) => sum + bg.count, 0);
            successMsg += `🛡️ **${totalBodyguards} Bodyguards** provided partial protection! (${protectionPercent}% damage reduction)\n`;
            successMsg += `💼 **Security Penalty:** -${protectionPercent}% coins stolen\n\n`;
        }
        
        // Add weapon usage info if applicable
        if (selectedWeapon && weaponInfo && usedAmmo) {
            successMsg += `🔫 **Weapon Used:** ${weaponInfo.emoji} ${weaponInfo.name} (-1 ${weaponInfo.ammo_type})\n`;
            successMsg += `💀 **Weapon Bonus:** +50% coins stolen\n\n`;
        } else if (selectedWeapon && weaponInfo && !usedAmmo) {
            successMsg += `❌ **No Ammo:** ${weaponInfo.emoji} ${weaponInfo.name} (need ${weaponInfo.ammo_type})\n\n`;
        }
        
        successMsg += `💰 **Victim's Loss:** <@${targetUser.id}> lost **${stolenAmount}** coins!\n`;
        successMsg += `💵 **Attacker's Gain:** <@${attacker.id}> gained **${stolenAmount}** coins!\n\n`;
        successMsg += `💳 **<@${attacker.id}>** now has: **${getBalance(attacker.id)}** coins\n`;
        successMsg += `💸 **<@${targetUser.id}>** now has: **${getBalance(targetUser.id)}** coins`;

        const title = selectedWeapon && weaponInfo && usedAmmo 
            ? `${weaponInfo.emoji} Armed Murder - Success!` 
            : '💀 Street Murder - Success!';
            
        sendAsFloofWebhook(message, { embeds: [
            new EmbedBuilder()
                .setTitle(title)
                .setDescription(successMsg)
                .setColor(0x8b0000)
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
    }
}

function getBodyguardProtection(type) {
    const bodyguardTypes = {
        basic_bodyguard: {
            name: 'Basic Bodyguard',
            emoji: '👨‍💼',
            attack_reduction: 0.20
        },
        professional_bodyguard: {
            name: 'Professional Bodyguard',
            emoji: '🕴️',
            attack_reduction: 0.40
        },
        elite_bodyguard: {
            name: 'Elite Bodyguard',
            emoji: '🥷',
            attack_reduction: 0.60
        }
    };
    
    return bodyguardTypes[type];
}

module.exports = {
    name: 'beatup',
    description: 'Beat up another user to steal their coins - 80% success, 20% arrest chance',
    usage: '%beatup @user',
    category: 'gambling',
    aliases: ['attack', 'rob', 'mug', 'kill', 'murder'],
    cooldown: 60,
    async execute(message, args) {
        const targetUser = resolveTargetUser(message, args);
        if (!targetUser) {
            return sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please mention a user to beat up!')
                        .setColor(0xff0000)
                ]
            });
        }
        
        return beatup(message, targetUser);
    },
    // Export utility functions for use by other parts of the bot
    beatup,
    isArrested,
    getArrestTimeRemaining,
    releaseUser,
    getArresterInfo,
    arrestedUsers
};
