import { Payment, payments, ECPair, Network, ECPairInterface, address } from 'bitcoinjs-lib';
import { environment } from '../environments/environment';
import { HttpClient } from '@angular/common/http';
import AES from 'crypto-js/aes';
import { Observable, of } from 'rxjs';

export const ONESATOSHI = 0.00000001;

export interface BitcoinSignService {
	sign(txhex: string, options: BitcoinSignOptions, callback?): Promise<string>;
}

export type BitcoinKeys = { private: string; public: string; pair: ECPairInterface };

export type BackupFileMultisig = {
	pubkeysrv: string;
	walletid: string;
	label: string;
	organization: string;
};

export type BackupFileSingle = {
	address: string;
	pubkeys: string[];
};

export type BackupFile = (BackupFileSingle | BackupFileMultisig) & {
	user: string;
	scripttype: BitcoinScriptType;
	encprivkey: string;
	pubkey: string;
};


export type BitcoinUTXO = { value: number; tx: string; n: number };

export type BitcoinScriptType = 'p2wsh' | 'p2sh' | 'p2sh-p2wsh';

export type BitcoinSignOptions = {
	seed?: string;
	wif?: string;
	n?: number;
	scripttype: BitcoinScriptType;
	utxos: BitcoinUTXO[];
	pubkeys: string[];
};

export function checkBitcoinAddress(addr: string, network = environment.network): boolean {
	try {
		address.toOutputScript(addr, network);
		return true;
	} catch (e) {
		return false;
	}
}

/* Decrypt key */
export function decryptKeys(encpriv: string, password: string): BitcoinKeys | null {
	const hex2a = function (hex) {
		let str = '';
		for (let i = 0; i < hex.length; i += 2)
			str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
		return str;
	};

	const privkeye = AES.decrypt(encpriv, password, { iv: password });
	const privkey = hex2a(privkeye.toString());

	let upair = null;
	try {
		upair = ECPair.fromWIF(privkey, environment.network);
	} catch (e) {
		return null;
	}

	const priv = upair.toWIF();
	const pub = upair.publicKey.toString('hex');

	return { private: priv, public: pub, pair: upair };
}

export function decryptBackup(backup: BackupFile, password: string, multisig: boolean = false): BitcoinKeys {
	if (backup === null)
		throw "XNJ";

	if (!('encprivkey' in backup) || !('pubkey' in backup))
		throw "XNJ";
	if (!multisig && !('address' in backup))
		throw "XNJ";
	if (multisig && !('walletid' in backup))
		throw "XNJ";

	const keys: BitcoinKeys = decryptKeys(backup.encprivkey, password);
	if (keys == null)
		throw "XWP";

	if (keys.public != backup.pubkey)
		throw "XWP";

	return keys;
}


export function toHexString(buffer: Buffer): string {
	return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

export function toByteArray(hexString: string): Buffer {
	const Buffer = require('safe-buffer').Buffer
	const result = Buffer.alloc(hexString.length / 2);
	let i = 0;
	while (hexString.length >= 2) {
		result[i] = parseInt(hexString.substring(0, 2), 16);
		i += 1;
		hexString = hexString.substring(2, hexString.length);
	}
	return result;
}

export function compressPublicKey(pk: string): string {
	return toHexString(ECPair.fromPublicKey(toByteArray(pk)).publicKey);
}

export type Scripts = {
	address: string;
	scripttype: BitcoinScriptType;
	p2sh?: Payment;
	p2wsh?: Payment;
};

export function prepareScripts(scripttype: BitcoinScriptType, n: number, pubkeys: string[], network: Network): Scripts {
	const pubkeysRaw = pubkeys.map(hex => Buffer.from(hex, 'hex'));
	const p2ms = payments.p2ms({ m: n, pubkeys: pubkeysRaw, network: network });

	switch (scripttype) {
		case 'p2sh': {
			const p2sh = payments.p2sh({ redeem: p2ms, network: network });
			const res: Scripts = {
				address: p2sh.address,
				scripttype: scripttype,
				p2sh: p2sh
			};
			return res;
		}

		case 'p2sh-p2wsh': {
			const p2wsh = payments.p2wsh({ redeem: p2ms, network: network });
			const p2sh = payments.p2sh({ redeem: p2wsh, network: network });
			const res: Scripts = {
				address: p2sh.address,
				scripttype: scripttype,
				p2sh: p2sh,
				p2wsh: p2wsh
			};
			return res;
		}

		case 'p2wsh': {
			const p2wsh = payments.p2wsh({ redeem: p2ms, network: network });
			const res: Scripts = {
				address: p2wsh.address,
				scripttype: scripttype,
				p2wsh: p2wsh
			};
			return res;
		}
	}
}


export function scriptTypeOfBitcoinScriptType(st: BitcoinScriptType) {
	switch (st) {
		case 'p2sh':
			return 'p2sh-p2pkh';
		case 'p2sh-p2wsh':
			return 'p2sh-p2wsh-p2pk';
		case 'p2wsh':
			return 'p2wsh-p2pkh';
	}
}

export function evaluteFee(fees, inputs, outputs, fast) {
	let speed = 'halfHourFee';
	if (fast) speed = 'fastestFee';

	return (outputs * 34 + inputs * 180 + 10) * fees[speed] / 100000000.0;
}


export interface Unspent {
	txid: string;
	vout: number;
	value: number;
	status: {
		confirmed: string;
	}
}

export function getUnspent(httpClient: HttpClient, address: string): Observable<Unspent[]> {
	return httpClient.get<Unspent[]>(`${environment.explorer}api/address/${address}/utxo`);
}

export function getBalance(httpClient: HttpClient, address: string): Observable<number> {
	return of(0.0);
}
export function getTransaction(httpClient: HttpClient, txid: string): Observable<string> {
	return of("");
}
export function broadcast(httpClient: HttpClient, txhex: string): Observable<string> {
	return of("");
}