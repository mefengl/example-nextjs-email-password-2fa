/**
 * 用户设置页面
 * 
 * 这个文件定义了用户设置页面，包含以下主要功能区域：
 * 1. 邮箱管理（显示当前邮箱和更新表单）
 * 2. 密码管理（更新密码表单）
 * 3. 双因素认证管理（如果已启用）
 * 4. 恢复码管理（如果已启用2FA）
 * 
 * 这个页面受到保护，只有已登录用户才能访问，
 * 并且如果用户启用了2FA，还需要完成2FA验证。
 */

// 导入所需的组件和函数
import Link from "next/link";  // 导航链接组件
import { RecoveryCodeSection, UpdateEmailForm, UpdatePasswordForm } from "./components";  // 导入设置页组件
import { getCurrentSession } from "@/lib/server/session";  // 获取当前会话
import { redirect } from "next/navigation";  // 页面重定向
import { getUserRecoverCode } from "@/lib/server/user";  // 获取用户恢复码
import { globalGETRateLimit } from "@/lib/server/request";  // 全局请求速率限制

/**
 * 用户设置页面组件
 * 
 * 这是Next.js页面组件，用于渲染用户设置页面。
 * 在渲染前会进行一系列检查，确保只有授权用户才能访问此页面，
 * 并根据用户的2FA状态显示不同的设置选项。
 * 
 * @returns 用户设置页面内容或重定向指令
 */
export default function Page() {
	// 第一步：检查请求频率，防止频繁访问
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
	
	// 第四步：检查2FA验证状态
	// 如果用户已启用2FA但尚未在当前会话中完成2FA验证，重定向到2FA验证页面
	if (user.registered2FA && !session.twoFactorVerified) {
		return redirect("/2fa");
	}
	
	// 第五步：获取恢复码（如果用户已设置2FA）
	let recoveryCode: string | null = null;
	if (user.registered2FA) {
		recoveryCode = getUserRecoverCode(user.id);
	}
	
	// 第六步：渲染设置页面
	return (
		<>
			{/* 页面导航头部 */}
			<header>
				<Link href="/">Home</Link>
				<Link href="/settings">Settings</Link>
			</header>
			
			{/* 主要内容区域 */}
			<main>
				{/* 页面标题 */}
				<h1>Settings</h1>
				
				{/* 邮箱更新部分 */}
				<section>
					<h2>Update email</h2>
					{/* 显示当前邮箱 */}
					<p>Your email: {user.email}</p>
					{/* 邮箱更新表单组件 */}
					<UpdateEmailForm />
				</section>
				
				{/* 密码更新部分 */}
				<section>
					<h2>Update password</h2>
					{/* 密码更新表单组件 */}
					<UpdatePasswordForm />
				</section>
				
				{/* 双因素认证管理部分（仅当用户已启用2FA时显示） */}
				{user.registered2FA && (
					<section>
						<h2>Update two-factor authentication</h2>
						{/* 链接到2FA设置页面 */}
						<Link href="/2fa/setup">Update</Link>
					</section>
				)}
				
				{/* 恢复码管理部分（仅当用户已启用2FA时显示） */}
				{recoveryCode !== null && <RecoveryCodeSection recoveryCode={recoveryCode} />}
			</main>
		</>
	);
}

/**
 * 用户设置页面流程说明：
 * 
 * 1. 访问控制：
 *    - 速率限制防止对设置页面的频繁访问
 *    - 用户必须已登录才能访问设置页面
 *    - 启用2FA的用户必须完成2FA验证
 * 
 * 2. 页面内容：
 *    - 根据用户配置动态显示设置选项
 *    - 所有用户都能看到邮箱和密码更新选项
 *    - 仅启用2FA的用户能看到2FA管理和恢复码部分
 * 
 * 3. 安全考量：
 *    - 敏感设置页面有多重保护机制
 *    - 恢复码仅在确认用户身份（包括2FA验证）后才显示
 *    - 提供导航链接方便用户在完成操作后离开设置页面
 */
