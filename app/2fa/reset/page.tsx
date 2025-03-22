/**
 * 双因素认证(2FA)重置页面
 * ===================
 * 
 * 本文件实现了允许用户重置双因素认证的页面。
 * 当用户无法访问其身份验证器应用（如丢失手机或更换设备）时，
 * 可以通过此页面使用恢复码重置2FA，然后重新设置。
 */

import { TwoFactorResetForm } from "./components";
import { getCurrentSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { globalGETRateLimit } from "@/lib/server/request";

/**
 * 2FA重置页面组件
 * 提供重置2FA的表单和相关说明
 */
export default function Page() {
	// 检查请求频率，防止恶意用户发起大量请求
	if (!globalGETRateLimit()) {
		return "Too many requests"; // 请求过多时返回提示信息
	}
	
	// 获取当前用户的会话和用户信息
	const { session, user } = getCurrentSession();
	
	// 安全检查：用户必须已登录
	if (session === null) {
		return redirect("/login"); // 未登录用户重定向到登录页
	}
	
	// 安全检查：用户必须已验证邮箱
	if (!user.emailVerified) {
		return redirect("/verify-email"); // 邮箱未验证的用户重定向到邮箱验证页
	}
	
	// 如果用户尚未注册2FA，重定向到2FA设置页面
	// 不需要重置未设置的功能
	if (!user.registered2FA) {
		return redirect("/2fa/setup");
	}
	
	// 如果用户的会话已经通过2FA验证，重定向到首页
	// 已验证用户不需要重置2FA
	if (session.twoFactorVerified) {
		return redirect("/");
	}
	
	// 渲染2FA重置页面
	return (
		<>
			<h1>Recover your account</h1>
			<TwoFactorResetForm />
		</>
	);
}

/**
 * 使用场景：
 * 1. 用户丢失了设置2FA的设备（如手机）
 * 2. 用户更换了设备，无法访问之前的身份验证器应用
 * 3. 用户的身份验证器应用出现问题，无法生成正确的验证码
 * 
 * 使用流程：
 * 1. 用户访问这个页面
 * 2. 用户输入之前在设置2FA时保存的恢复码
 * 3. 系统验证恢复码是否正确
 * 4. 如果正确，系统会禁用用户的当前2FA设置，并引导用户重新设置
 * 
 * 安全考虑：
 * - 页面访问有频率限制，防止恶意请求
 * - 必须是已登录且验证过邮箱的用户才能访问
 * - 已经通过2FA验证的会话不允许重置2FA，防止降低账户安全级别
 * - 恢复码验证尝试次数有限制，防止暴力破解
 */
