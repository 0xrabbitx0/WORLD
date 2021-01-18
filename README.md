# WORLD Contracts

Rinkeby addresses:
- WORLD Token: [0x292d2E04B3196BFCB7062D897b8a42F536af230B](https://rinkeby.etherscan.io/address/0x292d2E04B3196BFCB7062D897b8a42F536af230B)
- WORLD Farm: [0x26E267A1270bdd438F401Cbbf776b13a0C95165d](https://rinkeby.etherscan.io/address/0x26E267A1270bdd438F401Cbbf776b13a0C95165d)


## Tools

- [Hardhat](https://github.com/nomiclabs/hardhat): compile and run the smart contracts on a local development network
- [TypeChain](https://github.com/ethereum-ts/TypeChain): generate TypeScript types for smart contracts
- [Ethers](https://github.com/ethers-io/ethers.js/): renowned Ethereum library and wallet implementation
- [Waffle](https://github.com/EthWorks/Waffle): tooling for writing comprehensive smart contract tests
- [Solhint](https://github.com/protofire/solhint): linter
- [Solcover](https://github.com/sc-forks/solidity-coverage) code coverage
- [Prettier Plugin Solidity](https://github.com/prettier-solidity/prettier-plugin-solidity): code formatter

## Usage

### Pre Requisites

Before running any command, make sure to install dependencies:

```sh
$ yarn install
```

### Deploy

Deploy to Rinkeby network:

```sh
$ yarn run deploy:rinkeby
```

Deploy to Local network:

```sh
$ yarn run deploy:local
```


### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn build
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```
