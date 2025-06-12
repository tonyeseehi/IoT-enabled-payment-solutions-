import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const address1 = accounts.get('wallet_1')!;
const address2 = accounts.get('wallet_2')!;
const address3 = accounts.get('wallet_3')!;
const contractAddress = accounts.get('deployer')!;

const contractName = 'IoT-enabled_payment';

describe('IoT Payment Contract', () => {
  beforeEach(() => {
    // Reset simnet state before each test
    simnet.setEpoch('3.0');
  });

  describe('Device Registration', () => {
    it('should register a new device successfully', () => {
      const deviceId = 'device-001';
      const ratePerUse = 1000;

      const { result } = simnet.callPublicFn(
        contractName,
        'register-device',
        [Cl.stringAscii(deviceId), Cl.uint(ratePerUse)],
        address1
      );

      expect(result).toBeOk(Cl.stringAscii(deviceId));
    });

    it('should set correct device properties when registering', () => {
      const deviceId = 'device-002';
      const ratePerUse = 2000;

      // Register device
      simnet.callPublicFn(
        contractName,
        'register-device',
        [Cl.stringAscii(deviceId), Cl.uint(ratePerUse)],
        address1
      );

      // Check device info
      const { result } = simnet.callReadOnlyFn(
        contractName,
        'get-device-info',
        [Cl.stringAscii(deviceId)],
        address1
      );

      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(address1),
          balance: Cl.uint(0),
          'rate-per-use': Cl.uint(ratePerUse),
          active: Cl.bool(true)
        })
      );
    });

    it('should allow multiple devices to be registered by same owner', () => {
      const device1 = 'device-multi-1';
      const device2 = 'device-multi-2';

      const result1 = simnet.callPublicFn(
        contractName,
        'register-device',
        [Cl.stringAscii(device1), Cl.uint(1000)],
        address1
      );

      const result2 = simnet.callPublicFn(
        contractName,
        'register-device',
        [Cl.stringAscii(device2), Cl.uint(2000)],
        address1
      );

      expect(result1.result).toBeOk(Cl.stringAscii(device1));
      expect(result2.result).toBeOk(Cl.stringAscii(device2));
    });

    it('should allow overwriting existing device registration', () => {
      const deviceId = 'device-overwrite';
      const initialRate = 1000;
      const newRate = 5000;

      // Register device first time
      simnet.callPublicFn(
        contractName,
        'register-device',
        [Cl.stringAscii(deviceId), Cl.uint(initialRate)],
        address1
      );

      // Register same device again with different rate
      const { result } = simnet.callPublicFn(
        contractName,
        'register-device',
        [Cl.stringAscii(deviceId), Cl.uint(newRate)],
        address2
      );

      expect(result).toBeOk(Cl.stringAscii(deviceId));

      // Verify new owner and rate
      const deviceInfo = simnet.callReadOnlyFn(
        contractName,
        'get-device-info',
        [Cl.stringAscii(deviceId)],
        address1
      );

      expect(deviceInfo.result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(address2),
          balance: Cl.uint(0),
          'rate-per-use': Cl.uint(newRate),
          active: Cl.bool(true)
        })
      );
    });
  });

  describe('Payment for Usage', () => {
    beforeEach(() => {
      // Register a test device before each payment test
      simnet.callPublicFn(
        contractName,
        'register-device',
        [Cl.stringAscii('test-device'), Cl.uint(1000)],
        address1
      );
    });

    it('should process payment successfully with exact amount', () => {
      const { result } = simnet.callPublicFn(
        contractName,
        'pay-for-usage',
        [Cl.stringAscii('test-device'), Cl.uint(1000)],
        address2
      );

      expect(result).toBeOk(Cl.uint(1));
    });

    it('should process payment successfully with amount greater than rate', () => {
      const { result } = simnet.callPublicFn(
        contractName,
        '