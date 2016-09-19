var walletRecovery = angular.module('walletRecovery', [
	'ngFileUpload'
]);


walletRecovery.controller('RecoveryCtrl', function($scope, $http) {
    var bnetwork = bitcoin.networks.testnet;
	var cnetwork = 'BTCTEST';
	var fee = 0.002;

    $scope.tab = 'home';
	$scope.transaction = { address: '', txid: '' };

    $scope.switchTab = function (t) { 
        $scope.tab = t;

        switch (t) {
            case 'user':
                $scope.user = { 
                    mnemonic: '',
                    backpass: '',
                    address: '',
                    backup: { file: '', data: {}, password: '' },
                    error: '',
					loading: false
                };
                break;

            case 'npo':
                break;
        } 
    };

    $scope.loadUserBackupFile = function (file) {
		$scope.user.error = '';
		$scope.user.backup.file = file;
			
		if (file === null) {
			$scope.user.backup.data = null;
			return;
		}
			
		var reader = new FileReader();
			
		reader.onload = function(event) {
			var data = event.target.result;
			$scope.user.backup.data = JSON.parse(data);
            console.log (data);
		};
		reader.readAsText (file);
    };
    
    $scope.recoverUser = function () {
		$scope.user.error = '';
		
		if ($scope.user.backup.file === null) {
			$scope.user.error = 'XNF';
			return;
		}
			
		if ($scope.user.backup.data === null) {
			$scope.user.error = 'XNJ';
			return;
		}
			
		if (! ('encprivkey' in $scope.user.backup.data) ||
			! ('address' in $scope.user.backup.data) ||
			! ('pubkey' in $scope.user.backup.data)){
			$scope.user.error = 'XNJ';
			return;
		}
        
		/* Decrypt the key */
		var hex2a = function (hex) {
			var str = '';
			for (var i = 0; i < hex.length; i += 2)
				str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
			return str;
		};
			
		loading = true;

		var privkeye = CryptoJS.AES.decrypt($scope.user.backup.data.encprivkey, $scope.user.backup.password, {iv: $scope.user.backup.password});
		var priv2 = hex2a (privkeye.toString ());
			
		var pair2 = null;
		try {
			pair2 = bitcoin.ECPair.fromWIF (priv2, bnetwork);
		} catch (e) {
			$scope.user.error = 'XWP';
			loading = false;
			return;
		}
			
		var pub2 = pair2.getPublicKeyBuffer ().toString ('hex');
		if (pub2 != $scope.user.backup.data.pubkey) {
			$scope.user.error = 'XWP';
			loading = false;
			return;
		}

		/* Decrypt the mnemonic */
		var seed = bip39.mnemonicToSeed ($scope.user.mnemonic);
		var hd = bitcoin.HDNode.fromSeedBuffer (seed, bnetwork);

		var pair1 = hd.keyPair;
		var priv1 = pair1.toWIF ();
		var pub1 = pair1.getPublicKeyBuffer ().toString ('hex');

		if ($scope.user.backup.data.pubkeys.indexOf (pub1) == -1) {
			$scope.user.error = 'XWM';
			loading = false;
			return;
		}
		
		var pubkeys_raw = $scope.user.backup.data.pubkeys.map(function (hex /*: string*/) { return new buffer.Buffer (hex, 'hex'); });
		var redeemScript = bitcoin.script.multisigOutput(2, pubkeys_raw);

		/* Get unspent */
		$http.get ('https://chain.so/api/v2/get_tx_unspent/' + cnetwork + '/' + $scope.user.backup.data.address).success (function (data) {
			var txs = data.data.txs;
			var txb = new bitcoin.TransactionBuilder (bnetwork);
			var cumulative = 0.0;

			for (var i = 0; i < txs.length; i++) {
				cumulative += parseFloat (txs[i].value);
				txb.addInput (txs[i].txid, txs[i].output_no);
			}

			if (cumulative == 0 || cumulative - fee < 0) {
				$scope.user.error = 'XWE';
				return;
			}

			try {
				txb.addOutput($scope.user.address, Math.floor ((cumulative - fee) * 100000000));
			} catch (err) {
				$scope.user.error = 'XWD';
				return;
			}

			/* Add signatures */
			for (var j = 0; j < txb.tx.ins.length; j++) {
				txb.sign (j, pair1, redeemScript);
				txb.sign (j, pair2, redeemScript);
			}

			/* Create the signed transaction */
			var tx = txb.build ();
			var txhex = tx.toHex ();

			/* Broadcast */
			$http.post ('https://chain.so/api/v2/send_tx/' + cnetwork, {tx_hex: txhex}).success (function (data) {
				console.log (data);
				$scope.transaction.txid = data.data.txid;
				$scope.transaction.address = $scope.user.address;
				$('#sentModal').modal ('show');
			});
		});
    };
});
