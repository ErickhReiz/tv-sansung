# Samsung TV Control Server

A simple Node.js server to control Samsung Smart TVs over the network using WebSockets.

## Features

- Control Samsung Smart TVs using WebSocket API
- Persistent connection with automatic reconnection
- Launch native apps and web URLs
- Save TV token for secure connections
- Web interface for mobile control
- Test panel for debugging

## Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd samsung-tv-control
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure your TV's IP address:
   - Edit the `TV_IP` variable in `server.js`
   - Or use the web interface to update it
   - Or use the `/api/tv/ip` endpoint

4. Start the server:
   ```
   node server.js
   ```

## Production Deployment

For production deployment, use PM2:

1. Install PM2 globally:
   ```
   npm install -g pm2
   ```

2. Start the server using PM2:
   ```
   pm2 start ecosystem.config.js
   ```

3. Set up PM2 to start on boot:
   ```
   pm2 startup
   pm2 save
   ```

## API Endpoints

- `GET /api/tv/status` - Check TV connection status
- `POST /api/tv/command` - Send a command to the TV
- `POST /api/tv/ip` - Update the TV's IP address
- `POST /api/tv/connect` - Manually initiate connection to the TV

## Web Interfaces

- `/` - Main remote control interface
- `/test-panel.html` - Test panel for debugging

## File Permissions

Make sure the following files have proper read/write permissions:
- `tv_token.json` - Stores the TV authentication token
- `tv_ip.json` - Stores the TV IP address

## Supported Commands

See the `commandMap` and `appMap` objects in `server.js` for a full list of supported commands and apps.
