/**
 * 恢复码页面
 * 
 * 这个文件定义了显示用户2FA恢复码的页面。
 * 恢复码是用户在无法访问2FA验证器应用时，
 * 用来登录账号的备用机制，是2FA安全体系中的重要组成部分。
 * 
 * 该页面有多重访问限制，确保只有已验证的、启用了2FA的用户
 * 才能查看自己的恢复码。
 */

// 导入所需的组件和功能
import Link from "next/link";  // 导航链接组件
import { getCurrentSession } from "@/lib/server/session";  // 获取当前用户会话
import { getUserRecoverCode } from "@/lib/server/user";  // 获取用户恢复码
import { redirect } from "next/navigation";  // 页面重定向
import { globalGETRateLimit } from "@/lib/server/request";  // 全局请求速率限制

/**
 * 恢复码页面组件
 * 
 * 这个页面组件显示用户的2FA恢复码，仅当用户满足所有安全条件时才会显示。
 * 恢复码应妥善保存，它是在无法使用主要2FA方法时唯一的账号恢复途径。
 * 
 * @returns 恢复码页面内容或重定向指令
 */
export default function Page() {
	// 第一步：检查全局GET请求速率限制
	// 这是防止频繁访问和潜在的信息收集攻击
	if (!globalGETRateLimit()) {
		return "Too many requests";  // 如果请求过于频繁，显示错误信息
	}
	
	// 第二步：获取当前用户的会话信息
	const { session, user } = getCurrentSession();
	
	// 第三步：检查用户是否已登录
	// 如果未登录，重定向到登录页面
	if (session === null) {
		return redirect("/login");
	}
	
	// 第四步：检查用户是否已验证邮箱
	// 邮箱验证是使用2FA和获取恢复码的前置条件
	if (!user.emailVerified) {
		return redirect("/verify-email");  // 如果邮箱未验证，重定向到邮箱验证页面
	}
	
	// 第五步：检查用户是否已启用2FA
	// 只有启用了2FA的用户才需要恢复码
	if (!user.registered2FA) {
		return redirect("/2fa/setup");  // 如果未启用2FA，重定向到2FA设置页面
	}
	
	// 第六步：检查当前会话是否已完成2FA验证
	// 这是一个重要的安全检查，确保只有通过了2FA的用户才能查看恢复码
	if (!session.twoFactorVerified) {
		return redirect("/2fa");  // 如果会话未通过2FA验证，重定向到2FA验证页面
	}
	
	// 第七步：获取用户的恢复码
	// 恢复码保存在服务器端，只有在用户通过所有安全检查后才能获取
	const recoveryCode = getUserRecoverCode(user.id);
	
	// 第八步：渲染恢复码页面
	return (
		<>
			{/* 页面标题 */}
			<h1>Recovery code</h1>
			
			{/* 显示恢复码 */}
			<p>Your recovery code is: {recoveryCode}</p>
			
			{/* 说明恢复码的用途 */}
			<p>You can use this recovery code if you lose access to your second factors.</p>
			
			{/* 提供返回首页的链接 */}
			<Link href="/">Next</Link>
		</>
	);
}

/**
 * 恢复码页面安全说明：
 * 
 * 1. 多重安全检查：
 *    - 速率限制防止频繁访问
 *    - 必须是已登录用户
 *    - 用户必须已验证邮箱
 *    - 用户必须已启用2FA
 *    - 当前会话必须已通过2FA验证
 * 
 * 2. 恢复码的重要性：
 *    - 恢复码是用户在无法使用主要2FA方法时的唯一备用方案
 *    - 如丢失手机、验证器应用重置等情况下，恢复码可确保账号访问
 *    - 用户应将恢复码保存在安全且独立于主要2FA设备的地方
 * 
 * 3. 使用流程：
 *    - 用户完成2FA设置后被显示恢复码
 *    - 用户应立即记录恢复码并安全保存
 *    - 当无法使用主要2FA方法时，用户可在登录流程中使用恢复码
 */
