// import { Psbt, ECPairInterface, Transaction, script } from 'bitcoinjs-lib';
// // import TransportU2F from "@ledgerhq/hw-transport-u2f";
// import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
// import Btc from "@ledgerhq/hw-app-btc";
// import {
// 	BitcoinSignService, BitcoinSignOptions, compressPublicKey,
// 	prepareScripts, toByteArray
// } from './bitcoin.helper';
// import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { Observable } from 'rxjs/internal/Observable';


// @Injectable()
// export class BitcoinLedgerService implements BitcoinSignService {
// 	defaultAccount: string;
// 	defaultPath: string;

// 	constructor(private http: HttpClient) {
// 		this.defaultAccount = '7276'; // HB
// 		this.defaultPath = "44'/" + (AppSettings.networkName == 'testnet' ? '1' : '0') + "'/" + this.defaultAccount + "'/0/0";
// 	}

// 	private rawTransactions(hashes: string[]): Observable<{ [txid: string]: string }> {
// 		return this.http.post<{ [txid: string]: string }>(AppSettings.apiUrl + '/blockchain/rawtransactions', { hashes: hashes })
// 			.pipe(unwrap('transactions'));
// 	}

// 	private getPublicKeyFromPath(path: string, ledgerWaitCallback) {
// 		if (!ledgerWaitCallback)
// 			ledgerWaitCallback = (phase, status) => { };

// 		ledgerWaitCallback(0, 'wait');

// 		return new Promise((resolve, reject) => {
// 			console.log('Ledger: - Transport - Connecting...');
// 			TransportWebUSB.create().then(transport => {
// 				console.log('Ledger: - Transport - Connected');
// 				ledgerWaitCallback(1, 'wait');

// 				console.log('Ledger: - BTC - Initalization...');
// 				const btc = new Btc(transport);
// 				console.log('Ledger: - BTC - Initialized');

// 				ledgerWaitCallback(2, 'wait');
// 				console.log('Ledger: - BTC - Getting public key...');
// 				btc.getWalletPublicKey(path, { verify: false, format: 'legacy' }).then(result => {
// 					console.log('Ledger: - BTC - Public key retrieved:', result.publicKey);
// 					const comppk = compressPublicKey(result.publicKey);
// 					ledgerWaitCallback(2, 'success');
// 					resolve(comppk);
// 				}).catch(err => {
// 					if (err.statusCode == 27010)
// 						ledgerWaitCallback(0, 'error');
// 					else if (err.id == 'U2F_5')
// 						ledgerWaitCallback(1, 'error');
// 					else
// 						ledgerWaitCallback(2, 'error');

// 					reject(err);
// 				});
// 			}).catch(err => {
// 				ledgerWaitCallback(0, 'error');
// 				reject(err);
// 			});
// 		});
// 	};

// 	getPublicKey(ledgerWaitCallback?: any) {
// 		return (this.getPublicKeyFromPath(this.defaultPath, ledgerWaitCallback) as Promise<string>);
// 	}

// 	sign(txhex: string, options: BitcoinSignOptions, ledgerWaitCallback): Promise<string> {
// 		if (!ledgerWaitCallback)
// 			ledgerWaitCallback = (phase, status) => { };

// 		let segwit = false;

// 		if (!('n' in options))
// 			options.n = 2;
// 		if (options.scripttype != 'p2sh')
// 			segwit = true;

// 		const walletScripts = prepareScripts(options.scripttype, options.n, options.pubkeys, AppSettings.network);

// 		return new Promise((resolve, reject) => {
// 			ledgerWaitCallback(1, 'wait');
// 			this.getPublicKey().then((publickey: string) => {
// 				ledgerWaitCallback(1, 'success');
// 				ledgerWaitCallback(2, 'wait');
// 				TransportWebUSB.create().then(transport => {
// 					const btc = new Btc(transport);

// 					/* Download utxo transaction raw */
// 					this.rawTransactions(options.utxos.map(utxo => utxo.tx)).subscribe(transactions => {
// 						/* Create inputs and serialized outputs */
// 						const inputs = options.utxos.map(utxo => [
// 							btc.splitTransaction(transactions[utxo.tx], Transaction.fromHex(transactions[utxo.tx]).hasWitnesses()),
// 							utxo.n,
// 							walletScripts.p2wsh.redeem.output.toString('hex'),
// 							// bitcoinjs.Transaction.fromHex(transactions[utxo.tx]).outs[utxo.n].sequence
// 						]);
// 						const paths = inputs.map(i => this.defaultPath);
// 						const txb = Psbt.fromHex(txhex, { network: AppSettings.network });
// 						const outshex = btc.serializeTransactionOutputs(btc.splitTransaction((txb as any).__CACHE.__TX.toHex(), true)).toString('hex');

// 						btc.signP2SHTransaction(inputs, paths, outshex, 0/*tx.locktime*/, 1 /*SIGHASH_ALL*/, segwit, 2).then(signatures => {
// 							/* Inject signatures */
// 							for (let j = 0; j < txb.inputCount; j++) {
// 								// eslint-disable-next-line @typescript-eslint/no-object-literal-type-assertion
// 								txb.signInput(j, {
// 									network: AppSettings.network,
// 									publicKey: toByteArray(publickey),
// 									sign: (hash) => script.signature.decode(toByteArray(signatures[j])).signature
// 								} as ECPairInterface);
// 							}

// 							ledgerWaitCallback(2, 'success');

// 							/* Build the transaction */
// 							resolve(txb.toHex());
// 						}).catch(err => {
// 							ledgerWaitCallback(2, 'error');
// 							return reject(err);
// 						});
// 					}, err => {
// 						// eslint-disable-next-line no-console
// 						console.log('Failed acquiring txhashes:', err);
// 						ledgerWaitCallback(2, 'error');
// 						return reject(err);
// 					});
// 				}).catch(err => {
// 					ledgerWaitCallback(2, 'error');
// 					return reject(err);
// 				})
// 			}).catch(err => {
// 				ledgerWaitCallback(1, 'error');
// 				return reject(err);
// 			});
// 		});
// 	}
// }