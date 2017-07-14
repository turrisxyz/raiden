import { Injectable } from '@angular/core';
import { Http, Headers, RequestOptions, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/throw';
import 'rxjs/add/operator/catch';
import { RaidenConfig } from './raiden.config';
import { tokenabi } from './tokenabi';
import { Usertoken } from '../models/usertoken';
import { Channel } from '../models/channel';

@Injectable()
export class RaidenService {

    public tokenContract: any;
    public web3: any;
    public raidenAddress: string;

    constructor(private http: Http, private config: RaidenConfig) {
        this.web3 = this.config.web3;
        this.tokenContract = this.web3.eth.contract(tokenabi);
        this.initialiseRaidenAddress();
        this.getRaidenAddress();
    }

    public initialiseRaidenAddress(): Observable<any> {
        return this.http.get(`${this.config.apiCall}/address`)
        .map((response) => {
            return response.json().our_address;
        }).catch(this.handleError);
    }

    public getRaidenAddress() {
        this.initialiseRaidenAddress().subscribe((address) => {
            this.raidenAddress = address;
        });
    }

    public getChannels(): Observable<any> {
        return this.http.get(this.config.apiCall + '/channels')
        .map((response) => {
            const channelArray = <Array<any>>response.json();
            return channelArray;
        }).catch(this.handleError);
    }

    public getEvents(): Observable<any> {
        return this.http.get(`${this.config.apiCall}/events`)
        .map((response) => response.json()).catch(this.handleError);
    }

    public getTokenBalancesOf(raidenAddress: string): Observable<Usertoken[]> {
        return this.http.get(`${this.config.apiCall}/tokens`)
            .map((response) => {
                const tokenArray: Array<{address:string}> = response.json();
                let usertokens: Usertoken[] = [];
                // TODO: cache these usertokens, to avoid calling API multiple times
                for (const tokeninfo of tokenArray) {
                    try {
                        const tokenContractInstance = this.tokenContract.at(tokeninfo.address);
                        usertokens.push(new Usertoken(
                            tokeninfo.address,
                            tokenContractInstance.symbol(),
                            tokenContractInstance.name(),
                            tokenContractInstance.balanceOf(this.raidenAddress).toNumber()
                        ));
                    } catch (error) {
                        console.log("Error getting token", tokeninfo, error);
                    }
                }
                return usertokens;
            }).catch(this.handleError);
    }

    public getTokenNameAddresMappings() {
        return this.http.get(`${this.config.apiCall}/tokens`)
        .map((response) => {
            const tokenArray: Array<{address:string}> = response.json();
            let tokens: Array<{label,value}> = [];
            for (const tokeninfo of tokenArray) {
                try {
                    const tokenContractInstance = this.tokenContract.at(tokeninfo.address);
                    tokens.push({
                        'value': tokeninfo.address,
                        'label': tokenContractInstance.name()+" ("+tokeninfo.address+")"
                    });
                } catch (error) {
                    console.log("Error getting token", tokeninfo, error);
                }
            }
            return tokens;
        });
    }

    public openChannel(
        partnerAddress: string,
        tokenAddress: string,
        balance: number,
        settleTimeout: number): Observable<any> {
        console.log('Inside the open channel service');
        const data = {
            'partner_address': partnerAddress,
            'token_address': tokenAddress,
            'balance': balance,
            'settle_timeout': settleTimeout
        };
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const options = new RequestOptions({ headers: headers });
        return this.http.put(`${this.config.apiCall}/channels`,
                      JSON.stringify(data), options)
                      .map((response) => response.json())
                      .catch(this.handleError);

    }

    public initiateTransfer(
        tokenAddress: string,
        partnerAddress: string,
        amount: number,
        identifier: number): Observable<any> {
        const data = {
            'amount': amount,
            'identifier': identifier
        };
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const options = new RequestOptions({ headers: headers });
        console.log(`${this.config.apiCall}/transfers/${tokenAddress}/${partnerAddress}`);
        return this.http.post(
            `${this.config.apiCall}/transfers/${tokenAddress}/${partnerAddress}`, JSON.stringify(data), options)
            .map((response) => response.json()).catch(this.handleError);
    }

    public depositToChannel(channelAddress: string, balance: number): Observable<any> {
        const data = {
            'balance': balance
        };
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const options = new RequestOptions({ headers: headers });
        return this.http.patch(`${this.config.apiCall}/channels/${channelAddress}`,
                JSON.stringify(data), options)
            .map((response) => response.json()).catch(this.handleError);
    }

    public closeChannel(channelAddress: string): Observable<any> {
        const data = {
            'state': 'closed'
        };
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const options = new RequestOptions({ headers: headers });
        return this.http.patch(`${this.config.apiCall}/channels/${channelAddress}`,
                JSON.stringify(data), options)
            .map((response) => response.json())
            .catch(this.handleError);
    }

    public settleChannel(channelAddress: string): Observable<any> {
        const data = {
            'state': 'settled'
        };
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const options = new RequestOptions({ headers: headers });
        return this.http.patch(`${this.config.apiCall}/channels/${channelAddress}`,
                JSON.stringify(data), options)
            .map((response) => response.json())
            .catch(this.handleError);
    }

    public registerToken(tokenAddress: string): Observable<Usertoken> {
        return this.http.put(`${this.config.apiCall}/tokens/${tokenAddress}`, '{}')
            .map((response) => {
                this.tokenContract = this.web3.eth.contract(tokenabi);
                const tokenContractInstance = this.tokenContract.at(tokenAddress);
                return new Usertoken(
                    tokenAddress,
                    tokenContractInstance.symbol(),
                    tokenContractInstance.name(),
                    tokenContractInstance.balanceOf(this.raidenAddress).toNumber()
                );
            }).catch(this.handleError);
    }

    private handleError(error: Response | any) {
        // In a real world app, you might use a remote logging infrastructure
        let errMsg: string;
        if (error instanceof Response) {
          const body = error.json() || '';
          const err = body || JSON.stringify(body);
          errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
        } else {
          errMsg = error.message ? error.message : error.toString();
        }
        console.error(errMsg);
        return Observable.throw(errMsg);
    }

}
