(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod);
    global.EthereumContracts = mod.exports;
  }
})(this, function (module) {
  "use strict";

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var DUMMY_LOGGER = {
    debug: function debug() {},
    info: function info() {},
    warn: function warn() {},
    error: function error() {}
  };

  /**
   * Factory for creating new contracts.
   */

  var ContractFactory = function () {
    /**
     * Constuct a new instance.
     * 
     * @param {Object} config Configuration.
     * @param {Object} config.web3 A `Web3` instance.
     * @param {Object} config.account Address of account to send transactions from.
     * @param {Number} config.gas Gas amount to use for calls.
     */
    function ContractFactory(config) {
      _classCallCheck(this, ContractFactory);

      this._config = config;
      this._web3 = config.web3;
      this._account = config.account;
      this._gas = config.gas;
    }

    /**
     * Make a wrapper for the given contract.
     *
     * @param {Object} config Configuration.
     * @param {Object} config.contract Contract data, usually the output of `solc` compiler.
     * @param {String} config.contract.interface Contract ABI interface JSON.
     * @param {String} config.contract.bytecode Contract bytecode string.
     */


    _createClass(ContractFactory, [{
      key: 'make',
      value: function make(config) {
        return new Contract(Object.assign({}, config, {
          gas: this._gas,
          web3: this._web3,
          account: this._account
        }));
      }
    }]);

    return ContractFactory;
  }();

  var Contract = function () {
    /**
     * Constuct a new instance.
     * 
     * @param {Object} config Configuration.
     * @param {Object} config.web3 A `Web3` instance.
     * @param {Object} contract.contract Contract data, usually the output of `solc` compiler.
     * @param {String} config.contract.interface Contract ABI interface JSON.
     * @param {String} config.contract.bytecode Contract bytecode string.
     * @param {Object} config.account Address of account to send transactions from.
     * @param {Number} config.gas Gas amount to use for calls.
     */
    function Contract(config) {
      _classCallCheck(this, Contract);

      this._config = config;
      this._web3 = config.web3;
      this._bytecode = config.contract.bytecode;
      this._interface = JSON.parse(config.contract.interface);
      this._contract = this._web3.eth.contract(this._interface);
      this._account = config.account;
      this._gas = config.gas;
      this._logger = DUMMY_LOGGER;
    }

    /**
     * Get the logger.
     * @return {Object}
     */


    _createClass(Contract, [{
      key: 'deploy',
      value: function deploy(args, options) {
        var _this = this;

        options = Object.assign({
          account: this._account,
          gas: this._gas
        }, options);

        this.logger.info('Deploy contract from account ' + options.account + '...');

        return Promise.resolve().then(function () {
          var sortedArgs = _this._sanitizeMethodArgs('constructor', args);

          _this.logger.debug('Deploy contract ...');

          return new Promise(function (resolve, reject) {
            _this._contract.new.apply(_this._contract, sortedArgs.concat([{
              data: _this._bytecode,
              gas: options.gas,
              from: options.account
            }, function (err, newContract) {
              if (err) {
                _this.logger.error('Contract creation error', err);

                return reject(err);
              }

              if (!newContract.address) {
                _this.logger.debug('New contract transaction: ' + newContract.transactionHash);
              } else {
                _this.logger.info('New contract address: ' + newContract.address);

                resolve(new ContractInstance({
                  contract: _this,
                  address: newContract.address
                }));
              }
            }]));
          });
        });
      }
    }, {
      key: '_sanitizeMethodArgs',
      value: function _sanitizeMethodArgs(method, args) {
        var _this2 = this;

        args = args || {};

        this.logger.debug('Sanitize ' + Object.keys(args).length + ' arguments for method: ' + method + ' ...');

        var methodAbi = this._getMethodDescriptor(method);

        if (!methodAbi) {
          // if not constructor found then it's a built-in constructor
          if ('constructor' === method) {
            this.logger.debug('Built-in constructor, so no default arguments.');

            return [];
          } else {
            throw new Error('Method not found: ' + method);
          }
        }

        return methodAbi.inputs.map(function (input) {
          if (!args.hasOwnProperty(input.name)) {
            throw new Error('Missing argument ' + input.name + ' for method ' + method);
          }

          try {
            return _this2._convertInputArg(args[input.name], input.type);
          } catch (err) {
            throw new Error('Error converting value for argument ' + input.name + ' of method ' + method + ': ' + err.message);
          }
        });
      }
    }, {
      key: '_sanitizeMethodReturnValues',
      value: function _sanitizeMethodReturnValues(method, value) {
        var _this3 = this;

        var values = Array.isArray(value) ? value : [value];

        this.logger.debug('Sanitize ' + values.length + ' return values from method: ' + method + ' ...');

        var methodAbi = this._getMethodDescriptor(method);

        if (!methodAbi) {
          throw new Error('Method not found: ' + method);
        }

        var ret = methodAbi.outputs.map(function (output) {
          try {
            return _this3._convertReturnValue(values.shift(), output.type);
          } catch (err) {
            throw new Error('Error converting return value to type ' + output.name + ' for method ' + method + ': ' + err.message);
          }
        });

        return Array.isArray(value) ? ret : ret[0];
      }
    }, {
      key: '_getMethodDescriptor',
      value: function _getMethodDescriptor(method) {
        this.logger.debug('Get descriptor for method: ' + method + ' ...');

        var interfaceMethod = this._interface.find(function (item) {
          return item.name === method || item.type === method;
        });

        return interfaceMethod || null;
      }
    }, {
      key: '_convertReturnValue',
      value: function _convertReturnValue(value, targetType) {
        var originalType = typeof value === 'undefined' ? 'undefined' : _typeof(value);

        this.logger.debug('Convert return value of type ' + originalType + ' to type ' + targetType + ' ...');

        // numbers
        if (0 === targetType.indexOf('int') || 0 === targetType.indexOf('uint')) {
          value = parseInt(this._web3.fromWei(value, 'wei'), 10);
        }

        return value;
      }
    }, {
      key: '_convertInputArg',
      value: function _convertInputArg(value, targetType) {
        var originalType = typeof value === 'undefined' ? 'undefined' : _typeof(value);

        this.logger.debug('Convert input value of type ' + originalType + ' to type ' + targetType + ' ...');

        // numbers
        if (0 === targetType.indexOf('int') || 0 === targetType.indexOf('uint')) {
          var suffix = targetType.substr(targetType.indexOf('int') + 3);

          if (suffix.length) {
            suffix = parseInt(suffix, 10);
          } else {
            suffix = 256; // since int=int256 and uint=uint256
          }

          var maxValue = void 0,
              minValue = void 0;

          if (0 === targetType.indexOf('int')) {
            minValue = -(Math.pow(2, suffix - 1) - 1);
            maxValue = Math.pow(2, suffix - 1) - 1;
          } else {
            minValue = 0;
            maxValue = Math.pow(2, suffix) - 1;
          }

          value = Number(value);

          if (isNaN(value)) {
            throw new Error('Value is not a number');
          }

          if (value < minValue || value > maxValue) {
            throw new Error('Value out of bounds (min=' + minValue + ', max=' + maxValue + ')');
          }
        }
        // bool
        else if ('bool' === targetType) {
            value += '';
            value = '' === value || '0' === value || 'false' === value ? false : true;
          }
          // string
          else if ('string' === targetType) {
              value = '' + value;
            }
            // address
            else if ('address' === targetType) {
                if ('number' === originalType) {
                  value = ('0000000000000000000000000000000000000000' + value.toString(16)).slice(-40);
                  value = '0x' + value;
                } else {
                  value = value + '';
                }

                if (!this._web3.isAddress(value)) {
                  throw new Error('Value is not a valid address');
                }
              }
              // bytes
              else if (0 === targetType.indexOf('byte')) {
                  value = this._web3.toHex(value);
                }

        return value;
      }
    }, {
      key: 'logger',
      get: function get() {
        return this._logger;
      },
      set: function set(val) {
        this._logger = {};

        for (var key in DUMMY_LOGGER) {
          this._logger[key] = val && typeof val[key] === 'function' ? val[key].bind(val) : DUMMY_LOGGER[key];
        }
      }
    }]);

    return Contract;
  }();

  var ContractInstance = function () {
    /**
     * Construct a new instance.
     *
     * @param {Object} config Configuration.
     * @param {Contract} config.contract The contract instance.
     * @param {String} config.address Address on blockchain.
     */
    function ContractInstance(config) {
      _classCallCheck(this, ContractInstance);

      this._config = config;
      this._contract = config.contract;
      this._web3 = this._contract._web3;
      this._address = config.address;
      this._inst = this.contract._contract.at(this._address);

      /*
      Logger is same as parent contract one, except that address is prepended 
      to all log output.
       */
      this._logger = {};
      for (var logMethod in DUMMY_LOGGER) {
        this._logger[logMethod] = function (logMethod, self) {
          return function () {
            self.contract.logger[logMethod].apply(self.contract.logger, ['[' + self.address + ']: '].concat(Array.from(arguments)));
          };
        }(logMethod, this);
      }
    }

    /**
     * Get address of this instance.
     * @return {String}
     */


    _createClass(ContractInstance, [{
      key: 'localCall',
      value: function localCall(method, args) {
        var parentContract = this.contract;

        this._logger.info('Local call ' + method + ' ...');

        var sortedArgs = parentContract._sanitizeMethodArgs(method, args);

        return parentContract._sanitizeMethodReturnValues(method, this._inst[method].call.apply(this._inst[method], sortedArgs));
      }
    }, {
      key: 'sendCall',
      value: function sendCall(method, args, options) {
        var _this4 = this;

        var parentContract = this.contract;

        options = Object.assign({
          account: parentContract._account,
          gas: parentContract._gas
        }, options);

        this._logger.info('Call method ' + method + ' from account ' + options.account + '...');

        return Promise.resolve().then(function () {
          var sortedArgs = parentContract._sanitizeMethodArgs(method, args);

          _this4._logger.debug('Execute method ' + method + ' ...');

          return new Promise(function (resolve, reject) {
            _this4._inst[method].sendTransaction.apply(_this4._inst, sortedArgs.concat([{
              data: _this4._bytecode,
              gas: options.gas,
              from: options.account
            }, function (err, txHash) {
              if (err) {
                _this4._logger.error('Method call error', err);

                return reject(err);
              }

              var tx = new Transaction({
                parent: _this4,
                hash: txHash
              });

              tx.getReceipt().then(resolve).catch(reject);
            }]));
          });
        });
      }
    }, {
      key: 'address',
      get: function get() {
        return this._address;
      }
    }, {
      key: 'contract',
      get: function get() {
        return this._contract;
      }
    }]);

    return ContractInstance;
  }();

  var Transaction = function () {
    /**
     * Constructor a transaction object.
     *
     * @param {Object} config Configuration options.
     * @param {ContractInstance} config.parent The parent `ContratInstance`.
     * @param {String} config.hash Transaction hash.
     */
    function Transaction(config) {
      _classCallCheck(this, Transaction);

      this._web3 = config.parent._web3;
      this._logger = config.parent._logger;
      this._hash = config.hash;
    }

    /**
     * Get transaction hash.
     * @return {String}
     */


    _createClass(Transaction, [{
      key: 'getReceipt',
      value: function getReceipt() {
        var _this5 = this;

        return new Promise(function (resolve, reject) {
          _this5._fetchReceiptLoop(resolve, reject);
        });
      }
    }, {
      key: '_fetchReceiptLoop',
      value: function _fetchReceiptLoop(onSuccess, onError) {
        var _this6 = this;

        this._logger.debug('Fetch receipt for tx ' + this.hash + ' ...');

        this._web3.eth.getTransactionReceipt(this.hash, function (err, receipt) {
          if (err) {
            _this6._logger.error('Transaction receipt error', err);

            return onError(err);
          }

          if (receipt) {
            onSuccess(receipt);
          } else {
            _this6._fetchReceiptLoopTimer = setTimeout(function () {
              _this6._fetchReceiptLoop(onSuccess, onError);
            }, 1000);
          }
        });
      }
    }, {
      key: 'hash',
      get: function get() {
        return this._hash;
      }
    }]);

    return Transaction;
  }();

  module.exports = { ContractFactory: ContractFactory, Contract: Contract, ContractInstance: ContractInstance };
});
