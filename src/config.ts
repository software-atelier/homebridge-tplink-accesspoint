import {PlatformConfig} from "homebridge";

export interface WiFiConfig extends PlatformConfig{
    ip: string,
    user: string,
    pass: string,
    clients: Client[]
}

export interface Client{
    name: string,
    ip: string,
    mac: string,
    identifier: string,
    enabled: boolean
}
