/**
 * Stealth Addresses for Pridge
 * 
 * Allows users to have a reusable "stealth meta-address" that generates
 * unique, unlinkable one-time addresses for each payment.
 * 
 * Simplified implementation using Solana keypairs directly.
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Stealth Meta-Address contains two keys:
 * - Spending key: Used to derive private keys for claiming
 * - Viewing key: Used to scan for incoming payments
 */
export interface StealthMetaAddress {
  spendingPubKey: Uint8Array;  // 32 bytes
  viewingPubKey: Uint8Array;   // 32 bytes
}

/**
 * Full stealth wallet (receiver keeps this secret)
 */
export interface StealthWallet {
  spendingKeypair: Keypair;
  viewingKeypair: Keypair;
  metaAddress: string;
}

/**
 * One-time address data (published by sender)
 */
export interface StealthPayment {
  oneTimeAddress: PublicKey;    // Where funds are sent
  ephemeralPubKey: Uint8Array;  // Published so receiver can derive key
}

// Prefix for encoded stealth meta-addresses
const STEALTH_PREFIX = 'st1';

/**
 * Generate a new stealth wallet
 */
export function generateStealthWallet(): StealthWallet {
  // Generate spending and viewing keypairs
  const spendingKeypair = Keypair.generate();
  const viewingKeypair = Keypair.generate();
  
  // Encode meta-address: prefix + spending pub + viewing pub
  const metaBytes = new Uint8Array(64);
  metaBytes.set(spendingKeypair.publicKey.toBytes(), 0);
  metaBytes.set(viewingKeypair.publicKey.toBytes(), 32);
  const metaAddress = STEALTH_PREFIX + bs58.encode(metaBytes);
  
  return {
    spendingKeypair,
    viewingKeypair,
    metaAddress,
  };
}

/**
 * Parse a stealth meta-address string
 */
export function parseMetaAddress(metaAddress: string): StealthMetaAddress | null {
  try {
    if (!metaAddress.startsWith(STEALTH_PREFIX)) {
      return null;
    }
    
    const encoded = metaAddress.slice(STEALTH_PREFIX.length);
    const bytes = bs58.decode(encoded);
    
    if (bytes.length !== 64) {
      return null;
    }
    
    return {
      spendingPubKey: bytes.slice(0, 32),
      viewingPubKey: bytes.slice(32, 64),
    };
  } catch {
    return null;
  }
}

/**
 * Derive a one-time stealth address from a meta-address (sender side)
 * 
 * Simple approach: Generate a random keypair, hash with viewing key to get deterministic address
 */
export async function deriveStealthAddress(metaAddress: string): Promise<StealthPayment | null> {
  const meta = parseMetaAddress(metaAddress);
  if (!meta) {
    return null;
  }
  
  // Generate ephemeral keypair
  const ephemeralKeypair = Keypair.generate();
  
  // Create shared secret by combining ephemeral secret + viewing public key
  const combined = new Uint8Array(64);
  combined.set(ephemeralKeypair.secretKey.slice(0, 32), 0);
  combined.set(meta.viewingPubKey, 32);
  
  // Hash to get a seed for the one-time address
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const seed = new Uint8Array(hashBuffer);
  
  // Derive one-time keypair from the seed
  const oneTimeKeypair = Keypair.fromSeed(seed);
  
  return {
    oneTimeAddress: oneTimeKeypair.publicKey,
    ephemeralPubKey: ephemeralKeypair.publicKey.toBytes(),
  };
}

/**
 * Derive the private key for a stealth payment (receiver side)
 */
export async function deriveStealthPrivateKey(
  wallet: StealthWallet,
  ephemeralPubKey: Uint8Array
): Promise<Keypair | null> {
  try {
    // Recreate the shared secret using viewing private key + ephemeral public key
    const combined = new Uint8Array(64);
    combined.set(wallet.viewingKeypair.secretKey.slice(0, 32), 0);
    combined.set(ephemeralPubKey, 32);
    
    // Hash to get the same seed
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const seed = new Uint8Array(hashBuffer);
    
    // Derive the same one-time keypair
    return Keypair.fromSeed(seed);
  } catch (e) {
    console.error('Failed to derive stealth private key:', e);
    return null;
  }
}

/**
 * Check if a payment belongs to this stealth wallet
 */
export async function checkStealthPayment(
  wallet: StealthWallet,
  ephemeralPubKey: Uint8Array,
  paymentAddress: PublicKey
): Promise<boolean> {
  const derivedKeypair = await deriveStealthPrivateKey(wallet, ephemeralPubKey);
  if (!derivedKeypair) {
    return false;
  }
  
  return derivedKeypair.publicKey.equals(paymentAddress);
}

/**
 * Export stealth wallet to a storable format
 */
export function exportStealthWallet(wallet: StealthWallet): string {
  const data = {
    spending: bs58.encode(wallet.spendingKeypair.secretKey),
    viewing: bs58.encode(wallet.viewingKeypair.secretKey),
  };
  return btoa(JSON.stringify(data));
}

/**
 * Import stealth wallet from stored format
 */
export function importStealthWallet(encoded: string): StealthWallet | null {
  try {
    const data = JSON.parse(atob(encoded));
    const spendingKeypair = Keypair.fromSecretKey(bs58.decode(data.spending));
    const viewingKeypair = Keypair.fromSecretKey(bs58.decode(data.viewing));
    
    // Reconstruct meta-address
    const metaBytes = new Uint8Array(64);
    metaBytes.set(spendingKeypair.publicKey.toBytes(), 0);
    metaBytes.set(viewingKeypair.publicKey.toBytes(), 32);
    const metaAddress = STEALTH_PREFIX + bs58.encode(metaBytes);
    
    return {
      spendingKeypair,
      viewingKeypair,
      metaAddress,
    };
  } catch {
    return null;
  }
}

/**
 * Encode ephemeral public key for storage/transmission
 */
export function encodeEphemeralKey(ephemeralPubKey: Uint8Array): string {
  return bs58.encode(ephemeralPubKey);
}

/**
 * Decode ephemeral public key from storage/transmission
 */
export function decodeEphemeralKey(encoded: string): Uint8Array {
  return bs58.decode(encoded);
}
