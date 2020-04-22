import { Component } from '@angular/core';
import { of, Observable } from 'rxjs';
import { Unspent, BackupFile, checkBitcoinAddress, BitcoinKeys, decryptBackup, getTransaction, 
	BackupFileSingle, getUnspent, prepareScripts, BackupFileMultisig } from './bitcoin.helper';
import { environment } from 'src/environments/environment';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { mnemonicToKeys } from './bitcoin.mnemonic';
import { HttpClient } from '@angular/common/http';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {
	activeSection: string = 'home';

	modelUser: {
		mnemonic: string;
		backup: BackupFile;
		backupPass: string;
		destination: string;
	};

	modelNPO: {
		destination: string;
		admins: {
			backup: BackupFile;
			backupPass: string;
		}[];
	};

	constructor(private httpClient: HttpClient) {
		this.modelUser = {
			mnemonic: '',
			backup: null,
			backupPass: '',
			destination: ''
		};
		this.modelNPO = {
			admins: [{
				backup: null,
				backupPass: ''
			}, {
				backup: null,
				backupPass: ''
			}, {
				backup: null,
				backupPass: ''
			}],
			destination: ''
		};
	}


	private prepareInput(utx: Unspent, backup: BackupFile, pubkeys: string[], n: number): Promise<any> {
		return new Promise((resolve, reject) => {
			const input: any = { hash: utx.txid, index: utx.vout };
			getTransaction(this.httpClient, input.hash).subscribe(hex => {
				const txraw = Buffer.from(hex, 'hex');
				const utxraw: any = Transaction.fromBuffer(txraw).outs[input.index];
				delete utxraw.address;
				utxraw.script = Buffer.from(utxraw.script, 'hex');
				let sc = prepareScripts(backup.scripttype, n, pubkeys, environment.network);

				switch (backup.scripttype) {
					case 'p2wsh':
						input.witnessUtxo = utxraw;
						input.witnessScript = sc.p2wsh.redeem.output;
						break;
					case 'p2sh-p2wsh':
						input.witnessUtxo = utxraw;
						input.witnessScript = sc.p2wsh.redeem.output;
						input.redeemScript = sc.p2sh.redeem.output;
						break;
					case 'p2sh':
						input.nonWitnessUtxo = txraw;
						input.redeemScript = sc.p2sh.redeem.output;
						break;
				}

				return resolve(input);
			}, (error) => {
				return reject(error);
			});
		});
	}

	submitUser() {
		let keys: BitcoinKeys[];
		console.log(this.modelUser);

		if (!checkBitcoinAddress(this.modelUser.destination))
			return alert('Invalid destination address');

		if (!this.modelUser.backup)
			return alert('Invalid backup file');

		try {
			keys.push(decryptBackup(this.modelUser.backup, this.modelUser.backupPass));
		} catch (err) {
			switch (err) {
				case 'XNJ':
					return alert('Invalid backup file');
				case 'XWP':
					return alert('Invalid backup password');
			}
		}

		try {
			keys.push(mnemonicToKeys(this.modelUser.mnemonic));
		} catch (err) {
			return alert('Invalid mnemonic');
		}

		if ((this.modelUser.backup as BackupFileSingle).pubkeys.indexOf(keys[1].public) == -1)
			return alert("Invalid mnemonic");

		const pubkeys = (this.modelUser.backup as BackupFileSingle).pubkeys;

		getUnspent(this.httpClient, (this.modelUser.backup as BackupFileSingle).address).subscribe(unspents => {
			if (unspents.length == 0)
				return alert('Address ' + (this.modelUser.backup as BackupFileSingle).address + ' is empty');

			const tx = new Psbt({ network: environment.network });
			const inputsPreparedPromise = unspents.map(u => {
				return this.prepareInput(u, this.modelUser.backup, pubkeys, 2);
			})
			Promise.all(inputsPreparedPromise).then(ll => {
				ll.forEach(i => tx.addInput(i));

				// Calculate fee

				// Create output

				tx.signAllInputs(keys[0].pair);
				tx.signAllInputs(keys[1].pair);
				tx.finalizeAllInputs();
				const txhex = tx.toHex();

				// braodcast
			}).catch(err => {
				alert('Error: ' + err);
			});
		});
	}

	submitNPO() {
		let keys: BitcoinKeys[];
		console.log(this.modelNPO);

		if (!checkBitcoinAddress(this.modelNPO.destination))
			return alert('Invalid destination address');

		for (let i = 0; i < 3; i++) {
			if (!this.modelNPO.admins[i].backup)
				return alert('Invalid backup file for admin ' + i);

			try {
				keys.push(decryptBackup(this.modelUser.backup, this.modelUser.backupPass, true));
			} catch (err) {
				switch (err) {
					case 'XNJ':
						return alert('Invalid backup file for admin ' + i);
					case 'XWP':
						return alert('Invalid backup password for admin ' + i);
				}
			}
		}

	}

	onFileChange(t: 'user' | 'npo', adminNumber, event) {
		let reader = new FileReader();

		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			reader.readAsDataURL(file);

			reader.onload = () => {
				let j = null;

				try {
					j = JSON.parse(Buffer.from(reader.result.toString().replace('data:application/json;base64,', ''), 'base64').toString('ascii'));
				} catch (e) {
					alert("Invalid file: " + e);
				}

				if (t == 'user')
					this.modelUser.backup = j;
				else
					this.modelNPO.admins[adminNumber].backup = j;
			};
		}
	}
}
