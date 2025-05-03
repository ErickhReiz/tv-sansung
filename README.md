# Controle Remoto para TV Samsung

Um controle remoto web para TVs Samsung que permite controlar sua TV através de qualquer dispositivo com navegador na mesma rede local.

## Funcionalidades

- Controle básico da TV (ligar/desligar, volume, navegação, etc.)
- Acesso rápido a aplicativos populares (Netflix, YouTube, Spotify, Globoplay)
- Controles adicionais (botões coloridos, teclado numérico, etc.)
- Interface responsiva otimizada para dispositivos móveis
- QR Code para compartilhar o controle com outros dispositivos
- Configuração fácil da URL do servidor

## Requisitos

- Node.js
- TV Samsung com suporte a controle remoto via rede (TVs Smart Samsung com sistema Tizen)
- TV e dispositivo de controle na mesma rede local

## Como usar

1. Clone este repositório:
   ```
   git clone https://github.com/seu-usuario/controle-tv-samsung.git
   cd controle-tv-samsung
   ```

2. Instale as dependências:
   ```
   npm install
   ```

3. Configure o IP da sua TV:
   Abra o arquivo `server.js` e altere a constante `TV_IP` para o endereço IP da sua TV:
   ```javascript
   const TV_IP = '192.168.15.5'; // Altere para o IP da sua TV
   ```

4. Inicie o servidor:
   ```
   node server.js
   ```

5. Acesse o controle remoto:
   Abra o navegador em qualquer dispositivo na mesma rede local e acesse:
   ```
   http://IP_DO_SEU_SERVIDOR:5555
   ```

6. Na primeira vez que você usar o controle, pode ser necessário aceitar a conexão na TV.

## Compartilhando o controle

Você pode compartilhar facilmente o controle com outros dispositivos na mesma rede:

1. Acesse a aba "Mais" no controle remoto
2. Escaneie o QR code com outro dispositivo
3. O novo dispositivo terá acesso ao controle remoto

## Personalização

Você pode personalizar a URL do servidor na aba "Mais" > "Configurações". Isso é útil se você estiver usando um IP diferente ou quiser acessar o controle de outra rede (com as configurações de rede apropriadas).

## Comandos suportados

O controle suporta diversos comandos para a TV Samsung, incluindo:

- Controles básicos: Power, Volume, Navegação
- Controles de mídia: Play, Pause, Avançar, Retroceder
- Botões coloridos: Vermelho (A), Verde (B), Amarelo (C), Azul (D)
- Aplicativos: Netflix, YouTube, Spotify, Globoplay
- Outros: Menu, Home, Voltar, Guia, Informações

## Tecnologias utilizadas

- Node.js com Express para o servidor
- WebSocket para comunicação com a TV
- HTML, CSS e JavaScript puro para o frontend
- Bootstrap Icons para ícones

## Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.