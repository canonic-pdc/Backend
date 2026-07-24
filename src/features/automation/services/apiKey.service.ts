import crypto from 'crypto';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { AppError } from '@shared/errors';
import { UserAutomationMetadata } from '@shared/types';
import { GenerateKeyResponseDto, ResetDeviceResponseDto } from '../types/automation.types';

export class ApiKeyService {
  /**
   * Menggenerasi API Key baru berformat "cnk_live_<hex_random>",
   * menyimpan hash SHA-256 ke profil user beserta prefix dan status active.
   */
  public async generateOrRegenerateKey(userId: string): Promise<GenerateKeyResponseDto> {
    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      throw new AppError('Firebase Database not initialized', 503);
    }

    // 1. Generate cryptographically strong random key
    const randomHex = crypto.randomBytes(24).toString('hex');
    const plainKey = `cnk_live_${randomHex}`;

    // 2. Compute SHA-256 Hash
    const automationKeyHash = crypto.createHash('sha256').update(plainKey).digest('hex');

    // 3. Extract prefix (8 chars after prefix identifier or first 16 chars)
    const automationKeyPrefix = plainKey.substring(0, 16) + '...';

    // 4. Check user existence & Update document via Admin SDK
    const docRef = db.collection('users').doc(userId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new AppError(`User profile with ID ${userId} does not exist in database`, 404);
    }

    const now = new Date().toISOString();
    const updatePayload: UserAutomationMetadata & { updatedAt: string } = {
      automationKeyHash,
      automationKeyPrefix,
      automationKeyStatus: 'active',
      registeredDeviceId: null, // Reset device binding every time key is regenerated
      registeredDeviceName: null,
      automationLastUsedAt: null,
      automationLastUsedIp: null,
      updatedAt: now,
    };

    // Use set with merge to safely update metadata fields
    await docRef.set(updatePayload, { merge: true });

    return {
      success: true,
      plainKey,
      message: 'API Key generated successfully. Save this secret key safely, it will not be shown again.',
    };
  }

  /**
   * Reset binding hardware/device ID komputer yang terikat pada akun user tertentu.
   * Hanya admin yang boleh memanggil fungsi ini (diperiksa pada level rute/middleware).
   */
  public async resetDeviceBinding(targetUserId: string): Promise<ResetDeviceResponseDto> {
    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      throw new AppError('Firebase Database not initialized', 503);
    }

    const docRef = db.collection('users').doc(targetUserId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new AppError(`Target user profile with ID ${targetUserId} does not exist`, 404);
    }

    const userData = docSnap.data() || {};
    if (!userData.registeredDeviceId) {
      return {
        success: true,
        message: `User ${targetUserId} currently has no registered device binding. No action taken.`,
      };
    }

    const now = new Date().toISOString();
    await docRef.update({
      registeredDeviceId: null,
      registeredDeviceName: null,
      updatedAt: now,
    });

    return {
      success: true,
      message: `Device binding for user ${targetUserId} has been successfully reset.`,
    };
  }
  /**
   * Revoke the API key for a given user by marking automationKeyStatus as 'revoked'.
   */
  public async revokeKey(targetUserId: string): Promise<{ success: boolean; message: string }> {
    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      throw new AppError('Firebase Database not initialized', 503);
    }

    const docRef = db.collection('users').doc(targetUserId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new AppError(`Target user profile with ID ${targetUserId} does not exist`, 404);
    }

    const userData = docSnap.data() || {};
    if (!userData.automationKeyHash) {
      throw new AppError(`User ${targetUserId} does not have an API key`, 400);
    }

    if (userData.automationKeyStatus === 'revoked') {
      return { success: true, message: `User ${targetUserId}'s API key is already revoked.` };
    }

    const now = new Date().toISOString();
    await docRef.update({
      automationKeyStatus: 'revoked',
      updatedAt: now,
    });

    return {
      success: true,
      message: `API Key for user ${targetUserId} has been successfully revoked.`,
    };
  }
}

export default new ApiKeyService();
