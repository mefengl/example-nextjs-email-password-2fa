"use server"; // 声明这是一个服务器端组件，这意味着这个文件中的代码只会在服务器上运行，不会在浏览器中运行

/**
 * 双因素认证设置功能相关操作
 * ======================
 * 
 * 本文件实现了设置双因素认证(2FA)的服务器端功能。双因素认证是一种安全机制，
 * 要求用户除了使用密码登录外，还需要提供第二种验证方式（在这里是通过TOTP生成的验证码）。
 * 
 * TOTP是"基于时间的一次性密码"(Time-based One-Time Password)的缩写，它根据：
 * 1. 一个密钥（这里是20字节的密钥）
 * 2. 当前时间
 * 生成一个短时间内有效的6位数字验证码。
 * 
 * 比如你可能见过的Google Authenticator、Microsoft Authenticator这类应用
 * 就是使用TOTP生成验证码的常见工具。用户在登录时需要打开这类应用，
 * 查看当前生成的验证码并输入到登录页面。
 */

import { RefillingTokenBucket } from "@/lib/server/rate-limit";
import { globalPOSTRateLimit } from "@/lib/server/request";
import { getCurrentSession, setSessionAs2FAVerified } from "@/lib/server/session";
import { updateUserTOTPKey } from "@/lib/server/user";
import { decodeBase64 } from "@oslojs/encoding";
import { verifyTOTP } from "@oslojs/otp";
import { redirect } from "next/navigation";

/**
 * 创建一个令牌桶限流器，用于限制用户尝试设置2FA的次数
 * 参数说明：
 * - 3: 每个用户最多可以在指定时间内尝试3次
 * - 60 * 10: 在10分钟内的尝试次数限制
 * 
 * 这种限流机制可以防止恶意用户通过暴力破解尝试设置他人的2FA
 * 比如小明尝试了3次设置2FA后，他需要等待10分钟才能再次尝试
 */
const totpUpdateBucket = new RefillingTokenBucket<number>(3, 60 * 10);

/**
 * 设置双因素认证的主要函数
 * 接收表单数据并处理2FA设置请求
 * 
 * @param _prev 前一个操作的结果（Next.js的表单处理机制需要）
 * @param formData 包含用户提交的表单数据，我们需要从中获取密钥和验证码
 * @returns 返回操作结果，可能是错误信息或重定向指令
 */
export async function setup2FAAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// 全局POST请求速率限制检查，防止整个系统被大量请求攻击
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests" // 请求太多，被限流
		};
	}

	// 获取当前用户的会话和用户信息
	const { session, user } = getCurrentSession();
	
	// 检查用户是否已登录，未登录则拒绝操作
	if (session === null) {
		return {
			message: "Not authenticated" // 未认证，可能是未登录或会话已过期
		};
	}

	// 检查用户邮箱是否已验证，未验证则拒绝设置2FA
	// 这是一项安全措施，确保只有验证过邮箱的真实用户才能设置2FA
	if (!user.emailVerified) {
		return {
			message: "Forbidden" // 禁止操作，因为邮箱未验证
		};
	}

	// 如果用户已经注册了2FA，但当前会话未通过2FA验证，则拒绝操作
	// 这防止了攻击者在获取用户密码后绕过2FA直接修改2FA设置
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden" // 禁止操作，需要先通过2FA验证
		};
	}

	// 检查用户是否达到了设置2FA的尝试次数限制
	if (!totpUpdateBucket.check(user.id, 1)) {
		return {
			message: "Too many requests" // 用户尝试次数过多，被限流
		};
	}

	// 从表单数据中获取密钥和验证码
	const encodedKey = formData.get("key"); // Base64编码的TOTP密钥
	const code = formData.get("code");      // 用户输入的6位验证码
	
	// 验证获取的数据是否为字符串类型
	if (typeof encodedKey !== "string" || typeof code !== "string") {
		return {
			message: "Invalid or missing fields" // 数据类型错误或缺少字段
		};
	}

	// 检查验证码是否为空
	if (code === "") {
		return {
			message: "Please enter your code" // 提示用户输入验证码
		};
	}

	// 检查密钥长度是否正确（Base64编码后的20字节密钥为28个字符）
	if (encodedKey.length !== 28) {
		return {
			message: "Please enter your code" // 密钥长度不符
		};
	}

	// 尝试解码Base64密钥
	let key: Uint8Array;
	try {
		key = decodeBase64(encodedKey);
	} catch {
		return {
			message: "Invalid key" // 密钥解码失败，格式不正确
		};
	}

	// 验证解码后的密钥长度是否为20字节（TOTP标准要求）
	if (key.byteLength !== 20) {
		return {
			message: "Invalid key" // 解码后密钥长度不符
		};
	}

	// 消耗用户的尝试次数配额
	// 这一步放在实际验证前，是为了防止暴力破解攻击
	if (!totpUpdateBucket.consume(user.id, 1)) {
		return {
			message: "Too many requests" // 再次检查限流，以防在处理过程中达到限制
		};
	}

	// 验证用户提供的验证码是否正确
	// 参数说明：
	// - key: TOTP密钥
	// - 30: 时间窗口为30秒（TOTP每30秒更新一次验证码）
	// - 6: 验证码位数为6位
	// - code: 用户输入的验证码
	if (!verifyTOTP(key, 30, 6, code)) {
		return {
			message: "Invalid code" // 验证码不正确或已过期
		};
	}

	// 验证成功，更新用户的TOTP密钥到数据库
	updateUserTOTPKey(session.userId, key);
	
	// 标记当前会话已通过2FA验证
	setSessionAs2FAVerified(session.id);
	
	// 重定向到恢复码页面，让用户获取恢复码
	// 恢复码用于在用户丢失2FA设备时，仍能登录账户
	return redirect("/recovery-code");
}

/**
 * 定义操作结果的接口类型
 * 操作结果包含一个message字段，用于向用户显示操作状态或错误信息
 */
interface ActionResult {
	message: string;
}

/**
 * 总体流程说明：
 * 1. 用户请求设置2FA，前端生成TOTP密钥并显示QR码
 * 2. 用户用身份验证器应用扫描QR码
 * 3. 用户输入身份验证器生成的验证码
 * 4. 服务器验证码是否正确，正确则保存TOTP密钥
 * 5. 用户被重定向到恢复码页面，获取紧急情况下使用的恢复码
 * 
 * 完成后，用户今后登录时除了输入密码，还需要输入身份验证器生成的验证码
 */
