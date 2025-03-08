/**
 * 忘记密码表单组件模块
 * 
 * 这个文件实现了忘记密码页面的表单组件，用于用户输入其注册邮箱
 * 以便系统发送密码重置邮件。这是密码重置流程的第一步。
 */

"use client"; // 这个标记表示这是一个客户端组件，会在浏览器中运行

// 导入必要的函数和钩子
import { useFormState } from "react-dom"; // 导入表单状态管理钩子
import { forgotPasswordAction } from "./actions"; // 导入处理忘记密码的服务器动作

/**
 * 忘记密码表单初始状态
 * 
 * 定义了忘记密码表单的初始状态，包含一个空的消息
 * 这个状态会在表单提交后被更新，用于显示处理结果或错误信息
 */
const initialForgotPasswordState = {
	message: "" // 初始时没有消息
};

/**
 * 忘记密码表单组件
 * 
 * 这个组件创建一个简单的表单，让用户输入其邮箱地址
 * 用于接收密码重置邮件
 * 
 * @returns React组件，显示忘记密码表单界面
 */
export function ForgotPasswordForm() {
	// useFormState钩子用于管理表单状态
	// - forgotPasswordAction: 表单提交时调用的服务器动作函数
	// - initialForgotPasswordState: 表单的初始状态
	// - state: 当前表单状态，包含服务器返回的消息
	// - action: 提交表单时调用的函数
	const [state, action] = useFormState(forgotPasswordAction, initialForgotPasswordState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 邮箱输入字段 */}
			<label htmlFor="form-forgot.email">Email</label>
			<input 
				type="email" // 输入类型为email，浏览器会验证格式
				id="form-forgot.email" // 输入框的ID，与label关联
				name="email" // 输入框的名称，服务器会用这个名称获取值
				required // 必填字段
			/>
			<br />
			
			{/* 提交按钮 */}
			<button>Send</button>
			
			{/* 显示处理结果消息 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 组件工作流程说明:
 * 
 * 1. 用户访问忘记密码页面
 * 2. 用户在表单中输入其注册邮箱地址
 * 3. 用户点击"Send"按钮提交表单
 * 4. 表单数据被发送到forgotPasswordAction函数处理（在actions.ts中）
 * 5. 如果处理成功，用户会被重定向到密码重置验证邮箱页面
 * 6. 如果出现错误（如邮箱不存在），会显示相应的错误消息
 * 
 * 安全考量：
 * - 表单包含基本的客户端验证（email类型和required属性）
 * - 真正的安全验证在服务器端进行，避免客户端验证被绕过
 * - 为防止用户枚举攻击，错误消息应该保持模糊，不明确指出具体问题
 *   （例如，不应明确指出"邮箱不存在"，而应使用更通用的错误信息）
 */
