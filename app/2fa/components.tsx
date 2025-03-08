/**
 * 双因素认证(2FA)验证表单组件
 * 
 * 这个文件实现了双因素认证验证页面的表单组件，用于用户输入并提交
 * 来自验证器应用程序(如Google Authenticator)的6位数验证码。
 * 
 * 双因素认证提供了比单纯密码登录更高的安全保障，因为即使密码泄露，
 * 攻击者没有用户的验证器设备也无法登录账号。
 */

"use client"; // 这个标记表示这是一个客户端组件，会在浏览器中运行

// 导入必要的函数和钩子
import { verify2FAAction } from "./actions"; // 导入处理2FA验证的服务器动作
import { useFormState } from "react-dom"; // 导入表单状态管理钩子

/**
 * 表单初始状态
 * 
 * 定义了表单的初始状态，包含一个空的错误消息
 * 这个状态会在表单提交后被更新，用于显示验证失败的原因
 */
const initial2FAVerificationState = {
	message: "" // 初始时没有消息
};

/**
 * 双因素认证验证表单组件
 * 
 * 这个组件创建一个简单的表单，让用户输入6位数的验证码并提交验证
 * 
 * @returns React组件，显示2FA验证码输入表单
 */
export function TwoFactorVerificationForm() {
	// useFormState钩子用于管理表单状态
	// - verify2FAAction: 表单提交时调用的服务器动作函数
	// - initial2FAVerificationState: 表单的初始状态
	// - state: 当前表单状态，包含服务器返回的消息
	// - action: 提交表单时调用的函数
	const [state, action] = useFormState(verify2FAAction, initial2FAVerificationState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 验证码输入字段 */}
			<label htmlFor="form-totp.code">Code</label>
			<input 
				id="form-totp.code" // 输入框的ID，与label关联
				name="code" // 输入框的名称，服务器会用这个名称获取值
				autoComplete="one-time-code" // 设置自动填充属性为一次性代码，浏览器可能会填充收到的短信验证码
				required // 必填字段
			/>
			<br />
			
			{/* 提交按钮 */}
			<button>Verify</button>
			
			{/* 显示验证状态消息，如错误提示 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 组件工作流程:
 * 
 * 1. 用户已经完成用户名和密码登录后被导向此页面
 * 2. 用户打开其手机上的验证器应用(如Google Authenticator)
 * 3. 用户查看应用上显示的与其账号关联的6位数代码
 * 4. 用户将这个6位数代码输入到表单中
 * 5. 用户点击"Verify"按钮提交验证码
 * 6. 验证码发送到服务器进行验证(由actions.ts处理)
 * 7. 如果验证成功，用户会被重定向到首页
 * 8. 如果验证失败，会显示错误消息
 * 
 * 注意：
 * - 验证码每30秒更新一次，用户需要输入当前有效的验证码
 * - 页面没有自动刷新功能，如果验证码过期，用户需要重新输入新验证码
 * - 没有提供恢复代码入口，通常可以添加"使用恢复代码"链接
 */
