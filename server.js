const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const PORT = 5555;
const TV_IP = 'YOUR_TV_IP';
const APP_NAME = 'YOUR_APP_NAME';
const TOKEN_FILE = 'tv_token.json';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Função para carregar o token salvo
function loadSavedToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            const data = fs.readFileSync(TOKEN_FILE, 'utf8');
            const tokenData = JSON.parse(data);
            return tokenData.data.token;
        }
    } catch (err) {
        console.error('Erro ao carregar token:', err);
    }
    return null;
}

// Função para salvar o token
function saveToken(tokenData) {
    try {
        if (!tokenData || !tokenData.data || !tokenData.data.token) {
            console.error('Tentativa de salvar token inválido:', tokenData);
            return;
        }
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData));
        console.log('Token salvo com sucesso:', tokenData.data.token);
    } catch (err) {
        console.error('Erro ao salvar token:', err);
    }
}

// Função para enviar comandos para a TV via WebSocket
async function sendToTV(command) {
    return new Promise((resolve, reject) => {
        const encodedAppName = Buffer.from(APP_NAME).toString('base64');
        const savedToken = loadSavedToken();
        
        // Modify the WebSocket URL to include the token if we have one
        let wsUrl = `wss://${TV_IP}:8002/api/v2/channels/samsung.remote.control?name=${encodedAppName}`;
        if (savedToken) {
            wsUrl += `&token=${savedToken}`;
        }
        
        console.log(`[WebSocket] Tentando conectar em: ${wsUrl}`);
        console.log(savedToken ? '[WebSocket] Usando token salvo' : '[WebSocket] Sem token salvo');
        
        const ws = new WebSocket(wsUrl, {
            handshakeTimeout: 15000,
            perMessageDeflate: false,
            rejectUnauthorized: false
        });

        let isConnected = false;
        let timeoutId;

        ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                console.log('[WebSocket] Mensagem recebida:', JSON.stringify(response, null, 2));
                
                // Quando recebermos o ms.channel.connect da TV
                if (response.event === 'ms.channel.connect') {
                    if (response.data && response.data.token) {
                        console.log('[WebSocket] Novo token recebido:', response.data.token);
                        saveToken(response);
                    }
                    
                    if (!isConnected) {
                        isConnected = true;
                        // Agora sim enviamos o comando
                        const payload = {
                            method: 'ms.remote.control',
                            params: {
                                Cmd: 'Click',
                                DataOfCmd: command,
                                Option: 'false',
                                TypeOfRemote: 'SendRemoteKey'
                            }
                        };

                        console.log(`[WebSocket] Enviando comando: ${command}`);
                        ws.send(JSON.stringify(payload));
                    }
                }

                // Confirmação do comando
                if (response.event === 'ms.remote.control') {
                    console.log('[WebSocket] Comando confirmado pela TV');
                    resolve();
                    ws.close();
                }

                // Tratamento de erro
                if (response.event === 'ms.error') {
                    console.error('[WebSocket] Erro da TV:', response.data.message);
                    ws.close();
                    reject(new Error(response.data.message));
                }
            } catch (e) {
                console.log('[WebSocket] Mensagem não-JSON recebida:', data);
            }
        });

        ws.on('open', () => {
            console.log(`[WebSocket] Conexão aberta com a TV (${TV_IP})`);
            // Removemos o envio do handshake aqui
            // A TV irá enviar o ms.channel.connect automaticamente
        });

        ws.on('error', (err) => {
            console.error('[WebSocket] Erro na conexão:', err);
            clearTimeout(timeoutId);
            reject(err);
        });

        ws.on('close', (code, reason) => {
            console.log(`[WebSocket] Conexão fechada (code: ${code}, reason: ${reason})`);
            clearTimeout(timeoutId);
        });

        timeoutId = setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
                console.error('[WebSocket] Timeout ao conectar com a TV');
                ws.close(1000, 'Connection timeout');
                reject(new Error('Timeout ao conectar com a TV'));
            }
        }, 15000); // Aumentado para 15 segundos para dar mais tempo à autorização inicial
    });
}

// Mapeamento de comandos da interfe para comandos da TV
const commandMap = {
    'POWERON': 'KEY_POWERON',
    'POWEROFF': 'KEY_POWEROFF',
    'ENTER': 'KEY_ENTER',
    'VOLUP': 'KEY_VOLUP',
    'VOLDOWN': 'KEY_VOLDOWN',
    'UP': 'KEY_UP',
    'DOWN': 'KEY_DOWN',
    'LEFT': 'KEY_LEFT',
    'RIGHT': 'KEY_RIGHT',
    'CHUP': 'KEY_CHUP',
    'CHDOWN': 'KEY_CHDOWN'
};

// Endpoint para controle da TV
app.post('/api/tv/command', async (req, res) => {
    const { command } = req.body;
    
    try {
        if (!commandMap[command]) {
            throw new Error('Comando inválido');
        }

        await sendToTV(commandMap[command]);
        
        res.json({
            success: true,
            message: `Comando ${command} enviado com sucesso`
        });
    } catch (error) {
        console.error('Erro ao enviar comando:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao enviar comando para a TV'
        });
    }
});

// Rota para servir o frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar o servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://192.168.15.14:${PORT}`);
    console.log('Acessível em qualquer dispositivo da rede local');
    console.log(`Tentando controlar TV em: ${TV_IP}`);
}); 
