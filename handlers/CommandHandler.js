const fs = require('fs');
const path = require('path');

class CommandHandler {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
        this.aliases = new Map();
        this.loadCommands();
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        this.loadCommandsFromDirectory(commandsPath);
        
        // Load creation commands with owner-only flag
        const creationPath = path.join(__dirname, '..', 'creation');
        this.loadCommandsFromDirectory(creationPath, { ownerOnly: true });
    }

    loadCommandsFromDirectory(dir, options = {}) {
        const { ownerOnly = false } = options;
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Recursively load commands from subdirectories
                this.loadCommandsFromDirectory(itemPath);
            } else if (item.endsWith('.js')) {
                // Skip utility files that aren't commands
                const skipFiles = ['BaseCommand.js', 'balance-manager.js', 'gambling.js', 'gambling-menu.js', 'blackjack-handler.js', 'owner-gambling.js'];
                if (skipFiles.includes(item)) {
                    continue;
                }
                
                try {
                    const command = require(itemPath);
                    
                    // Validate command structure
                    if (!command.name || !command.execute) {
                        console.warn(`⚠️  Command ${item} is missing required properties (name, execute)`);
                        continue;
                    }
                    
                    // Apply ownerOnly flag if specified in options
                    const commandWithOptions = {
                        ...command,
                        ...(ownerOnly ? { ownerOnly: true } : {})
                    };
                    
                    // Register command
                    this.commands.set(command.name.toLowerCase(), commandWithOptions);
                    
                    // Register aliases if they exist
                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
                        }
                    }
                    
                    console.log(`✅ Loaded command: ${command.name}`);
                } catch (error) {
                    console.error(`❌ Failed to load command ${item}:`, error);
                }
            }
        }
    }

    async handleCommand(message) {
        const args = message.content.slice(1).trim().split(/ +/);
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
            if (command.ownerOnly && message.author.id !== process.env.OWNER_ID) {
                return false;
            }
            
            // Execute command
            await command.execute(message, args);
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
