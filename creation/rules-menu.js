const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');

// Usage: %makerulesmenu [roleName]
// Posts the rules with an "I agree" button. Assigns roleName if provided.
async function makeRulesMenu(message, args) {
    const OWNER_ID = '1007799027716329484';
    const TARGET_CHANNEL_ID = '1393667672511746099';
    if (message.author.id !== OWNER_ID) return;
    const assignRoleName = args[1];
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply('Floof needs Manage Roles permission to assign roles!');
    }
    // Find or create the role if specified
    let assignRole = null;
    if (assignRoleName) {
        assignRole = message.guild.roles.cache.find(r => r.name === assignRoleName);
        if (!assignRole) {
            try {
                assignRole = await message.guild.roles.create({ name: assignRoleName, reason: 'Floof rules menu setup' });
            } catch {}
        }
    }

    const rules = [
        'Be kind and respectful! ✨',
        'No spam or self-promo.',
        'Keep things cozy and safe for all floofs.',
        'You can be weird, but not *too* weird~',
        'Try to keep arguing to a minimum.',
        'Show lots of love to Floof (if she\'s working)!',
        'Dark humor is okay, but don\'t say anything too crazy!',
        'Listen to mods and have fun!'
    ];

    const embed = new EmbedBuilder()
        .setTitle('🐾 Floof\'s Fluffy Den Rules')
        .setDescription(rules.map((r, i) => `${i + 1}. ${r}`).join('\n'))
        .setColor(0xffb6c1)
        .setFooter({ text: 'Click the button below to agree and join the fluff!' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('floof_rules_agree')
            .setLabel('I agree! 🐾')
            .setStyle(ButtonStyle.Success)
    );

    const channel = message.guild.channels.cache.get(TARGET_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
        return message.reply('Could not find the target channel for the rules menu!');
    }
    await channel.send({ embeds: [embed], components: [row] });
    await message.reply('Rules menu sent to <#' + TARGET_CHANNEL_ID + '>!');
}

// Handler for the rules button
async function handleRulesMenuInteraction(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'floof_rules_agree') return;
    const member = interaction.member;
    // Always assign the 'Member' role when the button is pressed
    const assignRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'member');
    if (!assignRole) {
        return interaction.reply({ content: 'Sorry, I could not find the "Member" role! Please let a mod know.', flags: 64 });
    }
    if (!member.roles.cache.has(assignRole.id)) {
        try {
            await member.roles.add(assignRole);
            await interaction.reply({ content: 'Yay! You have been given the Member role! Welcome to the fluff! (ฅ^•ﻌ•^ฅ)♡', flags: 64 });
        } catch (err) {
            return interaction.reply({ content: 'I do not have permission to assign roles. Please let a mod know!', flags: 64 });
        }
    } else {
        await interaction.reply({ content: 'You already have the Member role! (ฅ^•ﻌ•^ฅ)', flags: 64 });
    }
}

module.exports = { makeRulesMenu, handleRulesMenuInteraction };
