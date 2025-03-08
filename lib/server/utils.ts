/**
 * 工具函数模块 - Utility Functions Module
 * 
 * 这个模块提供了通用的辅助功能，主要包括：
 * - 生成安全的随机一次性验证码(OTP)
 * - 生成安全的随机恢复码
 * 
 * 这些函数生成的随机码是加密安全的，使用了密码学安全的
 * 随机数生成器(CSPRNG)，确保生成的码不可预测，适用于
 * 身份验证和账户恢复等安全敏感场景。
 */

import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";

/**
 * 生成随机一次性验证码(OTP)
 * 
 * 生成一个安全的随机验证码，用于邮箱验证和重置密码等场景：
 * 1. 创建5字节(40位)的随机数据
 * 2. 使用Base32编码转换为易读的字符串
 * 
 * 使用Base32编码的好处：
 * - 只包含大写字母和数字，避免了容易混淆的字符
 * - 没有特殊字符，适合在各种界面和通信渠道中使用
 * - 比Base64编码更适合人工输入
 * 
 * 5字节的随机数据经过Base32编码后产生8个字符，
 * 提供了足够的熵(约40位)，使暴力猜测变得不可行。
 * 
 * @returns 8个字符的随机验证码
 */
export function generateRandomOTP(): string {
    // 生成5字节的随机数据
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes); // 使用加密安全的随机数生成器
    
    // 将随机字节数据编码为Base32字符串
    const code = encodeBase32UpperCaseNoPadding(bytes);
    
    return code; // 返回8字符的验证码
}

/**
 * 生成随机恢复码
 * 
 * 生成一个安全的随机恢复码，用于2FA恢复和账户重置等场景：
 * 1. 创建10字节(80位)的随机数据
 * 2. 使用Base32编码转换为易读的字符串
 * 
 * 恢复码比普通OTP更长，因为：
 * - 恢复码通常使用频率较低，可以接受更长的代码
 * - 恢复码可以绕过2FA等安全机制，需要更高的安全性
 * - 更长的代码降低了被猜测的可能性
 * 
 * 10字节的随机数据经过Base32编码后产生16个字符，
 * 提供了更高的熵(约80位)，使暴力猜测几乎不可能。
 * 
 * @returns 16个字符的随机恢复码
 */
export function generateRandomRecoveryCode(): string {
    // 生成10字节的随机数据
    const recoveryCodeBytes = new Uint8Array(10);
    crypto.getRandomValues(recoveryCodeBytes); // 使用加密安全的随机数生成器
    
    // 将随机字节数据编码为Base32字符串
    const recoveryCode = encodeBase32UpperCaseNoPadding(recoveryCodeBytes);
    
    return recoveryCode; // 返回16字符的恢复码
}
