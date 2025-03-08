/**
 * 两因素认证(2FA)模块 - Two-Factor Authentication Module
 * 
 * 这个模块负责处理与两因素认证相关的所有功能，包括：
 * - 基于时间的一次性密码(TOTP)验证
 * - 恢复码管理与验证
 * - 对2FA验证操作进行速率限制，防止暴力攻击
 * 
 * 两因素认证是一种重要的安全机制，要求用户提供两种不同类型的凭证：
 * 1. 用户知道的东西（密码）
 * 2. 用户拥有的东西（如验证器应用生成的TOTP码）
 * 这大大提高了账户安全性，即使密码泄露，攻击者也无法登录账户。
 */

import { db } from "./db";
import { decryptToString, encryptString } from "./encryption";
import { ExpiringTokenBucket } from "./rate-limit";
import { generateRandomRecoveryCode } from "./utils";

/**
 * TOTP验证的速率限制桶
 * 
 * 限制用户尝试TOTP验证的次数，防止暴力破解：
 * - 每个用户ID每30分钟最多允许5次尝试
 * - 用完尝试次数后，用户必须等待时间到期
 * 
 * 这种机制可以有效防止攻击者通过尝试所有可能的6位数组合(000000-999999)来破解TOTP。
 */
export const totpBucket = new ExpiringTokenBucket<number>(5, 60 * 30); // 5次尝试，30分钟过期

/**
 * 恢复码验证的速率限制桶
 * 
 * 限制用户尝试恢复码验证的次数，防止暴力破解：
 * - 每个用户ID每60分钟最多允许3次尝试
 * - 用完尝试次数后，用户必须等待时间到期
 * 
 * 恢复码通常比TOTP更加敏感，因为它允许用户重置2FA设置，
 * 因此这里的限制更加严格。
 */
export const recoveryCodeBucket = new ExpiringTokenBucket<number>(3, 60 * 60); // 3次尝试，1小时过期

/**
 * 使用恢复码重置用户的2FA设置
 * 
 * 当用户无法访问其TOTP验证器设备时，可以使用此函数通过恢复码重置2FA：
 * 1. 验证提供的恢复码是否匹配用户存储的恢复码
 * 2. 生成新的恢复码（一次性使用后就更新）
 * 3. 重置用户的2FA设置（删除TOTP密钥）
 * 4. 将用户所有会话标记为未通过2FA验证
 * 
 * 注意：在并发场景中，这些操作应该在数据库事务中进行，
 * 特别是在PostgreSQL和MySQL等数据库中使用SELECT FOR UPDATE来防止竞态条件。
 * 
 * @param userId 要重置2FA的用户ID
 * @param recoveryCode 用户提供的恢复码
 * @returns 如果重置成功则返回true，否则返回false
 */
export function resetUser2FAWithRecoveryCode(userId: number, recoveryCode: string): boolean {
    // 注意：在Postgres和MySQL中，这些查询应该在事务中使用SELECT FOR UPDATE进行
    const row = db.queryOne("SELECT recovery_code FROM user WHERE id = ?", [userId]);
    if (row === null) {
        return false; // 用户不存在
    }
    
    // 获取并解密存储的恢复码
    const encryptedRecoveryCode = row.bytes(0);
    const userRecoveryCode = decryptToString(encryptedRecoveryCode);
    
    // 验证提供的恢复码是否匹配
    if (recoveryCode !== userRecoveryCode) {
        return false; // 恢复码不匹配
    }
    
    // 生成新的恢复码并加密
    const newRecoveryCode = generateRandomRecoveryCode();
    const encryptedNewRecoveryCode = encryptString(newRecoveryCode);
    
    // 将用户所有会话标记为未通过2FA验证
    // 这样用户需要在所有设备上重新完成2FA流程
    db.execute("UPDATE session SET two_factor_verified = 0 WHERE user_id = ?", [userId]);
    
    // 更新用户记录：设置新的恢复码并删除TOTP密钥
    // 通过比较旧恢复码来确保恢复码在此过程中未被更改（避免竞态条件）
    const result = db.execute("UPDATE user SET recovery_code = ?, totp_key = NULL WHERE id = ? AND recovery_code = ?", [
        encryptedNewRecoveryCode,
        userId,
        encryptedRecoveryCode
    ]);
    
    return result.changes > 0; // 如果更新成功则返回true
}
