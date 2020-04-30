import { networks } from 'bitcoinjs-lib';

export const environment = {
	production: false,
	testnet: true,
	explorer: 'https://blockstream.info/testnet/',
	network: networks.testnet
};
