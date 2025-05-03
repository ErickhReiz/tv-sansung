const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const PORT = 5555;
const TV_IP = '192.168.15.5';
const APP_NAME = 'ControleServer';
const TOKEN_FILE = 'tv_token.json';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Add these variables at the top level after the existing constants
let activeWS = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Função para carregar o token salvo
function loadSavedToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            const data = fs.readFileSync(TOKEN_FILE, 'utf8');
            const tokenData = JSON.parse(data);
            return tokenData.data.token;
        }
    } catch (err) {
        console.error('[Token] Erro ao carregar token:', err);
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

// Add a new variable to store the token
let savedToken = loadSavedToken();

// Add this new object for app IDs after the commandMap
const appMap = {
    'APP_NETFLIX': '11101200001',
    'APP_YOUTUBE': '111299001912',
    'APP_SPOTIFY': '3201606009684',
    'APP_GLOBOPLAY': '3201908019022'
};

// Add this new function to handle WebSocket connection
function setupWebSocket() {
    const encodedAppName = Buffer.from(APP_NAME).toString('base64');
    const wsUrl = savedToken 
        ? `wss://${TV_IP}:8002/api/v2/channels/samsung.remote.control?name=${encodedAppName}&token=${savedToken}`
        : `ws://${TV_IP}:8001/api/v2/channels/samsung.remote.control?name=${encodedAppName}`;

    console.log(`[WebSocket] Iniciando conexão em: ${wsUrl}`);

    activeWS = new WebSocket(wsUrl, {
        rejectUnauthorized: false,
        handshakeTimeout: 30000
    });

    activeWS.on('message', (data) => {
        try {
            const response = JSON.parse(data.toString());
            
            if (response.data && response.data.token) {
                savedToken = response.data.token;
                saveToken({ data: { token: savedToken } });
                console.log('[WebSocket] Token saved:', savedToken);
            }
            
            if (response.event === 'ms.channel.connect') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('[WebSocket] Conexão estabelecida com a TV');
            }
        } catch (e) {
            console.error('[WebSocket] Error parsing message:', e);
        }
    });

    activeWS.on('open', () => {
        console.log(`[WebSocket] Conexão aberta com a TV (${TV_IP})`);
    });

    activeWS.on('error', (err) => {
        console.error('[WebSocket] Erro na conexão:', err);
        isConnected = false;
    });

    activeWS.on('close', () => {
        console.log('[WebSocket] Conexão fechada');
        isConnected = false;
        
        // Attempt to reconnect if not max attempts
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`[WebSocket] Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(setupWebSocket, 2000 * reconnectAttempts); // Exponential backoff
        }
    });
}

// Modified sendToTV function to use the persistent connection
async function sendToTV(command, isApp = false) {
    return new Promise((resolve, reject) => {
        if (!activeWS || !isConnected) {
            reject(new Error('Sem conexão com a TV'));
            return;
        }

        try {
            let payload;
            if (isApp) {
                payload = {
                    method: "ms.channel.emit",
                    params: {
                        event: "ed.apps.launch",
                        to: "host",
                        data: {
                            action_type: "DEEP_LINK",
                            appId: command,
                            metaTag: command
                        }
                    }
                };
            } else {
                payload = {
                    method: 'ms.remote.control',
                    params: {
                        Cmd: 'Click',
                        DataOfCmd: command,
                        Option: 'false',
                        TypeOfRemote: 'SendRemoteKey'
                    }
                };
            }

            console.log(`[WebSocket] Enviando ${isApp ? 'app' : 'comando'}: ${command}`);
            activeWS.send(JSON.stringify(payload));
            
            // Add a small delay to prevent flooding the TV with commands
            setTimeout(resolve, 100);
        } catch (error) {
            reject(error);
        }
    });
}

// Initialize WebSocket connection when server starts
setupWebSocket();

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
    'CHDOWN': 'KEY_CHDOWN',
    'MUTE': 'KEY_MUTE',
    'SOURCE': 'KEY_SOURCE',
    'MENU': 'KEY_MENU',
    'RETURN': 'KEY_RETURN',
    'CH_LIST': 'KEY_CH_LIST',
    'INFO': 'KEY_INFO',
    'GUIDE': 'KEY_GUIDE'
};

// Add a health check endpoint
app.get('/api/tv/status', (req, res) => {
    res.json({
        connected: isConnected,
        wsState: activeWS ? activeWS.readyState : 'CLOSED'
    });
});

// Modify the existing command endpoint
app.post('/api/tv/command', async (req, res) => {
    const { command } = req.body;
    
    try {
        // If not connected, try to reconnect
        if (!isConnected) {
            setupWebSocket();
            // Wait a bit for connection
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (command.startsWith('APP_')) {
            const appId = appMap[command];
            if (!appId) {
                throw new Error('App não suportado');
            }
            await sendToTV(appId, true);
        } else {
            const tvCommand = commandMap[command];
            if (!tvCommand) {
                throw new Error('Comando inválido');
            }
            await sendToTV(tvCommand, false);
        }
        
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
