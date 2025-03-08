/**
 * 密码重置表单组件模块
 * 
 * 这个文件实现了密码重置流程的最后一步表单组件，
 * 允许用户在完成身份验证后（邮箱验证和可能的2FA验证）
 * 输入并提交新的密码。
 */

"use client"; // 这个标记表示这是一个客户端组件，会在浏览器中运行

// 导入必要的函数和钩子
import { useFormState } from "react-dom"; // 导入表单状态管理钩子
import { resetPasswordAction } from "./actions"; // 导入处理密码重置的服务器动作

/**
 * 密码重置表单初始状态
 * 
 * 定义了密码重置表单的初始状态，包含一个空的消息
 * 这个状态会在表单提交后被更新，用于显示处理结果或错误信息
 */
const initialPasswordResetState = {
	message: "" // 初始时没有消息
};

/**
 * 密码重置表单组件
 * 
 * 这个组件创建一个简单的表单，让用户输入新密码
 * 
 * @returns React组件，显示密码重置表单界面
 */
export function PasswordResetForm() {
	// useFormState钩子用于管理表单状态
	// - resetPasswordAction: 表单提交时调用的服务器动作函数
	// - initialPasswordResetState: 表单的初始状态
	// - state: 当前表单状态，包含服务器返回的消息
	// - action: 提交表单时调用的函数
	const [state, action] = useFormState(resetPasswordAction, initialPasswordResetState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 密码输入字段 */}
			<label htmlFor="form-reset.password">Password</label>
			<input 
				type="password" // 输入类型为password，输入内容会被隐藏
				id="form-reset.password" // 输入框的ID，与label关联
				name="password" // 输入框的名称，服务器会用这个名称获取值
				autoComplete="new-password" // 告诉浏览器这是设置新密码的字段
				required // 必填字段
			/>
			<br />
			
			{/* 提交按钮 */}
			<button>Reset password</button>
			
			{/* 显示处理结果消息 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 组件工作流程说明:
 * 
 * 1. 用户在完成前置验证步骤后（邮箱验证和可能的2FA验证）被引导到此页面
 * 2. 用户在表单中输入新的密码
 * 3. 用户点击"Reset password"按钮提交表单
 * 4. 表单数据被发送到resetPasswordAction函数处理（在actions.ts中）
 * 5. 如果密码重置成功，用户会被自动登录并重定向到首页
 * 6. 如果出现错误（如密码强度不够），会显示相应的错误消息
 * 
 * 安全考量：
 * - 使用autoComplete="new-password"帮助浏览器识别这是新密码字段，提高用户体验
 * - 密码不会直接显示，确保输入过程的安全性
 * - 真正的密码强度验证和安全措施在服务器端进行（actions.ts中）
 * - 表单组件本身非常简单，这是有意设计的，将复杂的逻辑和安全检查放在服务器端
 */
