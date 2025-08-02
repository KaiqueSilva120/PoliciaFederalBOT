const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionsBitField,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Configurações de Canais e IDs de Cargos ---
const PUNISHED_CHANNEL_ID = '1401075524876374116'; // Canal da mensagem fixa do sistema de punições (botões)
const PUNISHED_LOG_CHANNEL_ID = '1392923907979214979'; // Canal para onde as embeds de punição/remoção serão enviadas

// IDs dos cargos de punição
const ROLES = {
    LEVE: '1398531144022102177',      // 3 dias
    MEDIA: '1398531200619905045',     // 5 dias
    GRAVE: '1398531251538755657',     // 7 dias
    EXONERACAO: '1401079903625023498', // Exoneração
};

// Mapeamento de texto para IDs de cargos e dias
const PUNISHMENT_TYPES = {
    'leve': { roleId: ROLES.LEVE, days: 3, name: 'Advertência Leve' },
    'media': { roleId: ROLES.MEDIA, days: 5, name: 'Advertência Média' },
    'grave': { roleId: ROLES.GRAVE, days: 7, name: 'Advertência Grave' },
    'exoneração': { roleId: ROLES.EXONERACAO, days: 0, name: 'Exoneração', unremovable: true },
};

const PUNISHED_DB_FILE = path.join(__dirname, '../banco/punicoes.json');

// --- URls das Imagens ---
const DEFAULT_PUNISHMENT_IMAGE = 'https://cdn.discordapp.com/attachments/1390117626876788877/1401075897674633318/image.png?ex=688ef51c&is=688da39c&hm=d5041df80900a1a96f816ea1b9d9dd7e1df223bf4fe20582d943fbda5a85f53f&';


// --- Funções de Manipulação do Banco de Dados ---
/**
 * Carrega a lista de punições do arquivo JSON.
 * @returns {Array<Object>} Um array de objetos, cada um representando uma punição ativa.
 */
function loadPunishments() {
    try {
        if (!fs.existsSync(PUNISHED_DB_FILE)) {
            fs.mkdirSync(path.dirname(PUNISHED_DB_FILE), { recursive: true });
            fs.writeFileSync(PUNISHED_DB_FILE, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(PUNISHED_DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao carregar punições:', e);
        return [];
    }
}

/**
 * Salva a lista de punições no arquivo JSON.
 * @param {Array<Object>} punishments - O array de objetos de punições a ser salvo.
 */
function savePunishments(punishments) {
    try {
        fs.writeFileSync(PUNISHED_DB_FILE, JSON.stringify(punishments, null, 2));
    } catch (e) {
        console.error('Erro ao salvar punições:', e);
    }
}

// --- Funções de Criação de Componentes UI ---

/**
 * Cria os botões para aplicar e remover punições.
 * @returns {ActionRowBuilder} Uma ActionRow contendo os botões.
 */
function createPunishmentButtons() {
    const applyButton = new ButtonBuilder()
        .setCustomId('punish_apply')
        .setLabel('Aplicar Punição')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('<:ban:1398677658614628484>');

    const removeButton = new ButtonBuilder()
        .setCustomId('punish_remove')
        .setLabel('Remover Punição')
        .setStyle(ButtonStyle.Success)
        .setEmoji('<a:positivo:1397953846063398933>');

    return new ActionRowBuilder().addComponents(applyButton, removeButton);
}

/**
 * Cria a embed principal do sistema de punições.
 * @returns {EmbedBuilder} A embed formatada.
 */
function createMainPunishmentEmbed() {
    return new EmbedBuilder()
        .setTitle('<a:warning:1392879344262844437> SISTEMA DE PUNIÇÕES POLICIA FEDERAL')
        .setDescription(
            `> <a:seta_gugu1:1398025125537775639> Abaixo temos o sistema de punições da policia federal e suas respectivas punições abaixo:\n` +
            `> <@&${ROLES.LEVE}> - 3 dias\n` +
            `> <@&${ROLES.MEDIA}> - 5 dias\n` +
            `> <@&${ROLES.GRAVE}> - 7 dias\n` +
            `> <@&${ROLES.EXONERACAO}> - Exoneração\n\n` +
            `> Ao selecionar **Exoneração** o mesmo será expulso automaticamente da corporação.\n`
        )
        .setImage(DEFAULT_PUNISHMENT_IMAGE) // Imagem fixa principal
        .setColor('#FFA500') // Laranja/Amarelo para o painel principal
        .setTimestamp();
}

/**
 * Cria a embed de LOG para punição adicionada.
 * @param {Object} punishmentData - Dados da punição.
 * @param {User} punisher - Usuário que aplicou a punição.
 * @param {GuildMember} member - O objeto GuildMember do punido.
 * @returns {EmbedBuilder} A embed formatada para o log.
 */
function createPunishmentLogEmbed(punishmentData, punisher, member) {
    const fullDisplayName = member.displayName || member.user.username; // Ex: "Investigador Chefe Gustavo #135"

    // 1. Extrair ID do QRA
    const qraIdMatch = fullDisplayName.match(/#(\d+)$/);
    const qraId = qraIdMatch ? qraIdMatch[1] : 'N/A (não encontrado)';

    // 2. Obter a parte do QRA sem o ID numérico (ex: "Investigador Chefe Gustavo")
    const nameWithoutQraId = qraIdMatch ? fullDisplayName.substring(0, qraIdMatch.index).trim() : fullDisplayName;

    // 3. Extrair o Cargo e Nome
    const firstSpaceIndex = nameWithoutQraId.indexOf(' ');
    let memberRole = 'Não especificado';
    let memberNameOnly = nameWithoutQraId;

    if (firstSpaceIndex !== -1) {
        memberRole = nameWithoutQraId.substring(0, firstSpaceIndex);
        memberNameOnly = nameWithoutQraId.substring(firstSpaceIndex + 1).trim();

        // Heurística para cargos compostos (ex: "Investigador Chefe")
        const secondWordMatch = memberNameOnly.match(/^(\S+)\s/);
        if (secondWordMatch && ['chefe', 'supervisor', 'sub', 'coordenador'].includes(secondWordMatch[1].toLowerCase())) {
            memberRole = `${memberRole} ${secondWordMatch[1]}`;
            memberNameOnly = memberNameOnly.substring(secondWordMatch[0].length).trim();
        }
    } else {
        // Se não houver espaço, a string completa pode ser o nome ou um cargo sem nome
        memberRole = 'Não especificado';
        memberNameOnly = nameWithoutQraId;
    }

    // Se o "nome" ainda for igual ao "cargo" ou vice-versa após a heurística,
    // ou se o nome for vazio, tentar inferir melhor
    if (memberNameOnly === memberRole || !memberNameOnly) {
         // Tentar inferir se a primeira parte é mais provável ser um um cargo conhecido
        const knownRoles = ['Investigador', 'Perito', 'Delegado', 'Agente', 'Escrivão', 'Chefe', 'Supervisor', 'Subcoordenador', 'Coordenador', 'Soldado', 'Cabo', 'Sargento', 'Tenente', 'Capitão', 'Major', 'Coronel']; // Adicione mais conforme necessário
        const extractedFirstWord = nameWithoutQraId.split(' ')[0];
        if (knownRoles.some(role => extractedFirstWord.toLowerCase() === role.toLowerCase())) { // Comparação exata para cargo
            memberRole = extractedFirstWord;
            memberNameOnly = nameWithoutQraId.substring(extractedFirstWord.length).trim() || 'N/A'; // O que sobrar é o nome
        } else {
            // Se não for um cargo conhecido, trata-se de um nome simples ou só um cargo
            memberRole = 'Não especificado';
            memberNameOnly = nameWithoutQraId;
        }
    }


    const embed = new EmbedBuilder()
        .setTitle('<:ban:1398677658614628484> Punição Adicionada')
        .setColor('#FF0000') // Vermelho
        .setImage(DEFAULT_PUNISHMENT_IMAGE) // Imagem padrão
        .addFields(
            { name: 'QRA do Punido:', value: `<@${punishmentData.memberId}>`, inline: true }, // Menção do Discord ID
            { name: 'Nome do Punido:', value: memberNameOnly, inline: true }, // Nome após o cargo, antes do #
            { name: 'ID do Punido:', value: `\`${qraId}\``, inline: false }, // APENAS O ID DO QRA (após o #)
            { name: 'Cargo:', value: memberRole, inline: true }, // Cargo
            { name: 'Motivo:', value: punishmentData.reason },
            { name: 'Punição:', value: `<@&${punishmentData.roleId}>`, inline: true },
            { name: 'Quem Puniu:', value: `<@${punisher.id}>`, inline: true }
        )
        .setTimestamp();

    if (punishmentData.punishmentType === 'exoneração') {
        embed.addFields({ name: 'Expira em:', value: '<:infinito:1401097786216153208> (Nunca)', inline: true });
    } else if (punishmentData.expiresAt) {
        const expiresInMs = punishmentData.expiresAt - Date.now();
        const days = Math.ceil(expiresInMs / (1000 * 60 * 60 * 24));
        embed.addFields({ name: 'Expira em:', value: `Em ${days} dias`, inline: true });
    } else {
        embed.addFields({ name: 'Expira em:', value: 'Não se aplica', inline: true });
    }

    return embed;
}

/**
 * Cria a embed de LOG para punição removida.
 * @param {Object} originalPunishmentData - Dados COMPLETOs da punição original.
 * @param {User} remover - Usuário que removeu a punição.
 * @returns {EmbedBuilder} A embed formatada para o log de remoção.
 */
function createPunishmentRemovedLogEmbed(originalPunishmentData, remover) {
    const fullDisplayName = originalPunishmentData.memberName; // O displayName original que foi salvo

    // 1. Extrair ID do QRA
    const qraIdMatch = fullDisplayName.match(/#(\d+)$/);
    const qraId = qraIdMatch ? qraIdMatch[1] : 'N/A (não encontrado no QRA original)';

    // 2. Obter a parte do QRA sem o ID numérico (ex: "Investigador Chefe Gustavo")
    const nameWithoutQraId = qraIdMatch ? fullDisplayName.substring(0, qraIdMatch.index).trim() : fullDisplayName;

    // 3. Extrair o Cargo e Nome (replicando a lógica de extração da punição aplicada)
    const firstSpaceIndex = nameWithoutQraId.indexOf(' ');
    let memberRole = 'Não especificado';
    let memberNameOnly = nameWithoutQraId;

    if (firstSpaceIndex !== -1) {
        memberRole = nameWithoutQraId.substring(0, firstSpaceIndex);
        memberNameOnly = nameWithoutQraId.substring(firstSpaceIndex + 1).trim();

        const secondWordMatch = memberNameOnly.match(/^(\S+)\s/);
        if (secondWordMatch && ['chefe', 'supervisor', 'sub', 'coordenador'].includes(secondWordMatch[1].toLowerCase())) {
            memberRole = `${memberRole} ${secondWordMatch[1]}`;
            memberNameOnly = memberNameOnly.substring(secondWordMatch[0].length).trim();
        }
    } else {
        memberRole = 'Não especificado';
        memberNameOnly = nameWithoutQraId;
    }

    if (memberNameOnly === memberRole || !memberNameOnly) {
        const knownRoles = ['Investigador', 'Perito', 'Delegado', 'Agente', 'Escrivão', 'Chefe', 'Supervisor', 'Subcoordenador', 'Coordenador', 'Soldado', 'Cabo', 'Sargento', 'Tenente', 'Capitão', 'Major', 'Coronel'];
        const extractedFirstWord = nameWithoutQraId.split(' ')[0];
        if (knownRoles.some(role => extractedFirstWord.toLowerCase() === role.toLowerCase())) {
            memberRole = extractedFirstWord;
            memberNameOnly = nameWithoutQraId.substring(extractedFirstWord.length).trim() || 'N/A';
        } else {
            memberRole = 'Não especificado';
            memberNameOnly = nameWithoutQraId;
        }
    }


    const embed = new EmbedBuilder()
        .setTitle('<:ban:1398677658614628484> Punição Removida')
        .setColor('#00FF00') // Verde
        .setImage(DEFAULT_PUNISHMENT_IMAGE) // Imagem padrão para remoção
        .addFields(
            { name: 'QRA do Punido:', value: `<@${originalPunishmentData.memberId}>`, inline: true }, // Menção
            { name: 'Nome do Punido:', value: memberNameOnly, inline: true }, // Nome após o cargo, antes do #
            { name: 'ID do Punido:', value: `\`${qraId}\``, inline: false }, // APENAS O ID DO QRA (após o #)
            { name: 'Cargo:', value: memberRole, inline: true }, // Cargo
            { name: 'Motivo:', value: originalPunishmentData.reason },
            { name: 'Punição:', value: `<@&${originalPunishmentData.roleId}>`, inline: true },
            { name: 'Quem Puniu:', value: `<@${originalPunishmentData.punisherId}>`, inline: true },
            { name: 'Quem Removeu:', value: `<@${remover.id}>`, inline: true } // Novo campo para quem removeu
        )
        .setTimestamp();

    if (originalPunishmentData.punishmentType === 'exoneração') {
        embed.addFields({ name: 'Expira em:', value: '<:infinito:1401097786216153208> (Nunca)', inline: true });
    } else if (originalPunishmentData.expiresAt) {
        const durationMs = originalPunishmentData.expiresAt - originalPunishmentData.punishedAt;
        const originalDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
        embed.addFields({ name: 'Expira em:', value: `Originalmente em ${originalDays} dias`, inline: true });
    } else {
        embed.addFields({ name: 'Expira em:', value: 'Não se aplica', inline: true });
    }

    return embed;
}



// --- Função para Garantir a Mensagem Fixa ---

/**
 * Garante que o painel de punições esteja presente no canal.
 * Se não houver painel fixado, envia um novo e fixa.
 * @param {Client} client - O cliente Discord.
 */
async function ensurePunishmentMessage(client) {
    const punishmentChannel = await client.channels.fetch(PUNISHED_CHANNEL_ID);
    if (!punishmentChannel || !punishmentChannel.isTextBased()) {
        console.error(`Canal de punições (ID: ${PUNISHED_CHANNEL_ID}) não encontrado ou não é um canal de texto.`);
        return;
    }

    try {
        const pinnedMessages = await punishmentChannel.messages.fetchPinned();
        const existingPanel = pinnedMessages.find(msg =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes('SISTEMA DE PUNIÇÕES')
        );

        if (existingPanel) {
            console.log('[PUNIDOS] Painel já existe e está fixado. Nenhuma ação necessária.');
            return; // Não recria se já existe
        }

        // Se não existir, cria um novo painel
        console.log('[PUNIDOS] Nenhum painel encontrado. Criando novo...');
        const mainEmbed = createMainPunishmentEmbed();
        const buttonsRow = createPunishmentButtons();
        const newMessage = await punishmentChannel.send({ embeds: [mainEmbed], components: [buttonsRow] });
        await newMessage.pin('Mensagem principal do sistema de punições.');
        console.log('[PUNIDOS] Novo painel de punições enviado e fixado.');

    } catch (error) {
        console.error('[PUNIDOS] Erro ao verificar/criar painel de punições:', error);
    }
}


// --- Funções Auxiliares de Lógica ---

/**
 * Extrai o ID do usuário de uma menção ou ID direto.
 * @param {Guild} guild - O objeto Guild.
 * @param {string} input - O ID do usuário ou a menção.
 * @returns {string|null} O ID do usuário ou null se não for encontrado.
 */
async function extractUserId(guild, input) {
    // Tenta extrair de uma menção (<@!ID> ou <@ID>)
    const mentionMatch = input.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        return mentionMatch[1];
    }

    // Tenta extrair se for apenas um ID numérico puro
    if (/^\d+$/.test(input)) {
        return input;
    }

    // Fallback: Tenta encontrar por nome de exibição ou username (menos confiável)
    // OBS: O discriminador (#1234) não é mais garantido no username para novos usuários.
    const member = guild.members.cache.find(m =>
        m.displayName.toLowerCase() === input.toLowerCase() ||
        m.user.username.toLowerCase() === input.toLowerCase() ||
        m.user.tag.toLowerCase() === input.toLowerCase() // "Nome#1234"
    );
    if (member) {
        return member.id;
    }

    return null;
}

// --- Exportações do Módulo ---
module.exports = {
    slashCommands: [], // Array vazio, nenhum comando slash será registrado por este módulo

    setup: (client) => {
        client.punishments = loadPunishments();

        // Ao iniciar o bot, verifica UMA VEZ se a mensagem do painel existe e envia se não.
        client.once('ready', async () => { // Usar 'once' para rodar apenas uma vez
            console.log('Iniciando limpeza e envio do painel de punições...');
            await ensurePunishmentMessage(client);
        });

        // Listener para interações
        client.on('interactionCreate', async (interaction) => {
            // Se a interação for um comando slash, e não for o nosso, apenas ignora aqui.
            if (interaction.isChatInputCommand()) {
                return; // Ignora qualquer comando slash que possa vir aqui
            }

            // Lidar com cliques de botão (Aplicar/Remover Punição)
            if (interaction.isButton()) {
                if (interaction.customId === 'punish_apply') {
                    const modal = new ModalBuilder()
                        .setCustomId('punish_apply_modal')
                        .setTitle('Aplicar Punição');

                    const qraInput = new TextInputBuilder()
                        .setCustomId('punish_qra')
                        .setLabel('Membro Punido (ID do dc ou Menção)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Ex: 707959058228969485 ou <@707959058228969485>')
                        .setRequired(true);

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('punish_reason')
                        .setLabel('Motivo da Punição')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);

                    const punishmentTypeInput = new TextInputBuilder()
                        .setCustomId('punish_type')
                        .setLabel('Tipo de Punição:')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Leve | Media | Grave | Exoneração')
                        .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(qraInput),
                        new ActionRowBuilder().addComponents(reasonInput),
                        new ActionRowBuilder().addComponents(punishmentTypeInput)
                    );

                    await interaction.showModal(modal);
                    return;
                }

                if (interaction.customId === 'punish_remove') {
                    // Filtrar punições que *podem* ser removidas (ou seja, NÃO são exoneração)
                    const removablePunishments = loadPunishments().filter(p => {
                        const typeInfo = PUNISHMENT_TYPES[p.punishmentType];
                        // Só incluir se o tipo de punição existe E não é marcado como inremovível
                        return typeInfo && !typeInfo.unremovable;
                    });

                    if (removablePunishments.length === 0) {
                        await interaction.reply({ content: 'Não há punições removíveis ativas no momento (Punições de Exoneração não podem ser removidas por este painel).', ephemeral: true });
                        return;
                    }

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('punish_remove_select')
                        .setPlaceholder('Selecione uma punição para remover')
                        .addOptions(
                            removablePunishments.map((p, index) => ({
                                label: `${p.memberName} (${PUNISHMENT_TYPES[p.punishmentType]?.name || p.punishmentType})`,
                                description: `Motivo: ${p.reason.slice(0, 50)}...`,
                                value: p.id, // ID único da punição
                            }))
                        );

                    const row = new ActionRowBuilder().addComponents(selectMenu);
                    await interaction.reply({
                        content: 'Selecione a punição que deseja remover (Punições de Exoneração não aparecem aqui):',
                        components: [row],
                        ephemeral: true,
                    });
                    return;
                }
            }

            // Lidar com submissões de modal
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'punish_apply_modal') {
                    await interaction.deferReply({ ephemeral: true });

                    const qraInputContent = interaction.fields.getTextInputValue('punish_qra');
                    const reason = interaction.fields.getTextInputValue('punish_reason');
                    const punishmentType = interaction.fields.getTextInputValue('punish_type').toLowerCase();

                    const punisher = interaction.user;

                    const punishmentInfo = PUNISHMENT_TYPES[punishmentType];
                    if (!punishmentInfo) {
                        await interaction.editReply({ content: '❌ Tipo de punição inválido. Use Leve, Media, Grave ou Exoneração.' });
                        return;
                    }

                    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
                         await interaction.editReply({ content: 'Você não tem permissão para aplicar punições.', ephemeral: true });
                         return;
                    }

                    const memberId = await extractUserId(interaction.guild, qraInputContent);
                    if (!memberId) {
                        await interaction.editReply({ content: '❌ Não foi possível encontrar o ID do membro a partir do que foi fornecido. Certifique-se de que é um ID válido do Discord ou uma menção.' });
                        return;
                    }

                    const member = await interaction.guild.members.fetch(memberId).catch(() => null);
                    if (!member) {
                        await interaction.editReply({ content: '❌ O membro com o ID fornecido não foi encontrado no servidor.' });
                        return;
                    }

                    const memberDisplayName = member.displayName || member.user.username;

                    const punishmentId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

                    let expiresAt = null;
                    if (punishmentInfo.days > 0) {
                        expiresAt = Date.now() + (punishmentInfo.days * 24 * 60 * 60 * 1000);
                    }

                    const newPunishment = {
                        id: punishmentId,
                        memberId: member.id,
                        memberName: memberDisplayName, // Salva o nome de exibição atual (QRA completo)
                        punishmentType: punishmentType,
                        roleId: punishmentInfo.roleId,
                        reason: reason,
                        punisherId: punisher.id,
                        punishedAt: Date.now(),
                        expiresAt: expiresAt,
                        logMessageId: null,
                    };

                    let currentPunishments = loadPunishments();
                    currentPunishments.push(newPunishment);
                    savePunishments(currentPunishments);

                    const logChannel = await interaction.client.channels.fetch(PUNISHED_LOG_CHANNEL_ID);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = createPunishmentLogEmbed(newPunishment, punisher, member);
                        try {
                            const sentLogMessage = await logChannel.send({ embeds: [logEmbed] });
                            newPunishment.logMessageId = sentLogMessage.id;
                            savePunishments(currentPunishments);
                        } catch (logError) {
                            console.error('Erro ao enviar embed de log para o canal de punições:', logError);
                        }
                    } else {
                        console.warn(`Canal de log de punições (ID: ${PUNISHED_LOG_CHANNEL_ID}) não encontrado ou não é de texto.`);
                    }

                    try {
                        const allPunishmentRoleIds = Object.values(ROLES);
                        await member.roles.remove(allPunishmentRoleIds, 'Removendo cargos de punição antigos para aplicar novo.');

                        await member.roles.add(punishmentInfo.roleId, `Punição: ${punishmentInfo.name}`);

                        if (punishmentType === 'exoneração') {
                            if (!member.user.bot) {
                                const rolesToRemove = member.roles.cache.filter(role =>
                                    role.id !== interaction.guild.id &&
                                    !allPunishmentRoleIds.includes(role.id)
                                );
                                await member.roles.remove(rolesToRemove, 'Exoneração: Removendo todos os cargos');
                            }
                        }

                        await interaction.editReply({ content: `✅ Punição de **${punishmentInfo.name}** aplicada a <@${member.id}>. Motivo: ${reason}` });
                    } catch (roleError) {
                        console.error('Erro ao aplicar/remover cargos:', roleError);
                        await interaction.editReply({ content: '❌ Punição aplicada, mas houve um erro ao gerenciar cargos. Verifique as permissões do bot.' });
                    }
                    return;
                }
            }

            // Lidar com seleção de menu (Remover Punição)
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'punish_remove_select') {
                    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
                         await interaction.reply({ content: 'Você não tem permissão para remover punições.', ephemeral: true });
                         return;
                    }

                    await interaction.deferUpdate();

                    const punishmentIdToRemove = interaction.values[0];
                    let currentPunishments = loadPunishments();
                    const punishmentIndex = currentPunishments.findIndex(p => p.id === punishmentIdToRemove);

                    if (punishmentIndex === -1) {
                        await interaction.followUp({ content: '❌ Punição não encontrada ou já removida.', ephemeral: true });
                        return;
                    }

                    const removedPunishment = currentPunishments.splice(punishmentIndex, 1)[0];
                    savePunishments(currentPunishments);

                    const member = await interaction.guild.members.fetch(removedPunishment.memberId).catch(() => null);
                    if (member && member.roles.cache.has(removedPunishment.roleId)) {
                        try {
                            await member.roles.remove(removedPunishment.roleId, 'Punição removida manualmente.');
                            await interaction.followUp({ content: `✅ Cargo de punição removido de <@${member.id}>.`, ephemeral: true });
                        } catch (roleRemoveError) {
                            console.error('Erro ao remover cargo de punição:', roleRemoveError);
                            await interaction.followUp({ content: '❌ Punição removida do registro, mas houve um erro ao remover o cargo do membro. Verifique as permissões do bot.', ephemeral: true });
                        }
                    } else if (member) {
                        await interaction.followUp({ content: `✅ Punição removida do registro, mas o membro não possui mais o cargo de punição.`, ephemeral: true });
                    } else {
                        await interaction.followUp({ content: `✅ Punição removida do registro. Membro não encontrado no servidor.`, ephemeral: true });
                    }

                    if (removedPunishment.logMessageId) {
                        const logChannel = await interaction.client.channels.fetch(PUNISHED_LOG_CHANNEL_ID);
                        if (logChannel && logChannel.isTextBased()) {
                            try {
                                const logMessage = await logChannel.messages.fetch(removedPunishment.logMessageId);
                                if (logMessage) {
                                    const updatedLogEmbed = createPunishmentRemovedLogEmbed(removedPunishment, interaction.user);
                                    await logMessage.edit({ embeds: [updatedLogEmbed] });
                                }
                            } catch (logEditError) {
                                console.error('Erro ao editar embed de log da punição removida:', logEditError);
                            }
                        }
                    }
                    return;
                }
            }
        });
    },
};