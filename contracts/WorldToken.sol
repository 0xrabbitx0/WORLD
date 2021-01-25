// SPDX-License-Identifier: MIT

pragma solidity 0.7.4;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WorldToken is Context, IERC20, Ownable {
    using SafeMath for uint256;
    using Address for address;

    string private constant NAME = "WORLD Token";
    string private constant SYMBOL = "WORLD";
    uint8 private constant DECIMALS = 18;

    mapping (address => uint256) private rOwned;
    mapping (address => uint256) private tOwned;
    mapping (address => mapping (address => uint256)) private allowances;

    mapping (address => bool) private excludedFromFee;
    mapping (address => bool) private excludedFromReward;
    address[] private excludedReward;

    uint256 private constant MAX = ~uint256(0);
    uint256 private constant T_TOTAL = 100_000_000 * 1e18;
    uint256 private rTotal = (MAX - (MAX % T_TOTAL));
    uint256 private tFeeTotal;
    uint256 private tMarketingFeeTotal;
    uint256 private tLpFeeTotal;
    uint256 private tMerchantFeeTotal;

    uint256 public taxPercentage = 3;
    uint256 public holderTaxAlloc = 1;
    uint256 public marketingTaxAlloc = 1;
    uint256 public lpTaxAlloc = 1;
    uint256 public merchantTaxAlloc;
    uint256 public totalTaxAlloc = marketingTaxAlloc + holderTaxAlloc + lpTaxAlloc + merchantTaxAlloc;

    address public marketingAddress;
    address public lpStakingAddress;
    address public merchantStakingAddress;

    constructor (address _marketingAddress) public {
        rOwned[_msgSender()] = rTotal;
        emit Transfer(address(0), _msgSender(), T_TOTAL);

        marketingAddress = _marketingAddress;

        excludeFromReward(_msgSender());
        excludeFromFee(_marketingAddress);

        if (_marketingAddress != _msgSender()) {
            excludeFromReward(_marketingAddress);
            excludeFromFee(_msgSender());
        }

        excludeFromFee(address(0x000000000000000000000000000000000000dEaD));
    }

    function name() external view returns (string memory) {
        return NAME;
    }

    function symbol() external view returns (string memory) {
        return SYMBOL;
    }

    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

    function totalSupply() external view override returns (uint256) {
        return T_TOTAL;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (excludedFromReward[account]) return tOwned[account];
        return tokenFromReflection(rOwned[account]);
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, _msgSender(), allowances[sender][_msgSender()].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, allowances[_msgSender()][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, allowances[_msgSender()][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    function isExcludedFromReward(address account) external view returns (bool) {
        return excludedFromReward[account];
    }

    function isExcludedFromFee(address account) external view returns (bool) {
        return excludedFromFee[account];
    }

    function totalFees() external view returns (uint256) {
        return tFeeTotal;
    }

    function totalMarketingFees() external view returns (uint256) {
        return tMarketingFeeTotal;
    }

    function totalLpFees() external view returns (uint256) {
        return tLpFeeTotal;
    }

    function totalMerchantFees() external view returns (uint256) {
        return tMerchantFeeTotal;
    }

    function reflect(uint256 tAmount) public {
        address sender = _msgSender();
        require(!excludedFromReward[sender], "Excluded addresses cannot call this function");
        (uint256 rAmount,,,,) = _getValues(tAmount);
        rOwned[sender] = rOwned[sender].sub(rAmount);
        rTotal = rTotal.sub(rAmount);
        tFeeTotal = tFeeTotal.add(tAmount);
    }

    function reflectionFromToken(uint256 tAmount, bool deductTransferFee) public view returns(uint256) {
        require(tAmount <= T_TOTAL, "Amount must be less than supply");
        if (!deductTransferFee) {
            (uint256 rAmount,,,,) = _getValues(tAmount);
            return rAmount;
        } else {
            (,uint256 rTransferAmount,,,) = _getValues(tAmount);
            return rTransferAmount;
        }
    }

    function tokenFromReflection(uint256 rAmount) public view returns(uint256) {
        require(rAmount <= rTotal, "Amount must be less than total reflections");
        uint256 currentRate =  _getRate();
        return rAmount.div(currentRate);
    }

    function excludeFromFee(address account) public onlyOwner() {
        require(!excludedFromFee[account], "Account is already excluded from fee");
        excludedFromFee[account] = true;
    }

    function includeInFee(address account) public onlyOwner() {
        require(excludedFromFee[account], "Account is already included in fee");
        excludedFromFee[account] = false;
    }

    function excludeFromReward(address account) public onlyOwner() {
        require(!excludedFromReward[account], "Account is already excluded from reward");
        if(rOwned[account] > 0) {
            tOwned[account] = tokenFromReflection(rOwned[account]);
        }
        excludedFromReward[account] = true;
        excludedReward.push(account);
    }

    function includeInReward(address account) public onlyOwner() {
        require(excludedFromReward[account], "Account is already included in reward");
        for (uint256 i = 0; i < excludedReward.length; i++) {
            if (excludedReward[i] == account) {
                excludedReward[i] = excludedReward[excludedReward.length - 1];
                tOwned[account] = 0;
                excludedFromReward[account] = false;
                excludedReward.pop();
                break;
            }
        }
    }

    function _approve(address owner, address spender, uint256 amount) private {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) private {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(amount > 0, "Transfer amount must be greater than zero");

        uint256 currentTaxPercentage = taxPercentage;
        if (excludedFromFee[sender] || excludedFromFee[recipient]) {
            taxPercentage = 0;
        } else {
            uint256 fee = _getFee(amount);
            uint256 marketingFee = _getMarketingFee(fee);
            uint256 lpFee = _getLpFee(fee);
            uint256 merchantFee = _getMerchantFee(fee);

            _reflectMarketingFee(marketingFee);
            _reflectLpFee(lpFee);
            _reflectMerchantFee(merchantFee);
        }

        if (excludedFromReward[sender] && !excludedFromReward[recipient]) {
            _transferFromExcluded(sender, recipient, amount);
        } else if (!excludedFromReward[sender] && excludedFromReward[recipient]) {
            _transferToExcluded(sender, recipient, amount);
        } else if (!excludedFromReward[sender] && !excludedFromReward[recipient]) {
            _transferStandard(sender, recipient, amount);
        } else if (excludedFromReward[sender] && excludedFromReward[recipient]) {
            _transferBothExcluded(sender, recipient, amount);
        } else {
            _transferStandard(sender, recipient, amount);
        }

        if (currentTaxPercentage != taxPercentage) {
            taxPercentage = currentTaxPercentage;
        }
    }

    function _transferStandard(address sender, address recipient, uint256 tAmount) private {
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee) = _getValues(tAmount);
        rOwned[sender] = rOwned[sender].sub(rAmount);
        rOwned[recipient] = rOwned[recipient].add(rTransferAmount);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _transferToExcluded(address sender, address recipient, uint256 tAmount) private {
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee) = _getValues(tAmount);
        rOwned[sender] = rOwned[sender].sub(rAmount);
        tOwned[recipient] = tOwned[recipient].add(tTransferAmount);
        rOwned[recipient] = rOwned[recipient].add(rTransferAmount);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _transferFromExcluded(address sender, address recipient, uint256 tAmount) private {
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee) = _getValues(tAmount);
        tOwned[sender] = tOwned[sender].sub(tAmount);
        rOwned[sender] = rOwned[sender].sub(rAmount);
        rOwned[recipient] = rOwned[recipient].add(rTransferAmount);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _transferBothExcluded(address sender, address recipient, uint256 tAmount) private {
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee, uint256 tTransferAmount, uint256 tFee) = _getValues(tAmount);
        tOwned[sender] = tOwned[sender].sub(tAmount);
        rOwned[sender] = rOwned[sender].sub(rAmount);
        tOwned[recipient] = tOwned[recipient].add(tTransferAmount);
        rOwned[recipient] = rOwned[recipient].add(rTransferAmount);
        _reflectFee(rFee, tFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _reflectFee(uint256 rFee, uint256 tFee) private {
        rTotal = rTotal.sub(rFee);
        tFeeTotal = tFeeTotal.add(tFee);
    }

    function _reflectMarketingFee(uint256 _tMarketingFee) private {
        if (marketingAddress == address(0)) {
            return;
        }

        uint256 currentRate =  _getRate();
        uint256 rMarketingFee = _tMarketingFee.mul(currentRate);
        tMarketingFeeTotal = tMarketingFeeTotal.add(_tMarketingFee);

        rOwned[marketingAddress] = rOwned[marketingAddress].add(rMarketingFee);
        if (excludedFromReward[marketingAddress]) {
            tOwned[marketingAddress] = tOwned[marketingAddress].add(_tMarketingFee);
        }
    }

    function _reflectLpFee(uint256 _tLpFee) private {
        if (lpStakingAddress == address(0)) {
            return;
        }

        uint256 currentRate =  _getRate();
        uint256 rLpFee = _tLpFee.mul(currentRate);
        tLpFeeTotal = tLpFeeTotal.add(_tLpFee);

        rOwned[lpStakingAddress] = rOwned[lpStakingAddress].add(rLpFee);
        if (excludedFromReward[lpStakingAddress]) {
            tOwned[lpStakingAddress] = tOwned[lpStakingAddress].add(_tLpFee);
        }
    }

    function _reflectMerchantFee(uint256 _tMerchantFee) private {
        if (merchantStakingAddress == address(0)) {
            return;
        }

        uint256 currentRate =  _getRate();
        uint256 rMerchantFee = _tMerchantFee.mul(currentRate);
        tMerchantFeeTotal = tMerchantFeeTotal.add(_tMerchantFee);

        rOwned[merchantStakingAddress] = rOwned[merchantStakingAddress].add(rMerchantFee);
        if (excludedFromReward[merchantStakingAddress]) {
            tOwned[merchantStakingAddress] = tOwned[merchantStakingAddress].add(_tMerchantFee);
        }
    }

    function _getValues(uint256 tAmount) private view returns (uint256, uint256, uint256, uint256, uint256) {
        (uint256 tTransferAmount, uint256 tFee) = _getTValues(tAmount);
        uint256 currentRate =  _getRate();
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee) = _getRValues(tAmount, tFee, currentRate);
        return (rAmount, rTransferAmount, rFee, tTransferAmount, tFee);
    }

    function _getTValues(uint256 tAmount) private view returns (uint256, uint256) {
        uint256 tFee = _getFee(tAmount);
        uint256 tHolderFee = _getHolderFee(tFee);
        uint256 tTransferAmount = tAmount.sub(tFee);
        return (tTransferAmount, tHolderFee);
    }

    function _getRValues(uint256 tAmount, uint256 tHolderFee, uint256 currentRate) private view returns (uint256, uint256, uint256) {
        uint256 tFee = _getFee(tAmount).mul(currentRate);
        uint256 rAmount = tAmount.mul(currentRate);
        uint256 rTransferAmount = rAmount.sub(tFee);
        uint256 rFee = tHolderFee.mul(currentRate);
        return (rAmount, rTransferAmount, rFee);
    }

    function _getRate() private view returns(uint256) {
        (uint256 rSupply, uint256 tSupply) = _getCurrentSupply();
        return rSupply.div(tSupply);
    }

    function _getCurrentSupply() private view returns(uint256, uint256) {
        uint256 rSupply = rTotal;
        uint256 tSupply = T_TOTAL;
        for (uint256 i = 0; i < excludedReward.length; i++) {
            if (rOwned[excludedReward[i]] > rSupply || tOwned[excludedReward[i]] > tSupply) return (rTotal, T_TOTAL);
            rSupply = rSupply.sub(rOwned[excludedReward[i]]);
            tSupply = tSupply.sub(tOwned[excludedReward[i]]);
        }
        if (rSupply < rTotal.div(T_TOTAL)) return (rTotal, T_TOTAL);
        return (rSupply, tSupply);
    }

    function _getFee(uint256 _amount) private view returns (uint256) {
        return _amount.mul(taxPercentage).div(100);
    }

    function _getHolderFee(uint256 _tax) private view returns (uint256) {
        return _tax.mul(holderTaxAlloc).div(totalTaxAlloc);
    }

    function _getMarketingFee(uint256 _tax) private view returns (uint256) {
        return _tax.mul(marketingTaxAlloc).div(totalTaxAlloc);
    }

    function _getLpFee(uint256 _tax) private view returns (uint256) {
        return _tax.mul(lpTaxAlloc).div(totalTaxAlloc);
    }

    function _getMerchantFee(uint256 _tax) private view returns (uint256) {
        return _tax.mul(merchantTaxAlloc).div(totalTaxAlloc);
    }

    function setTaxPercentage(uint256 _taxPercentage) external onlyOwner {
        require(_taxPercentage >= 1 && _taxPercentage <= 10, "Value is outside of range 1-10");
        taxPercentage = _taxPercentage;
    }

    function setTaxAllocations(
        uint256 _holderTaxAlloc,
        uint256 _marketingTaxAlloc,
        uint256 _lpTaxAlloc,
        uint256 _merchantTaxAlloc
    ) external onlyOwner {
        totalTaxAlloc = _holderTaxAlloc.add(_marketingTaxAlloc).add(_lpTaxAlloc).add(_merchantTaxAlloc);

        require(
            _holderTaxAlloc >= 5 && _holderTaxAlloc <= 10,
            "_holderTaxAlloc is outside of range 5-10"
        );
        require(
            _lpTaxAlloc >= 5 && _lpTaxAlloc <= 10,
            "_lpTaxAlloc is outside of range 5-10"
        );
        require(
            _marketingTaxAlloc <= 10,
            "_marketingTaxAlloc is greater than 10"
        );
        require(
            _merchantTaxAlloc <= 10,
            "_merchantTaxAlloc is greater than 10"
        );

        holderTaxAlloc = _holderTaxAlloc;
        marketingTaxAlloc = _marketingTaxAlloc;
        lpTaxAlloc = _lpTaxAlloc;
        merchantTaxAlloc = _merchantTaxAlloc;
    }

    function setMarketingAddress(address _marketingAddress) external onlyOwner {
        marketingAddress = _marketingAddress;
    }

    function setLpStakingAddress(address _lpStakingAddress) external onlyOwner {
        lpStakingAddress = _lpStakingAddress;
    }

    function setMerchantStakingAddress(address _merchantStakingAddress) external onlyOwner {
        merchantStakingAddress = _merchantStakingAddress;
    }
}
