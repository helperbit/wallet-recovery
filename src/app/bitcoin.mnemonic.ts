import { ECPair, Psbt } from 'bitcoinjs-lib';
import { mnemonicToSeedSync } from 'bip39';
import { fromSeed } from 'bip32';
import { BitcoinSignService, BitcoinSignOptions, BitcoinKeys } from './bitcoin.helper';
import { environment } from '../environments/environment';
import { Injectable } from '@angular/core';


/* Return the keypair from a mnemonic */
export function mnemonicToKeys(secret: string): BitcoinKeys {
	const fixSeed = function (seed) {
		return seed
			.replace('%20', ' ')
			.replace('  ', ' ')
			.replace('\n', '')
			.replace('\r', '')
			.trim();
	};

	const seed = mnemonicToSeedSync(fixSeed(secret));
	const hd = ECPair.fromWIF(fromSeed(seed, environment.network).toWIF(), environment.network);
	const priv1 = hd.toWIF();
	const pub1 = hd.publicKey.toString('hex');
	return { private: priv1, public: pub1, pair: hd };
}


export function signMnemonic(txhex: string, options: BitcoinSignOptions): Promise<string> {
	if ('seed' in options)
		options.wif = mnemonicToKeys(options.seed).private;

	return new Promise((resolve, reject) => {
		const txb = Psbt.fromHex(txhex, { network: environment.network });
		const upair = ECPair.fromWIF(options.wif, environment.network);

		txb.signAllInputs(upair);
		resolve(txb.toHex());
	});
}
