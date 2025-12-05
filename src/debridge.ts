import { EVMWallet } from './evm-wallet';

const DEBRIDGE_API = 'https://api.dln.trade/v1.0';

export interface DeBridgeQuote {
  estimation: {
    srcChainTokenIn: {
      amount: string;
      symbol: string;
      decimals: number;
    };
    srcChainTokenOut: {
      amount: string;
      symbol: string;
    };
    dstChainTokenOut: {
      amount: string;
      symbol: string;
      decimals: number;
      recommendedAmount: string;
    };
  };
  tx: {
    to: string;
    data: string;
    value: string;
  };
  orderId: string;
  fixFee: string;
  percentFee: string;
}

export interface QuoteParams {
  srcChainId: number;
  dstChainId: number;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  dstAddress: string;
  srcAddress: string;
  tokenSymbol?: string; // For tracking which token type
}

// Native token addresses - deBridge uses this format
export const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
export const NATIVE_TOKEN_ALT = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // Alternative format
export const SOLANA_CHAIN_ID = 7565164;
export const SOLANA_NATIVE_SOL = 'So11111111111111111111111111111111111111112'; // Wrapped SOL mint

// Solana token addresses (destination)
export const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOLANA_USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// EVM token addresses by chain
export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  addresses: Record<number, string>; // chainId -> address
  solanaAddress: string;
  icon: string;
}

export const SUPPORTED_TOKENS: Record<string, TokenInfo> = {
  NATIVE: {
    symbol: 'NATIVE',
    name: 'Native Token',
    decimals: 18,
    addresses: {
      1: NATIVE_TOKEN,      // ETH
      56: NATIVE_TOKEN,     // BNB
      137: NATIVE_TOKEN,    // MATIC
      42161: NATIVE_TOKEN,  // ETH (Arbitrum)
      8453: NATIVE_TOKEN,   // ETH (Base)
      43114: NATIVE_TOKEN,  // AVAX
      10: NATIVE_TOKEN,     // ETH (Optimism)
    },
    solanaAddress: SOLANA_NATIVE_SOL,
    icon: '',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
      56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',     // BSC
      137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon (native USDC)
      42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum (native USDC)
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
      43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',  // Avalanche
      10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism (native USDC)
    },
    solanaAddress: SOLANA_USDC,
    icon: 'USDC',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    addresses: {
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',      // Ethereum
      56: '0x55d398326f99059fF775485246999027B3197955',     // BSC
      137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',    // Polygon
      42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',  // Arbitrum
      8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',   // Base
      43114: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',  // Avalanche
      10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',     // Optimism
    },
    solanaAddress: SOLANA_USDT,
    icon: 'USDT',
  },
};

// Get token address for a specific chain
export function getTokenAddress(tokenSymbol: string, chainId: number): string | null {
  const token = SUPPORTED_TOKENS[tokenSymbol];
  if (!token) return null;
  return token.addresses[chainId] || null;
}

// Check if token is supported on a chain
export function isTokenSupported(tokenSymbol: string, chainId: number): boolean {
  return getTokenAddress(tokenSymbol, chainId) !== null;
}

// Get native token name for chain
export function getNativeTokenName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'ETH',
    56: 'BNB',
    137: 'MATIC',
    42161: 'ETH',
    8453: 'ETH',
    43114: 'AVAX',
    10: 'ETH',
  };
  return names[chainId] || 'ETH';
}

export async function getQuote(params: QuoteParams): Promise<DeBridgeQuote | null> {
  try {
    const url = new URL(`${DEBRIDGE_API}/dln/order/quote`);
    url.searchParams.set('srcChainId', params.srcChainId.toString());
    url.searchParams.set('srcChainTokenIn', params.srcTokenAddress);
    url.searchParams.set('srcChainTokenInAmount', params.amount);
    url.searchParams.set('dstChainId', params.dstChainId.toString());
    url.searchParams.set('dstChainTokenOut', params.dstTokenAddress);
    url.searchParams.set('dstChainTokenOutRecipient', params.dstAddress);
    url.searchParams.set('srcChainOrderAuthorityAddress', params.srcAddress);
    url.searchParams.set('dstChainOrderAuthorityAddress', params.dstAddress);
    url.searchParams.set('prependOperatingExpenses', 'true');

    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.text();
      console.error('Quote error:', error);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (e) {
    console.error('Failed to get quote:', e);
    return null;
  }
}

export async function createTransaction(params: QuoteParams): Promise<DeBridgeQuote | null> {
  try {
    const url = new URL(`${DEBRIDGE_API}/dln/order/create-tx`);
    url.searchParams.set('srcChainId', params.srcChainId.toString());
    url.searchParams.set('srcChainTokenIn', params.srcTokenAddress);
    url.searchParams.set('srcChainTokenInAmount', params.amount);
    url.searchParams.set('dstChainId', params.dstChainId.toString());
    url.searchParams.set('dstChainTokenOut', params.dstTokenAddress);
    url.searchParams.set('dstChainTokenOutRecipient', params.dstAddress);
    url.searchParams.set('srcChainOrderAuthorityAddress', params.srcAddress);
    url.searchParams.set('dstChainOrderAuthorityAddress', params.dstAddress);
    url.searchParams.set('prependOperatingExpenses', 'true');
    url.searchParams.set('referralCode', '0');

    console.log('Creating transaction with URL:', url.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.text();
      console.error('Create tx error response:', error);
      return null;
    }

    const data = await response.json();
    console.log('Create tx response:', {
      orderId: data.orderId,
      hasTx: !!data.tx,
      txTo: data.tx?.to,
      txValue: data.tx?.value,
    });
    return data;
  } catch (e) {
    console.error('Failed to create transaction:', e);
    return null;
  }
}

export async function executeBridge(
  wallet: EVMWallet,
  quote: DeBridgeQuote
): Promise<string> {
  console.log('Executing bridge with tx:', {
    to: quote.tx.to,
    data: quote.tx.data?.slice(0, 100) + '...',
    value: quote.tx.value,
  });

  try {
    // Send raw transaction request through MetaMask
    const txHash = await window.ethereum!.request({
      method: 'eth_sendTransaction',
      params: [{
        from: wallet.address,
        to: quote.tx.to,
        data: quote.tx.data,
        value: '0x' + BigInt(quote.tx.value || '0').toString(16),
      }],
    }) as string;

    console.log('Transaction sent:', txHash);

    // Wait for confirmation
    const receipt = await wallet.provider.waitForTransaction(txHash);
    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction failed');
    }
    
    return txHash;
  } catch (e: unknown) {
    console.error('Bridge execution error:', e);
    const err = e as { code?: number | string; message?: string; reason?: string };
    if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
      throw new Error('Transaction rejected by user');
    }
    if (err.reason) {
      throw new Error(err.reason);
    }
    if (err.message) {
      throw new Error(err.message);
    }
    throw e;
  }
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    43114: 'https://snowtrace.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
  };
  return (explorers[chainId] || 'https://etherscan.io/tx/') + txHash;
}

export function formatAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toFixed(6);
}

export function parseAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount) * Math.pow(10, decimals);
  return Math.floor(num).toString();
}

export async function checkOrderStatus(orderId: string): Promise<string> {
  try {
    const url = `${DEBRIDGE_API}/dln/order/${orderId}/status`;
    const response = await fetch(url);
    if (!response.ok) return 'unknown';
    const data = await response.json();
    return data.status || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ERC-20 ABI for approval and allowance
const ERC20_ABI = {
  allowance: 'function allowance(address owner, address spender) view returns (uint256)',
  approve: 'function approve(address spender, uint256 amount) returns (bool)',
  balanceOf: 'function balanceOf(address account) view returns (uint256)',
};

// Check if token needs approval (spender comes from deBridge quote.tx.to)
export async function checkAllowance(
  wallet: EVMWallet,
  tokenAddress: string,
  spender: string,
  amount: string
): Promise<boolean> {
  if (tokenAddress === NATIVE_TOKEN) return true; // Native tokens don't need approval

  console.log('Checking allowance:', { tokenAddress, spender, amount, owner: wallet.address });

  try {
    const { ethers } = await import('ethers');
    const contract = new ethers.Contract(
      tokenAddress,
      [ERC20_ABI.allowance],
      wallet.provider
    );
    
    const allowance = await contract.allowance(wallet.address, spender);
    const hasEnough = BigInt(allowance.toString()) >= BigInt(amount);
    console.log('Current allowance:', allowance.toString(), 'Needs:', amount, 'Has enough:', hasEnough);
    return hasEnough;
  } catch (e) {
    console.error('Failed to check allowance:', e);
    return false;
  }
}

// Approve token spending (spender comes from deBridge quote.tx.to)
export async function approveToken(
  wallet: EVMWallet,
  tokenAddress: string,
  spender: string,
  amount: string
): Promise<string> {
  console.log('Approving token:', { tokenAddress, spender, amount });

  try {
    const { ethers } = await import('ethers');
    
    // Encode approve function call
    const iface = new ethers.Interface([ERC20_ABI.approve]);
    const data = iface.encodeFunctionData('approve', [spender, amount]);

    // Send approval transaction via MetaMask
    const txHash = await window.ethereum!.request({
      method: 'eth_sendTransaction',
      params: [{
        from: wallet.address,
        to: tokenAddress,
        data: data,
      }],
    }) as string;

    console.log('Approval tx sent:', txHash);

    // Wait for confirmation
    const receipt = await wallet.provider.waitForTransaction(txHash);
    if (!receipt || receipt.status === 0) {
      throw new Error('Approval transaction failed');
    }

    console.log('Approval confirmed!');
    return txHash;
  } catch (e: unknown) {
    console.error('Approval error:', e);
    const err = e as { code?: number | string; message?: string };
    if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
      throw new Error('Approval rejected by user');
    }
    throw e;
  }
}

// Get token balance
export async function getTokenBalance(
  wallet: EVMWallet,
  tokenAddress: string
): Promise<string> {
  if (tokenAddress === NATIVE_TOKEN) {
    const balance = await wallet.provider.getBalance(wallet.address);
    return balance.toString();
  }

  try {
    const { ethers } = await import('ethers');
    const contract = new ethers.Contract(
      tokenAddress,
      [ERC20_ABI.balanceOf],
      wallet.provider
    );
    
    const balance = await contract.balanceOf(wallet.address);
    return balance.toString();
  } catch (e) {
    console.error('Failed to get token balance:', e);
    return '0';
  }
}

