var walletRecovery = angular.module('walletRecovery', [
	'ngFileUpload'
]);


walletRecovery.controller('RecoveryCtrl', function($scope, $http) {
    var bnetwork = bitcoin.networks.bitcoin;
	var cnetwork = 'BTC';

    $scope.tab = 'home';
	$scope.transaction = { address: '', txid: '' };
	$scope.error = { code: '' };
	$scope.segwit = false;


	$scope.updateFee = function () {
		$http.get ('https://estimatesmartfee.com/json.json').success (function (data) {
			$scope.fee = data;
			if ($scope.fee.length == 0)
				$scope.fee = [ { conservative: 172 } ];
		}).error (function (e) {
			$scope.fee = [ { conservative: 172 } ];
		});
	};

	$scope.calculateFee = function (inputn) {
		return (2 * 34 + inputn * 180 + 10) * $scope.fee[0].conservative / 100000000.0;
	};

	$scope.deployError = function (e) {
		$scope.error.code = e;
		$('#errorModal').modal ('show');
	};

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
                $scope.npo = { 
					n: 2,
					pubkeys: [],
                    address: '',
                    backup: [ { error: '', backpass: '', file: '', data: {}, password: '' } ],
                    error: '',
					loading: false
                };
                break;

            case 'backup':
                $scope.backup = { 
                    backup: { file: '', data: {}, password: '' },
                    error: '',
					loading: false
                };
                break;
        } 
    };

	/* Organization */
	$scope.addAdmin = function () {
		$scope.npo.backup.push ({ error: '', backpass: '', file: '', data: {}, password: '' });
	};

	$scope.removeAdmin = function (ad) {
		$scope.npo.backup.splice ($scope.npo.backup.indexOf (ad), 1);
	};

    $scope.loadNPOBackupFile = function (w, file) {
		var i = $scope.npo.backup.indexOf (w);

		$scope.npo.backup[i].error = '';
		$scope.npo.backup[i].file = file;
			
		if (file === null) {
			$scope.npo.backup[i].data = null;
			return;
		}
			
		var reader = new FileReader();
			
		reader.onload = function(event) {
			var data = event.target.result;
			$scope.npo.backup[i].data = JSON.parse(data);
            console.log (data);
		};
		reader.readAsText (file);
    };

    $scope.recoverNPO = function () {
		$scope.npo.loading = true;
		$scope.npo.pubkeys = [];
		$scope.npo.error = '';

		for (var i = 0 ; i < $scope.npo.backup.length; i++) {
			$scope.npo.backup[i].error = '';

				if ($scope.npo.backup[i].file === null) {
					$scope.npo.backup[i].error = 'XNF';
					$scope.deployError ('XNF');
					$scope.npo.loading = false;
					return;
				}
					
				if ($scope.npo.backup[i].data === null) {
					$scope.npo.backup[i].error = 'XNJ';
					$scope.deployError ('XNJ');
					$scope.npo.loading = false;
					return;
				}
					
				if (! ('encprivkey' in $scope.npo.backup[i].data) ||
					! ('pubkeysrv' in $scope.npo.backup[i].data) ||
					! ('pubkey' in $scope.npo.backup[i].data) ||
					! ('walletid' in $scope.npo.backup[i].data)) {

					$scope.segwit = $scope.npo.backup[i].data.segwit || false;
					$scope.npo.backup[i].error = 'XNJ';
					$scope.deployError ('XNJ');
					$scope.npo.loading = false;
					return;
				}
				
				/* Decrypt the key */
				var hex2a = function (hex) {
					var str = '';
					for (var i = 0; i < hex.length; i += 2)
						str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
					return str;
				};
					

				var privkeye = CryptoJS.AES.decrypt($scope.npo.backup[i].data.encprivkey, $scope.npo.backup[i].password, {iv: $scope.npo.backup[i].password});
				var priv2 = hex2a (privkeye.toString ());
					
				var pair2 = null;
				try {
					pair2 = bitcoin.ECPair.fromWIF (priv2, bnetwork);
				} catch (e) {
					$scope.npo.backup[i].error = 'XWP';
					$scope.deployError ('XWP');
					$scope.npo.loading = false;
					return;
				}
					
				var pub2 = pair2.getPublicKeyBuffer ().toString ('hex');

				$scope.npo.backup[i].priv = priv2;
				$scope.npo.backup[i].pub = pub2;
				$scope.npo.backup[i].pair = pair2;
		}
		
		$scope.npo.pubkeys.push ($scope.npo.backup[0].data.pubkeysrv);
		for (var i = 0; i < $scope.npo.backup.length; i++) {
			$scope.npo.pubkeys.push ($scope.npo.backup[i].pub);
		}

		$scope.npo.pubkeys.sort ();
		$scope.npo.backup.sort (function (a, b) {
			return a.pub > b.pub;
		});

		console.log ($scope.npo.pubkeys);
		console.log ($scope.npo.backup);
		
		console.log ($scope.npo.n + ' ' + $scope.npo.pubkeys.length);

		/* Validate destination address */
		try {
			bitcoin.address.fromBase58Check($scope.npo.address);
		} catch (e) {
			$scope.npo.error = 'XWD';
			$scope.deployError ('XWD');
			$scope.npo.loading = false;
			return;
		}

		/* Validate number of key */
		if ($scope.npo.pubkeys.length < (parseInt ($scope.npo.n))) {
			$scope.npo.error = 'XPL';
			$scope.deployError ('XPL');
			$scope.npo.loading = false;
			return;
		}


		/* Evalute the reedem script */
		var pubkeys_raw = $scope.npo.pubkeys.map(function (hex /*: string*/) { return new buffer.Buffer (hex, 'hex'); });


		if ($scope.segwit) {
			var witnessScript = bitcoin.script.multisig.output.encode (parseInt ($scope.npo.n), pubkeys_raw);
			var redeemScript = bitcoin.script.witnessScriptHash.output.encode (bitcoin.crypto.sha256(witnessScript));
			var scriptPubKey = bitcoin.script.scriptHash.output.encode (bitcoin.crypto.hash160(redeemScript));
			var address = bitcoin.address.fromOutputScript(scriptPubKey, bnetwork);			
		} else {
			var redeemScript = bitcoin.script.multisig.output.encode (parseInt ($scope.npo.n), pubkeys_raw);
			var scriptPubKey = bitcoin.script.scriptHash.output.encode (bitcoin.crypto.hash160 (redeemScript));
			var address = bitcoin.address.fromOutputScript (scriptPubKey, bnetwork);
		}

		console.log (address);


		/* Get unspent */
		$http.get ('https://chain.so/api/v2/get_tx_unspent/' + cnetwork + '/' + address).success (function (data) {
			var txs = data.data.txs;
			var txb = new bitcoin.TransactionBuilder (bnetwork);
			var cumulative = 0.0;
			var fee = $scope.calculateFee (txs.length);

			for (var i = 0; i < txs.length; i++) {
				cumulative += parseFloat (txs[i].value);
				txb.addInput (txs[i].txid, txs[i].output_no);
			}

			if (cumulative == 0 || cumulative - fee < 0) {
				$scope.npo.error = 'XWE';
				$scope.deployError ('XWE');
				$scope.npo.loading = false;
				return;
			}

			try {
				txb.addOutput($scope.npo.address, Math.floor ((cumulative - fee) * 100000000));
			} catch (err) {
				$scope.npo.error = 'XWD';
				$scope.deployError ('XWD');
				$scope.npo.loading = false;
				return;
			}

			/* Add signatures */
			for (var j = 0; j < txb.tx.ins.length; j++) {
				for (var z = 0; z < parseInt ($scope.npo.n); z++) {
					if ($scope.segwit) {
						txb.sign (j, $scope.npo.backup[z].pair, redeemScript, null, txs[i].value * 100000000, witnessScript);
					} else {
						txb.sign (j, $scope.npo.backup[z].pair, redeemScript);
					}
				}
			}

			/* Create the signed transaction */
			var txb1 = bitcoin.Transaction.fromHex (txb.buildIncomplete ().toHex (), bnetwork);
			var txb2 = bitcoin.TransactionBuilder.fromTransaction (txb1, bnetwork);

			var tx = txb2.build ();
			var txhex = tx.toHex ();
			console.log (txhex);

			/* Broadcast */
			$http.post ('https://chain.so/api/v2/send_tx/' + cnetwork, {tx_hex: txhex}).success (function (data) {
				console.log (data);
				$scope.transaction.txid = data.data.txid;
				$scope.transaction.address = $scope.npo.address;
				$('#sentModal').modal ('show');
				$scope.npo.loading = false;
			}).error (function (data) {
				$scope.npo.error = 'XNB';
				$scope.deployError ('XNB');
				$scope.npo.loading = false;	
			});
		});
    };




	/* Backup checker */
	$scope.loadBackupBackupFile = function (file) {
		$scope.backup.error = '';
		$scope.backup.backup.file = file;
			
		if (file === null) {
			$scope.backup.backup.data = null;
			return;
		}
			
		var reader = new FileReader();
			
		reader.onload = function(event) {
			var data = event.target.result;
			$scope.backup.backup.data = JSON.parse(data);
            console.log (data);
		};
		reader.readAsText (file);
    };


    $scope.verifyBackup = function () {
		$scope.backup.error = '';
		
		if ($scope.backup.backup.file === null) {
			$scope.backup.error = 'XNF';
			$scope.deployError ('XNF');
			return;
		}
			
		if ($scope.backup.backup.data === null) {
			$scope.backup.error = 'XNJ';
			$scope.deployError ('XNJ');
			return;
		}
			
		if (! ('encprivkey' in $scope.backup.backup.data) ||
			! ('pubkey' in $scope.backup.backup.data)){
			$scope.backup.error = 'XNJ';
			$scope.deployError ('XNJ');
			return;
		}
        
		/* Decrypt the key */
		var hex2a = function (hex) {
			var str = '';
			for (var i = 0; i < hex.length; i += 2)
				str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
			return str;
		};
			
		$scope.backup.loading = true;

		var privkeye = CryptoJS.AES.decrypt($scope.backup.backup.data.encprivkey, $scope.backup.backup.password, {iv: $scope.backup.backup.password});
		var priv2 = hex2a (privkeye.toString ());
			
		var pair2 = null;
		try {
			pair2 = bitcoin.ECPair.fromWIF (priv2, bnetwork);
		} catch (e) {
			$scope.backup.error = 'XWP';
			$scope.deployError ('XWP');
			$scope.backup.loading = false;
			return;
		}
			
		var pub2 = pair2.getPublicKeyBuffer ().toString ('hex');
		if (pub2 != $scope.backup.backup.data.pubkey) {
			$scope.backup.error = 'XWP';
			$scope.deployError ('XWP');
			$scope.backup.loading = false;
			return;
		}

		$('#verifiedModal').modal ('show');
		$scope.backup.loading = false;
	};



	/* Single user */
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
			$scope.deployError ('XNF');
			return;
		}
			
		if ($scope.user.backup.data === null) {
			$scope.user.error = 'XNJ';
			$scope.deployError ('XNJ');
			return;
		}
			
		if (! ('encprivkey' in $scope.user.backup.data) ||
			! ('address' in $scope.user.backup.data) ||
			! ('pubkey' in $scope.user.backup.data)) {
			$scope.segwit = $scope.user.backup.data.segwit || false;
			$scope.user.error = 'XNJ';
			$scope.deployError ('XNJ');
			return;
		}
        
		/* Validate destination address */
		try {
			bitcoin.address.fromBase58Check($scope.user.address);
		} catch (e) {
			$scope.user.error = 'XWD';
			$scope.deployError ('XWD');
			$scope.user.loading = false;
		}

		/* Decrypt the key */
		var hex2a = function (hex) {
			var str = '';
			for (var i = 0; i < hex.length; i += 2)
				str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
			return str;
		};
			
		$scope.user.loading = true;

		var privkeye = CryptoJS.AES.decrypt($scope.user.backup.data.encprivkey, $scope.user.backup.password, {iv: $scope.user.backup.password});
		var priv2 = hex2a (privkeye.toString ());
			
		var pair2 = null;
		try {
			pair2 = bitcoin.ECPair.fromWIF (priv2, bnetwork);
		} catch (e) {
			$scope.user.error = 'XWP';
			$scope.deployError ('XWP');
			$scope.user.loading = false;
			return;
		}
			
		var pub2 = pair2.getPublicKeyBuffer ().toString ('hex');
		if (pub2 != $scope.user.backup.data.pubkey) {
			$scope.user.error = 'XWP';
			$scope.deployError ('XWP');
			$scope.user.loading = false;
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
			$scope.deployError ('XWM');
			$scope.user.loading = false;
			return;
		}
		
		var pubkeys_raw = $scope.user.backup.data.pubkeys.map(function (hex /*: string*/) { return new buffer.Buffer (hex, 'hex'); });

		if ($scope.segwit) {
			var witnessScript = bitcoin.script.multisig.output.encode (2, pubkeys_raw);
			var redeemScript = bitcoin.script.witnessScriptHash.output.encode (bitcoin.crypto.sha256(witnessScript));
			var scriptPubKey = bitcoin.script.scriptHash.output.encode (bitcoin.crypto.hash160(redeemScript));
			var address = bitcoin.address.fromOutputScript(scriptPubKey, bnetwork);			
		} else {
			var redeemScript = bitcoin.script.multisig.output.encode (2, pubkeys_raw);
			var scriptPubKey = bitcoin.script.scriptHash.output.encode (bitcoin.crypto.hash160 (redeemScript));
			var address = bitcoin.address.fromOutputScript (scriptPubKey, bnetwork);
		}

		/* Get unspent */
		$http.get ('https://chain.so/api/v2/get_tx_unspent/' + cnetwork + '/' + $scope.user.backup.data.address).success (function (data) {
			var txs = data.data.txs;
			var txb = new bitcoin.TransactionBuilder (bnetwork);
			var cumulative = 0.0;
			var fee = $scope.calculateFee (txs.length);

			for (var i = 0; i < txs.length; i++) {
				cumulative += parseFloat (txs[i].value);
				txb.addInput (txs[i].txid, txs[i].output_no);
			}


			if (cumulative == 0 || cumulative - fee < 0) {
				$scope.user.error = 'XWE';
				$scope.deployError ('XWE');
				$scope.user.loading = false;
				return;
			}

			try {
				txb.addOutput($scope.user.address, Math.floor ((cumulative - fee) * 100000000));
			} catch (err) {
				$scope.user.error = 'XWD';
				$scope.deployError ('XWD');
				$scope.user.loading = false;
				return;
			}

			/* Add signatures */
			for (var j = 0; j < txb.tx.ins.length; j++) {
				if ($scope.segwit) {
					txb.sign (j, pair1, redeemScript, null, txs[i].value * 100000000, witnessScript);
					txb.sign (j, pair2, redeemScript, null, txs[i].value * 100000000, witnessScript);
				} else {
					txb.sign (j, pair1, redeemScript);
					txb.sign (j, pair2, redeemScript);
				}
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
				$scope.user.loading = false;
			}).error (function (data) {
				$scope.user.error = 'XNB';
				$scope.deployError ('XNB');
				$scope.user.loading = false;	
			});
		});
    };
});
