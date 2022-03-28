const { HomebridgePluginUiServer, RequestError } = require('@homebridge/plugin-ui-utils');
const {DataLoader} = require('../dist/dataLoader')

class PluginUiServer extends HomebridgePluginUiServer {
    constructor() {
        // super() MUST be called first
        super();

        // handle request for the /token route
        this.onRequest('/clients', this.loadClients.bind(this));

        // this MUST be called when you are ready to accept requests
        this.ready();
    }

    isSame(gridItem, client){
        switch (client.identifier) {
            case "ip":
                return client.ip == gridItem.ip;
            case "mac":
                return client.mac == gridItem.mac;
            case "name":
                return client.name == gridItem.name;
            default:
                return client.mac == gridItem.mac;
        }
    }

    async loadClients(payload) {
        try {
            var dataLoader = new DataLoader(payload.ip, payload.user, payload.pass);
            var data = await dataLoader.load();
            if (!payload.clients) payload.clients = [];
            const result = [];
            for (let client of payload.clients){
                result.push(client);
            }

            for (let gridItem of data.data.wirelessGrid){
                if (result.filter(client => this.isSame(gridItem, client)).length == 0){
                    result.push({
                        name: gridItem.name,
                        ip: gridItem.ip,
                        mac: gridItem.mac,
                        identifier: 'mac',
                        enabled: false
                    });
                }
            }

            return result;
        } catch (e) {
            throw new RequestError('Failed to Load Clients', { message: e.message });
        }

    }
}

(() => {
    return new PluginUiServer();
})();
