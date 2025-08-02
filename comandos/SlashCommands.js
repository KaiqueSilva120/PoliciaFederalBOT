const { REST, Routes, Colors } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = async (client) => {
    const comandos = [];
    const sistemasPath = path.join(__dirname, '../sistemas');
    const arquivos = fs.readdirSync(sistemasPath).filter(file => file.endsWith('.js'));

    for (const file of arquivos) {
        const sistema = require(`../sistemas/${file}`);
        if (sistema.slashCommands && Array.isArray(sistema.slashCommands)) {
            comandos.push(...sistema.slashCommands);
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`[COMANDOS] Limpando comandos anteriores...`);
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] }
        );

        console.log(`[COMANDOS] Registrando novos comandos...`);
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: comandos }
        );

        console.log(`[COMANDOS] Comandos Registrados:\n${comandos.map(c => ` - \x1b[36m${c.name}\x1b[0m`).join('\n')}`);

    } catch (error) {
        console.error(`[ERRO] Falha ao registrar comandos:\n`, error);
    }
};
