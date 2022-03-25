import {AxiosRequestHeaders, AxiosResponse} from "axios";

const axios = require('axios').default;
import {Md5} from 'ts-md5/dist/md5';

export class DataLoader {
     ip: string;
     user: string;
     pass: string;
     cookie: string = '';

    constructor(ip: string, user: string, pass: string) {
        this.ip = ip;
        this.user = user;
        this.pass = pass;
    }

    async load(): Promise<WifiStatus> {
        if (this.cookie.length == 0) {
            let result = await this.login();
        }

        if (this.cookie.length > 0) {
            let result =  (await axios.post('http://' + this.ip + '/data/status.json',
                'operation=read',
                {headers: this.buildHeaders(this.cookie),}
            )).data as WifiStatus;
            if (!result.success){
                this.cookie = '';
            }
            return result;
        } else {
            this.cookie = '';
            return Promise.reject("login failed");
        }

    }

    private async login() {
        const initialResponse = await axios.get('http://' + this.ip);
        const setCookie:string[] = initialResponse.headers["set-cookie"] || [""];
        const cookieValue = setCookie[0].split(',')[0].split('=')[1].split(";")[0];
        this.cookie = cookieValue;
        const encodedPass = Md5.hashStr(Md5.hashStr(this.pass).toUpperCase()+':'+cookieValue).toUpperCase();
        const data = 'operation=login&encoded='+this.user+':'+encodedPass+'&nonce='+cookieValue;

        const loginResponse = await axios.post('http://' + this.ip + '/data/login.json',
            data,
            {headers: this.buildHeaders(cookieValue)});
    }

    private buildHeaders(cookieValue: string | undefined): AxiosRequestHeaders {
        return {
            'Cookie': 'COOKIE=' + cookieValue,
            'Referer': 'http://'+this.ip,
            'Origin': 'http://'+this.ip,
            'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept':'application/json, text/javascript, */*; q=0.01'
            };

    }
}

export interface WifiStatus {
    success: boolean,
    timeout: boolean,
    data: WiFiData,
    show5gFlag: boolean
}

export interface WiFiData {
    opMode: number,
    internet_status: string,
    phyconn: string,
    wireless_2g_enable: string,
    wireless_2g_encryption: boolean,
    wireless_5g_enable: string,
    wireless_5g_encryption: boolean,
    wirelessCount: number,
    wirelessGrid: WifiGridItem[],
    show2gFlag: boolean,
    show5gFlag: boolean

}

export interface WifiGridItem {
    mac: string,
    name: string,
    ip: string,
    ipaddr: string,
    type: string,
    conn_type: string
}
