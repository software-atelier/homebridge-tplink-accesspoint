import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig
} from "homebridge";
import {Characteristic} from "hap-nodejs"

import {DataLoader, WifiGridItem} from './dataLoader'
import {Client, WiFiConfig} from "./config";
const PLUGIN_NAME = "homebridge-tplink-accesspoint";
const PLATFORM_NAME = "TPLinkAccessPoint";

let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, ExampleDynamicPlatform);
};

class ExampleDynamicPlatform implements DynamicPlatformPlugin {

  private readonly log: Logging;
  private readonly api: API;
  private readonly dataLoader: DataLoader
  private readonly wifiConfig: WiFiConfig
  private readonly uuidToAccessory: Map<string,PlatformAccessory>;

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;

    this.wifiConfig = config as WiFiConfig;
    this.dataLoader = new DataLoader(this.wifiConfig.ip, this.wifiConfig.user, this.wifiConfig.pass);
    this.uuidToAccessory = new Map<string, PlatformAccessory>();

    log.info("Initializing Access Point Plugin");

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */

    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.info("TP-Link Access Point Plugin finished initialized!");
      let timerId = setInterval(() => this.updateState(), 3000);
    });
  }

  async updateState() {
    this.dataLoader.load().then(value => {
      if (value.success){
        this.removeAccessories();
        this.installNewAccessories(value.data.wirelessGrid);
        this.updateAccessoryStates(value.data.wirelessGrid)
      }
      else{
        this.log("failed...");
        // TODO delay reauthenticating. Otherwise noone will be able to log in on the routers web interface.
      }
    }).catch(reason => {
        this.log(reason);
    })
  }

  private isGridItemEnabled(gridItem: WifiGridItem){
    return this.wifiConfig.clients.filter(client => {
      switch (client.identifier) {
        case "name":
          return client.name == gridItem.name && client.enabled;
        case "ip":
          return client.ip == gridItem.ip && client.enabled;
        case "mac":
          return client.mac == gridItem.mac && client.enabled;
        default:
          return false;
      }
    }).length > 0;
  }

  private getUUIDFromClient(client: Client){
    switch (client.identifier) {
      case "name":
        return hap.uuid.generate(client.name);
      case "ip":
        return hap.uuid.generate(client.ip);
      case "mac":
        return hap.uuid.generate(client.mac);
      default:
        return hap.uuid.generate(client.mac);
    }
  }

  private getClientConfigFromGridItem(gridItem: WifiGridItem){
    return this.wifiConfig.clients.filter(client => {
      switch (client.identifier) {
        case "name":
          return client.name == gridItem.name;
        case "ip":
          return client.ip == gridItem.ip;
        case "mac":
          return client.mac == gridItem.mac;
        default:
          return client.mac == gridItem.mac;
      }
    })[0] || undefined;
  }

  private getClientConfigFromAccessory(accessory: PlatformAccessory){
    return this.wifiConfig.clients.filter(client => {
      switch (client.identifier) {
        case "name":
          return this.getUUIDFromClient(client) == accessory.UUID;
        case "ip":
          return this.getUUIDFromClient(client) == accessory.UUID;
        case "mac":
          return this.getUUIDFromClient(client) == accessory.UUID;
        default:
          return false;
      }
    })[0] || undefined;
  }

  private getAccessoryForGridItem(gridItem: WifiGridItem){
    let conf = this.getClientConfigFromGridItem(gridItem);
    let uuid = this.getUUIDFromClient(conf);
    return this.uuidToAccessory.get(uuid!);
  }

  private installNewAccessories(gridItems: WifiGridItem[]){
    gridItems.forEach(gridItem => {
      if (this.isGridItemEnabled(gridItem) && !this.getAccessoryForGridItem(gridItem)){
          this.log("adding "+gridItem.name);
          this.addAccessory(gridItem);
      }
    });
  }

  private isKnownInGrid(accessory: PlatformAccessory, gridItems: WifiGridItem[]){
    return gridItems.filter(gridItem => {
      let clientConfig = this.getClientConfigFromGridItem(gridItem);
      if (clientConfig){
        let uuid = this.getUUIDFromClient(clientConfig);
        return accessory.UUID == uuid;
      }
      return false;
    }).length > 0
  }

  private updateAccessoryStates(gridItems: WifiGridItem[]){
    this.uuidToAccessory.forEach((accessory) => {
        this.setOccupancySensor(accessory, this.isKnownInGrid(accessory,gridItems));
    })
  }

  private setOccupancySensor(accessory: PlatformAccessory, value: boolean) {
    //this.log("Updating "+accessory.displayName+" "+value);
    accessory.getService(hap.Service.OccupancySensor)?.setCharacteristic(Characteristic.OccupancyDetected, value);
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log("Configuring accessory %s", accessory.displayName);
    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log("%s identified!", accessory.displayName);
    });
    this.setOccupancySensor(accessory,true);
    this.uuidToAccessory.set(accessory.UUID, accessory);
  }

  private addAccessory(gridItem: WifiGridItem) {
    this.log.info("Adding new accessory with name %s", gridItem.name);
    let clientConfig = this.getClientConfigFromGridItem(gridItem);
    const uuid = this.getUUIDFromClient(clientConfig);
    const accessory = new Accessory(gridItem.name, uuid);
    accessory.addService(hap.Service.OccupancySensor, gridItem.name);
    this.configureAccessory(accessory); // abusing the configureAccessory here
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }

  private removeAccessories() {
    let remove: string[] = [];
    this.uuidToAccessory.forEach((accessory, key) => {
      if (!this.getClientConfigFromAccessory(accessory)?.enabled){
        this.log.info("Removing accessory");
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        remove.push(key);
      }
    });
    remove.forEach(key => this.uuidToAccessory.delete(key));
  }
}
