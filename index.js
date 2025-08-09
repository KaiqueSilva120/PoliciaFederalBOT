require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const registrarSlashCommands = require('./comandos/SlashCommands');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
client.systems = new Collection();

const systemsPath = path.join(__dirname, 'sistemas');
const systemFiles = fs.readdirSync(systemsPath).filter(file => file.endsWith('.js'));

for (const file of systemFiles) {
    const system = require(`./sistemas/${file}`);
    if (typeof system.setup === 'function') {
        system.setup(client);
        console.log(`[SISTEMA] ${file} carregado.`);
        client.systems.set(file.split('.')[0], system);
    }
}

client.once('ready', async () => {
    console.log(`[BOT ONLINE] Logado como ${client.user.tag}`);

    client.user.setPresence({
        activities: [{
            name: 'Policia Federal | CMRP',
            type: 0
        }],
        status: 'dnd'
    });

    await registrarSlashCommands(client);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
        }
    }
    
    for (const [name, system] of client.systems) {
        if (typeof system.handleInteraction === 'function') {
            try {
                const handled = await system.handleInteraction(interaction);
                if (handled) {
                    return;
                }
            } catch (error) {
                console.error(`Erro ao lidar com a interação no sistema ${name}:`, error);
            }
        }
    }
});


const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!\n');
}).listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);