import { networks } from 'bitcoinjs-lib';

export const environment = {
	production: true,
	testnet: false,
	explorer: 'https://blockstream.info/',
	network: networks.bitcoin
};
