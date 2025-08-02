const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// --- Configurações Importantes ---
const ACESSO_CHANNEL_ID = '1391248897862664324'; // Canal onde a mensagem fixa será enviada
const PRISOES_CHANNEL_ID = '1391248640168955945'; // Canal de Prisões da Cidade (mencionado na mensagem de sucesso)
const ACESSO_ROLE_ID = '1391251666321281207';     // Cargo a ser concedido/removido
const GUILD_ID = 'SEU_GUILD_ID';                 // ID do seu servidor (para thumbnail do bot)

// --- Funções Auxiliares ---

/**
 * Envia a mensagem fixa de acesso no canal especificado.
 * Verifica se a mensagem já existe para evitar duplicidade.
 * @param {Channel} channel - O canal onde a mensagem deve ser enviada.
 * @param {Client} client - A instância do cliente Discord.
 */
async function sendAcessoMessage(channel, client) {
    const embed = new EmbedBuilder()
        .setTitle('<a:lupa:1389604951746941159> Acesso Restrito - Prisões da Cidade')
        .setDescription(
            `> Para ter acesso autorizado pela Polícia Federal ao canal de Prisões da Cidade e ver em tempo real as prisões realizadas na Delegacia, com informações detalhadas e dados implementados nos relatórios, clique no botão "Receber Acesso" abaixo.\n\n` +
            `<a:sino:1389605284200185887> Caso não deseje receber notificações, você pode silenciar o canal ou simplesmente clicar em Remover Acesso.`
        )
        .setImage('https://cdn.discordapp.com/attachments/1390117626876788877/1401267832360271983/image.png?ex=688fa7dd&is=688e565d&hm=1b2a0ddf427c2ec26e7fa62670b58745964f60a4b901124813957a1358484923&')
        .setThumbnail(client.user.displayAvatarURL()); // Imagem do BOT

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('receber_acesso')
                .setLabel('Receber Acesso')
                .setStyle(ButtonStyle.Success)
                .setEmoji('<a:positivo:1397953846063398933>'), // Emoji de aceitado
            new ButtonBuilder()
                .setCustomId('remover_acesso')
                .setLabel('Remover Acesso')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('<a:negativo:1397953861251104779>') // Emoji de negado
        );

    await channel.send({ embeds: [embed], components: [actionRow] });
}

// --- Módulo Principal do Sistema de Acesso ---

/**
 * Função de setup para inicializar e gerenciar o sistema de acesso.
 * Exportada para ser carregada pelo index.js.
 * @param {Client} client - A instância do cliente Discord.
 */
function setup(client) {
    // Certifique-se de que o bot tem o intent de GuildMembers para gerenciar cargos
    if (!client.options.intents.has(GatewayIntentBits.GuildMembers)) {
        client.options.intents.add(GatewayIntentBits.GuildMembers);
    }

    // Evento ready: Configura a mensagem fixa de acesso
    client.once('ready', async () => {
        console.log(`[SISTEMA DE ACESSO] Iniciado para ${client.user.tag}!`);
        const channel = await client.channels.fetch(ACESSO_CHANNEL_ID).catch(() => null);
        if (!channel) return console.error('[SISTEMA DE ACESSO] Canal de acesso não encontrado. Verifique o ID.');

        // --- INÍCIO DA VERIFICAÇÃO ADICIONADA ---
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null); // Aumentei o limite para 100 para ter mais chance de encontrar
        const fixedMessage = messages ? messages.find(msg =>
            msg.embeds.length > 0 && msg.embeds[0].title === '<a:lupa:1389604951746941159> Acesso Restrito - Prisões da Cidade'
        ) : null;

        if (fixedMessage) {
            console.log('[SISTEMA DE ACESSO] Mensagem fixa de acesso já existe. Não farei nada.');
        } else {
            console.log('[SISTEMA DE ACESSO] Mensagem fixa de acesso não encontrada. Enviando...');
            await sendAcessoMessage(channel, client);
        }
        // --- FIM DA VERIFICAÇÃO ADICIONADA ---
    });

    // Evento de interação: Lida com os cliques nos botões
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        const { customId, member, guild } = interaction;

        // Garante que o bot tenha Guild Members intent ativado e o cargo exista
        if (!guild.roles.cache.has(ACESSO_ROLE_ID)) {
            console.error(`[SISTEMA DE ACESSO] Cargo com ID ${ACESSO_ROLE_ID} não encontrado no servidor.`);
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({ content: 'O cargo de acesso não foi configurado corretamente no servidor. Por favor, contate um administrador.', ephemeral: true });
            }
            return;
        }

        // Deferir a resposta para evitar "interação falhou"
        if (!interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
        }

        switch (customId) {
            case 'receber_acesso':
                try {
                    // Verifica se o membro já tem o cargo
                    if (member.roles.cache.has(ACESSO_ROLE_ID)) {
                        await interaction.editReply({
                            content: '<:alerta:1398025586675122170> | Você já possui acesso às prisões da cidade!',
                            ephemeral: true
                        });
                        return;
                    }

                    await member.roles.add(ACESSO_ROLE_ID);
                    await interaction.editReply({
                        content: `<a:positivo:1397953846063398933> | Parabéns você recebeu acesso às prisões da cidade <#${PRISOES_CHANNEL_ID}> !`,
                        ephemeral: true
                    });
                    console.log(`[SISTEMA DE ACESSO] ${member.user.tag} recebeu acesso.`);
                } catch (error) {
                    console.error('[SISTEMA DE ACESSO] Erro ao dar cargo de acesso:', error);
                    await interaction.editReply({
                        content: '<a:negativo:1397953861251104779> | Ocorreu um erro ao conceder seu acesso. Por favor, tente novamente.',
                        ephemeral: true
                    });
                }
                break;

            case 'remover_acesso':
                try {
                    // Verifica se o membro não tem o cargo
                    if (!member.roles.cache.has(ACESSO_ROLE_ID)) {
                        await interaction.editReply({
                            content: '<:alerta:1398025586675122170> | Você não possui acesso às prisões da cidade para remover!',
                            ephemeral: true
                        });
                        return;
                    }

                    await member.roles.remove(ACESSO_ROLE_ID);
                    await interaction.editReply({
                        content: '<a:negativo:1397953861251104779> | Seu Acesso às prisões da cidade foi removido !',
                        ephemeral: true
                    });
                    console.log(`[SISTEMA DE ACESSO] ${member.user.tag} removeu acesso.`);
                } catch (error) {
                    console.error('[SISTEMA DE ACESSO] Erro ao remover cargo de acesso:', error);
                    await interaction.editReply({
                        content: '<a:negativo:1397953861251104779> | Ocorreu um erro ao remover seu acesso. Por favor, tente novamente.',
                        ephemeral: true
                    });
                }
                break;
        }
    });
}

// Exporta a função setup para que o index.js possa chamá-la.
module.exports = { setup };