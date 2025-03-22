/**
 * 双因素认证设置页面
 * ================
 * 
 * 本文件实现了用户设置双因素认证(2FA)的页面，包括：
 * 1. 生成随机TOTP密钥
 * 2. 显示QR码供用户扫描
 * 3. 提供验证表单让用户确认设置成功
 */

import { TwoFactorSetUpForm } from "./components";
import { getCurrentSession } from "@/lib/server/session";
import { encodeBase64 } from "@oslojs/encoding";
import { createTOTPKeyURI } from "@oslojs/otp";
import { redirect } from "next/navigation";
import { renderSVG } from "uqr";
import { globalGETRateLimit } from "@/lib/server/request";

/**
 * 2FA设置页面组件
 * 这个页面负责生成TOTP密钥和QR码，并展示给用户
 */
export default function Page() {
	// 检查请求频率，防止恶意用户发起大量请求
	if (!globalGETRateLimit()) {
		return "Too many requests"; // 请求过多时返回提示信息
	}
	
	// 获取当前用户的会话和用户信息
	const { session, user } = getCurrentSession();
	
	// 如果用户未登录，重定向到登录页
	if (session === null) {
		return redirect("/login");
	}
	
	// 如果用户邮箱未验证，重定向到邮箱验证页
	// 这是一项安全措施，确保只有验证过邮箱的真实用户才能设置2FA
	if (!user.emailVerified) {
		return redirect("/verify-email");
	}
	
	// 如果用户已经设置了2FA，但当前会话未通过2FA验证，则重定向到2FA验证页
	// 这防止了已启用2FA的账户在未完成2FA验证时修改2FA设置
	if (user.registered2FA && !session.twoFactorVerified) {
		return redirect("/2fa");
	}
	
	// 生成一个随机的TOTP密钥（20字节长度）
	// 这个密钥将用于生成和验证TOTP验证码
	const totpKey = new Uint8Array(20);
	crypto.getRandomValues(totpKey); // 使用加密安全的随机数填充数组
	
	// 将二进制密钥转换为Base64编码字符串，方便传输和存储
	const encodedTOTPKey = encodeBase64(totpKey);
	
	// 创建TOTP密钥URI，这将被编码为QR码
	// 参数说明：
	// - "Demo": 应用名称，会显示在身份验证器应用中
	// - user.username: 用户名，帮助用户在验证器中识别不同账户
	// - totpKey: 刚刚生成的TOTP密钥
	// - 30: 验证码更新间隔（秒）
	// - 6: 验证码位数
	const keyURI = createTOTPKeyURI("Demo", user.username, totpKey, 30, 6);
	
	// 将URI转换为SVG格式的QR码
	const qrcode = renderSVG(keyURI);
	
	return (
		<>
			<h1>Set up two-factor authentication</h1>
			{/* 显示QR码供用户扫描 */}
			<div
				style={{
					width: "200px",
					height: "200px"
				}}
				dangerouslySetInnerHTML={{
					__html: qrcode // 使用dangerouslySetInnerHTML插入SVG代码
				}}
			></div>
			{/* 添加验证表单，用户需要输入身份验证器生成的代码来完成设置 */}
			<TwoFactorSetUpForm encodedTOTPKey={encodedTOTPKey} />
		</>
	);
}

/**
 * 使用说明：
 * 1. 用户进入此页面后会看到一个QR码
 * 2. 用户需要使用身份验证器应用（如Google Authenticator）扫描这个QR码
 * 3. 扫描后，应用会自动添加用户的账户，并开始生成6位数的验证码
 * 4. 用户将验证码输入表单并提交，以确认设置成功
 * 5. 验证成功后，用户的2FA将被激活，今后登录需要同时输入密码和验证码
 * 
 * 安全措施：
 * - 页面访问有频率限制，防止恶意请求
 * - 用户必须已经登录并验证了邮箱才能设置2FA
 * - 如果用户已启用2FA，必须先通过2FA验证才能修改设置
 * - TOTP密钥使用加密安全的随机数生成器创建，确保安全性
 */
