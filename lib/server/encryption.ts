/**
 * 数据加密模块 - Data Encryption Module
 * 
 * 这个模块负责提供安全的数据加密和解密功能：
 * - 使用AES-128-GCM算法进行加密和解密
 * - 支持二进制数据(Uint8Array)和字符串的加密
 * - 为每次加密操作生成随机初始化向量(IV)
 * - 包含认证标签(Auth Tag)以验证数据完整性
 * 
 * AES-GCM是一种经过验证的认证加密算法，不仅提供了数据保密性，
 * 而且能够检测数据是否被篡改，为系统提供了更高级别的安全保护。
 */

import { decodeBase64 } from "@oslojs/encoding";
import { createCipheriv, createDecipheriv } from "crypto";
import { DynamicBuffer } from "@oslojs/binary";

/**
 * 加密密钥
 * 
 * 从环境变量中获取Base64编码的加密密钥。
 * 在实际部署中，这个密钥应该妥善保管，且不应出现在代码中。
 * 
 * 注意：如果环境变量未设置，将使用空字符串（这只是一个后备方案，
 * 实际生产环境中必须正确设置密钥）。
 */
const key = decodeBase64(process.env.ENCRYPTION_KEY ?? "");

/**
 * 加密二进制数据
 * 
 * 使用AES-128-GCM算法加密二进制数据，工作流程：
 * 1. 生成16字节的随机初始化向量(IV)
 * 2. 使用密钥和IV创建加密器
 * 3. 加密数据
 * 4. 拼接IV + 加密数据 + 认证标签，生成最终的加密结果
 * 
 * 输出格式: [16字节IV][加密数据][16字节认证标签]
 * 
 * @param data 要加密的二进制数据
 * @returns 加密后的二进制数据
 */
export function encrypt(data: Uint8Array): Uint8Array {
	// 生成16字节的随机初始化向量(IV)
	const iv = new Uint8Array(16);
	crypto.getRandomValues(iv);
	
	// 创建AES-128-GCM加密器
	const cipher = createCipheriv("aes-128-gcm", key, iv);
	
	// 使用动态缓冲区构建加密结果
	const encrypted = new DynamicBuffer(0);
	encrypted.write(iv); // 先写入IV
	encrypted.write(cipher.update(data)); // 写入加密的数据块
	encrypted.write(cipher.final()); // 写入最后的加密数据块
	encrypted.write(cipher.getAuthTag()); // 写入认证标签
	
	return encrypted.bytes(); // 返回完整的加密数据
}

/**
 * 加密字符串
 * 
 * 将字符串转换为UTF-8编码的二进制数据，然后加密。
 * 这是一个便捷函数，内部调用encrypt方法。
 * 
 * @param data 要加密的字符串
 * @returns 加密后的二进制数据
 */
export function encryptString(data: string): Uint8Array {
	return encrypt(new TextEncoder().encode(data)); // 将字符串转换为UTF-8编码的二进制数据并加密
}

/**
 * 解密二进制数据
 * 
 * 解密使用encrypt函数加密的数据，工作流程：
 * 1. 从加密数据中提取IV（前16字节）
 * 2. 从加密数据中提取认证标签（后16字节）
 * 3. 创建解密器并设置认证标签
 * 4. 解密中间部分的数据
 * 
 * 输入格式必须是: [16字节IV][加密数据][16字节认证标签]
 * 
 * @param encrypted 加密的二进制数据
 * @returns 解密后的原始二进制数据
 * @throws 如果数据格式不正确或认证标签不匹配
 */
export function decrypt(encrypted: Uint8Array): Uint8Array {
	// 验证加密数据的最小长度（IV + 至少1字节数据 + 认证标签）
	if (encrypted.byteLength < 33) {
		throw new Error("Invalid data"); // 数据太短，无法包含必要的元素
	}
	
	// 创建解密器，使用前16字节作为IV
	const decipher = createDecipheriv("aes-128-gcm", key, encrypted.slice(0, 16));
	
	// 设置认证标签（后16字节）
	decipher.setAuthTag(encrypted.slice(encrypted.byteLength - 16));
	
	// 使用动态缓冲区构建解密结果
	const decrypted = new DynamicBuffer(0);
	decrypted.write(decipher.update(encrypted.slice(16, encrypted.byteLength - 16))); // 解密主要数据部分
	decrypted.write(decipher.final()); // 完成解密（并验证认证标签）
	
	return decrypted.bytes(); // 返回解密后的数据
}

/**
 * 将加密的二进制数据解密为字符串
 * 
 * 解密二进制数据，然后将结果解释为UTF-8编码的字符串。
 * 这是一个便捷函数，内部调用decrypt方法。
 * 
 * @param data 加密的二进制数据
 * @returns 解密后的字符串
 * @throws 如果数据格式不正确、认证标签不匹配或数据不是有效的UTF-8编码
 */
export function decryptToString(data: Uint8Array): string {
	return new TextDecoder().decode(decrypt(data)); // 解密数据并转换为字符串
}
