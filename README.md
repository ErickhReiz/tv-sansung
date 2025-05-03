# Controle Remoto TV Samsung

Interface web para controlar sua TV Samsung através da rede local.

## Requisitos

- Node.js instalado
- TV Samsung na mesma rede local
- Acesso à rede local

## Instalação

1. Clone ou baixe este repositório
2. Instale as dependências:```bash
npm install
```

## Uso

1. Inicie o servidor:
```bash
npm start
```

2. Acesse a interface web:
- No seu computador: http://localhost:5555
- No seu celular: http://192.168.15.14:5555

## Funcionalidades

- Ligar/Desligar TV
- Controle de Volume
- Controle de Canais
- Navegação (Setas)
- Botão OK

## Notas

- Certifique-se de que sua TV Samsung está na mesma rede local
- O servidor está configurado para rodar na porta 5555
- A interface é responsiva e funciona em dispositivos móveis 


🛠️ Enviando Comandos
## Formato do Payload
```json
{
    "method": "ms.remote.control",
    "params": {
        "Cmd": "Click",
        "DataOfCmd": "KEY_VOLUMEDOWN",
        "Option": "false",
        "TypeOfRemote": "SendRemoteKey"
    }
}
```
## Exemplo de Envio

```javascript
const payload = {
    method: 'ms.remote.control',
    params: {
        Cmd: 'Click',
        DataOfCmd: 'KEY_VOLUMEDOWN',
        Option: 'false',
        TypeOfRemote: 'SendRemoteKey'
    }
};
ws.send(JSON.stringify(payload));
```
## 📚 Lista de Comandos Comuns
```bash
KEY_POWER: Alterna o estado de energia da TV

KEY_VOLUP: Aumenta o volume

KEY_VOLDOWN: Diminui o volume

KEY_MUTE: Ativa/desativa o mudo

KEY_CHUP: Avança o canal

KEY_CHDOWN: Retrocede o canal

KEY_HOME: Retorna à tela inicial

KEY_MENU: Abre o menu

KEY_SOURCE: Alterna a fonte de entrada

KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT: Navegação

KEY_ENTER: Seleciona/Confirma

KEY_BACK: Retorna à tela anterior
```