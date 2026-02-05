"use strict";

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');
const { Events } = require('./wsCommunication.js');
const { readConfig } = require('./configuration.js');
const WebSocket = require('ws');

const modulesCache = new Map();

function startDebugging(port, queuedEvents, clientConn, ip, mdl, inDebug, appControlData, isAnotherApp, attempts) {
    if (!attempts) attempts = 1;
    if (!isAnotherApp) inDebug.tizenDebug = true;
    try {
        CDP({ port, host: ip, local: true }, (client) => {
            client.Runtime.enable();
            client.Debugger.enable();

            client.on('Runtime.executionContextCreated', (msg) => {
                if (!mdl.evaluateScriptOnDocumentStart && mdl.name !== '') {
                    const expression = `
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/${mdl.fullName}/${mdl.mainFile}?v=${Date.now()}';
                    document.head.appendChild(script);
                    `;
                    client.Runtime.evaluate({ expression, contextId: msg.context.id });
                } else if (mdl.name !== '' && mdl.evaluateScriptOnDocumentStart) {
                    // For evaluateScriptOnDocumentStart, we need to:
                    // 1. Register the script for future navigations
                    // 2. Execute it immediately on the current page
                    const cache = modulesCache.get(mdl.fullName);
                    const clientConnection = clientConn.get('wsConn');
                    
                    const executeScript = (scriptCode) => {
                        // Register for future page loads
                        client.Page.addScriptToEvaluateOnNewDocument({ expression: scriptCode });
                        // Also execute immediately on current page
                        client.Runtime.evaluate({ expression: scriptCode, contextId: msg.context.id });
                    };
                    
                    if (cache) {
                        executeScript(cache);
                        sendClientInformation(clientConn, clientConnection.Event(Events.LaunchModule, mdl.fullName));
                    } else {
                        fetch(`https://cdn.jsdelivr.net/${mdl.fullName}/${mdl.mainFile}`).then(res => res.text()).then(modFile => {
                            modulesCache.set(mdl.fullName, modFile);
                            executeScript(modFile);
                            sendClientInformation(clientConn, clientConnection.Event(Events.LaunchModule, mdl.fullName));
                        }).catch(e => {
                            const errorScript = `alert("Failed to load module: '${mdl.fullName}'. Please relaunch TizenBrew to try again.")`;
                            executeScript(errorScript);
                            sendClientInformation(clientConn, clientConnection.Event(Events.LaunchModule, mdl.fullName));
                        });
                    }
                }
            });

            client.on('disconnect', () => {
                if (isAnotherApp) return;

                inDebug.tizenDebug = false;
                inDebug.webDebug = false;
                inDebug.rwiDebug = false;

                mdl.fullName = '';
                mdl.name = '';
                mdl.appPath = '';
                mdl.moduleType = '';
                mdl.packageType = '';
                mdl.serviceFile = '';
                mdl.mainFile = '';
            });

            if (!isAnotherApp) {
                const clientConnection = clientConn.get('wsConn');
                if (appControlData.module) {
                    const data = clientConnection.Event(Events.CanLaunchModules, {
                        type: 'appControl',
                        module: appControlData.module,
                        args: appControlData.args
                    });
                    sendClientInformation(clientConn, data);
                } else {
                    const config = readConfig();
                    if (config.autoLaunchModule) {
                        const data = clientConnection.Event(Events.CanLaunchModules, {
                            type: 'autolaunch',
                            module: config.autoLaunchModule
                        });

                        sendClientInformation(clientConn, data);

                    } else {
                        const data = clientConnection.Event(Events.CanLaunchModules, null);
                        sendClientInformation(clientConn, data);
                    }
                }
            }
            if (!isAnotherApp) inDebug.webDebug = true;
            appControlData = null;
        }).on('error', (err) => {
            if (attempts >= 15) {
                if (!isAnotherApp) {
                    clientConn.send(clientConn.Event(Events.Error, 'Failed to connect to the debugger'));
                    inDebug.tizenDebug = false;
                    return;
                } else return;
            }
            attempts++;
            setTimeout(() => startDebugging(port, queuedEvents, clientConn, ip, mdl, inDebug, appControlData, isAnotherApp, attempts), 750)
        });
    } catch (e) {
        if (attempts >= 15) {
            if (!isAnotherApp) {
                clientConn.send(clientConn.Event(Events.Error, 'Failed to connect to the debugger'));
                inDebug.tizenDebug = false;
                return;
            } else return;
        }
        attempts++;
        setTimeout(() => startDebugging(port, queuedEvents, clientConn, ip, mdl, inDebug, appControlData, isAnotherApp, attempts), 750)
        return;
    }
}

function sendClientInformation(clientConn, data) {
    const clientConnection = clientConn.get('wsConn');
    if ((clientConnection && clientConnection.connection && (clientConnection.connection.readyState !== WebSocket.OPEN && !clientConnection.isReady)) || !clientConnection) {
        return setTimeout(() => sendClientInformation(clientConn, data), 50);
    }
    setTimeout(() => {
        clientConnection.send(data);
    }, 500);
}

module.exports = startDebugging;