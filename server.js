const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = 5555;
let TV_IP = '192.168.15.5';
const APP_NAME = 'ControleServer';
const TOKEN_FILE = 'tv_token.json';
const IP_CONFIG_FILE = 'tv_ip.json';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Add these variables at the top level after the existing constants
let activeWS = null;
let isConnected = false;
let isConnecting = false; // Flag to prevent multiple connection attempts
let reconnectAttempts = 0;
let authorizationPending = false; // Flag to track if authorization is pending
const MAX_RECONNECT_ATTEMPTS = 5;

// Helper function for sleep/delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to validate IP address
function isValidIP(ip) {
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
}

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
    'APP_NETFLIX': { type: 'native', id: '11101200001' },
    'APP_YOUTUBE': { type: 'native', id: '111299001912' },
    'APP_SPOTIFY': { type: 'web', url: 'https://open.spotify.com' },
    'APP_GLOBOPLAY': { type: 'web', url: 'https://globoplay.globo.com' }
};

// Add function to load saved IP
function loadSavedIP() {
    try {
        if (fs.existsSync(IP_CONFIG_FILE)) {
            const data = fs.readFileSync(IP_CONFIG_FILE, 'utf8');
            const ipData = JSON.parse(data);
            
            // Validate the loaded IP
            if (isValidIP(ipData.ip)) {
                return ipData.ip;
            } else {
                console.error('[Config] IP carregado inválido:', ipData.ip);
                return TV_IP; // Return default if invalid
            }
        }
    } catch (err) {
        console.error('[Config] Erro ao carregar IP:', err);
    }
    return TV_IP; // Return default if not found
}

// Add function to save IP
function saveIP(ip) {
    try {
        fs.writeFileSync(IP_CONFIG_FILE, JSON.stringify({ ip }));
        console.log('[Config] IP salvo com sucesso:', ip);
        return true;
    } catch (err) {
        console.error('[Config] Erro ao salvar IP:', err);
        return false;
    }
}

// Load saved IP on startup
TV_IP = loadSavedIP();

// Add this new function to check if TV is reachable before attempting WebSocket connection
async function isTVReachable(ip) {
    return new Promise((resolve) => {
        console.log(`[Network] Verificando se a TV está acessível em ${ip}:8001...`);
        
        const req = http.get(`http://${ip}:8001/api/v2/`, (res) => {
            console.log(`[Network] TV respondeu com status: ${res.statusCode}`);
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    console.log(`[Network] TV encontrada: ${info.device?.name || 'Desconhecido'}`);
                    console.log(`[Network] Status da TV: ${info.device?.PowerState || 'Desconhecido'}`);
                    resolve(true);
                } catch (e) {
                    console.log('[Network] Resposta recebida, mas não é um JSON válido');
                    resolve(true); // Still reachable, just not parseable
                }
            });
        });
        
        req.on('error', (err) => {
            console.error(`[Network] Erro ao conectar com a TV: ${err.message}`);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            console.error('[Network] Timeout ao tentar conectar com a TV');
            req.destroy();
            resolve(false);
        });
    });
}

// Modify setupWebSocket to check if TV is reachable first
async function setupWebSocket() {
    // If already connecting, don't try to connect again
    if (isConnecting) {
        console.log('[WebSocket] Conexão já em andamento, aguardando...');
        return;
    }
    
    isConnecting = true;
    
    try {
        // Validate IP before connecting
        if (!isValidIP(TV_IP)) {
            console.error('[WebSocket] IP inválido, não é possível conectar:', TV_IP);
            isConnecting = false;
            return;
        }
        
        // Check if TV is reachable before attempting WebSocket connection
        const reachable = await isTVReachable(TV_IP);
        if (!reachable) {
            console.error('[WebSocket] TV não está acessível. Verifique se está ligada e na mesma rede.');
            isConnecting = false;
            return;
        }
        
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
                console.log('[WebSocket] Mensagem recebida:', JSON.stringify(response));
                
                if (response.data && response.data.token) {
                    savedToken = response.data.token;
                    saveToken({ data: { token: savedToken } });
                    console.log('[WebSocket] Token saved:', savedToken);
                    authorizationPending = false;
                }
                
                if (response.event === 'ms.channel.connect') {
                    isConnected = true;
                    reconnectAttempts = 0;
                    authorizationPending = false;
                    console.log('[WebSocket] Conexão estabelecida com a TV');
                }
                
                // Check for authorization required message
                if (response.event === 'ms.channel.unauthorized') {
                    console.log('[WebSocket] Autorização necessária! Por favor, aceite a conexão na TV.');
                    console.log('[WebSocket] Procure por uma mensagem na tela da TV e pressione OK no controle remoto da TV.');
                    authorizationPending = true;
                }
            } catch (e) {
                console.error('[WebSocket] Error parsing message:', e);
            }
        });

        activeWS.on('open', () => {
            console.log(`[WebSocket] Conexão aberta com a TV (${TV_IP})`);
            isConnecting = false;
        });

        activeWS.on('error', (err) => {
            console.error('[WebSocket] Erro na conexão:', err);
            isConnected = false;
            isConnecting = false;
        });

        activeWS.on('close', (code, reason) => {
            console.log(`[WebSocket] Conexão fechada com código: ${code}, razão: ${reason || 'Nenhuma razão fornecida'}`);
            isConnected = false;
            isConnecting = false;
            
            // Attempt to reconnect if not max attempts
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = 2000 * reconnectAttempts;
                console.log(`[WebSocket] Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em ${delay}ms`);
                
                setTimeout(async () => {
                    // Check if still disconnected before attempting reconnect
                    if (!isConnected && !isConnecting) {
                        await setupWebSocket();
                    }
                }, delay);
            }
        });
    } catch (error) {
        console.error('[WebSocket] Erro ao configurar conexão:', error);
        isConnecting = false;
    }
}

// Modified sendToTV function to use the persistent connection
async function sendToTV(command, appInfo = null) {
    return new Promise((resolve, reject) => {
        if (!activeWS || !isConnected) {
            reject(new Error('Sem conexão com a TV'));
            return;
        }

        try {
            let payload;
            
            if (appInfo) {
                if (appInfo.type === 'native') {
                    payload = {
                        method: "ms.channel.emit",
                        params: {
                            event: "ed.apps.launch",
                            to: "host",
                            data: {
                                action_type: "DEEP_LINK",
                                appId: appInfo.id,
                                metaTag: appInfo.id
                            }
                        }
                    };
                } else if (appInfo.type === 'web') {
                    payload = {
                        method: 'ms.webapis.application.launch',
                        params: {
                            appType: 2,
                            url: appInfo.url
                        }
                    };
                }
                console.log(`[WebSocket] Enviando ${appInfo.type === 'native' ? 'app' : 'web URL'}: ${appInfo.type === 'native' ? appInfo.id : appInfo.url}`);
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
                console.log(`[WebSocket] Enviando comando: ${command}`);
            }

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
app.get('/api/tv/status', async (req, res) => {
    // Check if TV is reachable
    const reachable = await isTVReachable(TV_IP);
    
    res.json({
        connected: isConnected,
        reachable: reachable,
        wsState: activeWS ? activeWS.readyState : 'CLOSED',
        tvIP: TV_IP,
        reconnectAttempts,
        authorizationPending
    });
});

// Add a new endpoint to check TV reachability
app.get('/api/tv/check', async (req, res) => {
    try {
        const reachable = await isTVReachable(TV_IP);
        
        if (reachable) {
            res.json({
                success: true,
                message: 'TV está acessível',
                ip: TV_IP
            });
        } else {
            res.json({
                success: false,
                message: 'TV não está acessível. Verifique se está ligada e na mesma rede.',
                ip: TV_IP
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Erro ao verificar TV: ${error.message}`,
            ip: TV_IP
        });
    }
});

// Modify the existing command endpoint
app.post('/api/tv/command', async (req, res) => {
    const { command } = req.body;
    
    try {
        // If not connected, try to reconnect
        if (!isConnected) {
            await setupWebSocket();
            // Wait a bit for connection
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (command.startsWith('APP_')) {
            const appInfo = appMap[command];
            if (!appInfo) {
                throw new Error('App não suportado');
            }
            await sendToTV(null, appInfo);
        } else {
            const tvCommand = commandMap[command];
            if (!tvCommand) {
                throw new Error('Comando inválido');
            }
            await sendToTV(tvCommand);
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

// Add endpoint to update TV IP
app.post('/api/tv/ip', (req, res) => {
    const { ip } = req.body;
    
    if (!ip || !isValidIP(ip)) {
        return res.status(400).json({
            success: false,
            message: 'IP inválido'
        });
    }
    
    // Update IP
    TV_IP = ip;
    
    // Save IP to file
    const saved = saveIP(ip);
    
    // Close existing connection
    if (activeWS) {
        activeWS.close();
    }
    
    // Reset connection state
    isConnected = false;
    reconnectAttempts = 0;
    
    // Setup new connection with new IP
    setupWebSocket();
    
    res.json({
        success: true,
        message: 'IP da TV atualizado com sucesso',
        ip: TV_IP,
        saved
    });
});

// Add a manual connect endpoint
app.post('/api/tv/connect', async (req, res) => {
    // Reset connection state
    reconnectAttempts = 0;
    
    // Setup new connection
    await setupWebSocket();
    
    res.json({
        success: true,
        message: 'Tentando conectar à TV...',
        ip: TV_IP
    });
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
