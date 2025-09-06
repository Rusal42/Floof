const fs = require('fs');
const path = require('path');
const VERBOSE_CMD_LOAD = process.env.DEBUG_COMMAND_LOAD === '1';

class CommandHandler {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
        this.aliases = new Map();
        this.loadCommands();
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        
        // Load all regular commands, but mark gambling commands as owner-only
        const items = fs.readdirSync(commandsPath);
        for (const item of items) {
            const itemPath = path.join(commandsPath, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Load all directories without ownerOnly flag
                this.loadCommandsFromDirectory(itemPath);
            } else if (item.endsWith('.js')) {
                // Load individual command files in the root commands directory
                this.loadCommandFile(itemPath);
            }
        }
        
        // Load creation commands with owner-only flag
        const creationPath = path.join(__dirname, '..', 'creation');
        this.loadCommandsFromDirectory(creationPath, { ownerOnly: true });
        
        // Load moderation commands (legacy path). Only if directory still exists.
        const moderationPath = path.join(__dirname, '..', 'moderation');
        if (fs.existsSync(moderationPath)) {
            this.loadCommandsFromDirectory(moderationPath);
        }
        
        // Load owner commands
        const ownerCommandsPath = path.join(__dirname, '..', 'owner-commands');
        this.loadCommandsFromDirectory(ownerCommandsPath, { ownerOnly: true });
    }

    loadCommandFile(filePath) {
        const fileName = path.basename(filePath);
        const dirName = path.basename(path.dirname(filePath));
        
        // Skip utility files that aren't commands
        const skipFiles = ['BaseCommand.js', 'balance-manager.js', 'gambling-menu.js', 'blackjack-handler.js'];
        
        if (skipFiles.includes(fileName)) {
            if (VERBOSE_CMD_LOAD) console.log(`Skipping non-command file: ${fileName}`);
            return;
        }
        
        try {
            console.log(`Loading command file: ${fileName}`);
            const command = require(filePath);
            
            // Only mark owner-gambling.js commands as ownerOnly
            if (fileName === 'owner-gambling.js' && dirName === 'gambling') {
                command.ownerOnly = true;
            }
            
            // Validate command structure
            if (!command.name || !command.execute) {
                // Quietly skip modules that aren't command objects
                if (VERBOSE_CMD_LOAD) console.log(`Skipping non-command module: ${fileName}`);
                return;
            }
            
            // Register command
            this.registerCommand(command, filePath);
        } catch (error) {
            console.error(`❌ Failed to load command ${fileName}:`, error);
        }
    }
    
    registerCommand(command, filePath) {
        // Store file path for potential reloading
        command.filePath = filePath;
        
        // Debug log command registration
        const cmdName = command.name.toLowerCase();
        const isOwnerOnly = command.ownerOnly ? 'OWNER-ONLY' : 'PUBLIC';
        console.log(`📝 Registering command: ${cmdName.padEnd(15)} [${isOwnerOnly}] from ${path.basename(filePath)}`);
        
        // Register command
        this.commands.set(cmdName, command);
        
        // Register aliases if they exist
        if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
            }
        }
        
        console.log(`✅ Loaded command: ${command.name}${command.ownerOnly ? ' (owner only)' : ''}`);
    }
    
    loadCommandsFromDirectory(dir, options = {}) {
        const { ownerOnly = false } = options;
        const items = fs.readdirSync(dir);
        const dirName = path.basename(dir);
        // Known helper files per directory to skip noisy warnings
        const skipByDir = {
            'creation': new Set([
                'fluffy-setup.js', 'fluffy-snap.js', 'role-menu.js', 'rules-menu.js',
                'setup-color-roles.js', 'setup-fun-roles.js', 'welcome.js'
            ]),
            'moderation': new Set(['automod.js']),
            'owner-commands': new Set(['owner-commands.js', 'owner-floof-interactive.js'])
        };
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Recursively load commands from subdirectories
                this.loadCommandsFromDirectory(itemPath, options);
            } else if (item.endsWith('.js')) {
                // Skip known helper modules in specific directories
                if (skipByDir[dirName] && skipByDir[dirName].has(item)) {
                    if (VERBOSE_CMD_LOAD) console.log(`Skipping non-command file in ${dirName}: ${item}`);
                    continue;
                }
                try {
                    const command = require(itemPath);
                    
                    // Validate command structure
                    if (!command.name || !command.execute) {
                        // Quietly skip modules that aren't command objects
                        if (VERBOSE_CMD_LOAD) console.log(`Skipping non-command module in ${dirName}: ${item}`);
                        continue;
                    }
                    
                    // Apply ownerOnly flag if specified in options
                    if (ownerOnly) {
                        command.ownerOnly = true;
                    }
                    
                    // Store file path for potential reloading
                    command.filePath = itemPath;
                    
                    // Register command
                    this.commands.set(command.name.toLowerCase(), command);
                    
                    // Register aliases if they exist
                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
                        }
                    }
                    
                    console.log(`✅ Loaded command: ${command.name}${command.ownerOnly ? ' (owner only)' : ''}`);
                } catch (error) {
                    console.error(`❌ Failed to load command ${item}:`, error);
                }
            }
        }
    }

    async handleCommand(message, usedPrefix = '%') {
        const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Check if it's a command or alias
        let command = this.commands.get(commandName);
        if (!command) {
            const aliasCommand = this.aliases.get(commandName);
            if (aliasCommand) {
                command = this.commands.get(aliasCommand);
            }
        }
        
        
        if (!command) {
            return false; // Command not found
        }
        
        try {
            // Check permissions if specified
            if (command.permissions && message.guild) {
                const memberPermissions = message.member.permissions;
                if (!memberPermissions.has(command.permissions)) {
                    return message.reply('❌ You do not have permission to use this command.');
                }
            }
            
            // Check if owner only - silently ignore if not owner
            if (command.ownerOnly) {
                console.log(`Command ${command.name} is owner-only`);
                const { isOwner } = require('../utils/owner-util');
                if (!isOwner(message.author.id)) {
                    console.log(`User ${message.author.tag} is not an owner, ignoring command`);
                    return false;
                }
            } else {
                console.log(`Command ${command.name} is available to all users`);
            }
            
            // Execute command
            await command.execute(message, args);
            
            // Track command usage for website stats
            try {
                const { incrementCommandUsage } = require('../utils/website-integration');
                incrementCommandUsage();
            } catch (error) {
                console.error('Error tracking command usage:', error);
            }
            
            return true;
        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            message.reply('❌ There was an error executing this command.');
            return true;
        }
    }

    // Reload a specific command
    reloadCommand(commandName) {
        const command = this.commands.get(commandName.toLowerCase());
        if (!command) return false;
        
        try {
            // Clear from require cache
            const commandPath = require.resolve(command.filePath);
            delete require.cache[commandPath];
            
            // Reload
            const newCommand = require(commandPath);
            this.commands.set(newCommand.name.toLowerCase(), newCommand);
            
            return true;
        } catch (error) {
            console.error(`Failed to reload command ${commandName}:`, error);
            return false;
        }
    }

    // Get all commands for help
    getAllCommands() {
        return Array.from(this.commands.values());
    }

    // Get commands by category
    getCommandsByCategory(category) {
        return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
    }
}

module.exports = CommandHandler;
