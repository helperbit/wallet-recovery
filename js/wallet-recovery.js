var walletRecovery = angular.module('walletRecovery', [
	'ngFileUpload'
]);


walletRecovery.controller('RecoveryCtrl', function($scope) {
    var bnetwork = bitcoin.networks.testnet;

    $scope.tab = 'home';

    $scope.switchTab = function (t) { 
        $scope.tab = t;
        
        switch (t) {
            case 'user':
                $scope.user = { 
                    mnemonic: '',
                    backpass: '',
                    address: '',
                    backup: { file: '', data: {}, password: '' },
                    error: ''
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
			
		var privkeye = CryptoJS.AES.decrypt($scope.user.backup.data.encprivkey, $scope.user.backup.password, {iv: $scope.user.backup.password});
		var privkey = hex2a (privkeye.toString ());
			
		var upair = null;
		try {
			upair = bitcoin.ECPair.fromWIF (privkey, bnetwork);
		} catch (e) {
			$scope.user.error = 'XWP';
			return;
		}
			
		var pubcomputed = upair.getPublicKeyBuffer ().toString ('hex');
		if (pubcomputed != $scope.user.backup.data.pubkey) {
			$scope.user.error = 'XWP';
			return;
		}
			
		var wreq = {
			fee: $scope.evaluteFee (2, 1, true), 
			value: wallet.balance, 
			destination: $scope.user.address
		};
			
		/* Send the refund transaction */
		$http.post (config.apiUrl+'/wallet/' + wallet.address + '/withdraw', wreq).success(function(data){
			var txhex = data.txhex;

			var txb = new bitcoin.TransactionBuilder.fromTransaction (bitcoin.Transaction.fromHex (txhex), bnetwork);
			var pubkeys_raw = wallet.pubkeys.map(function (hex) { return new buffer.Buffer(hex, 'hex'); });
			var redeemScript = bitcoin.script.multisigOutput(2, pubkeys_raw);

			for (var j = 0; j < txb.tx.ins.length; j++)
				txb.sign (j, upair, redeemScript);
			var tx = txb.build ();
			txhex = tx.toHex ();

			var wreq = { txhex: txhex };

			$http.post (config.apiUrl+'/wallet/' + wallet.address + '/send', wreq).success(function(data){
				$scope.backup.txid = data.txid;
				
				$scope.backup.loading = false;
				$scope.reloadWallet ();
			});
		}).error (function (data){
			$scope.backup.error = data.error;
			$scope.backup.loading = false;
		});	
    };

    
});
