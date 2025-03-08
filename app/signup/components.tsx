/**
 * 用户注册表单组件
 * 
 * 这个文件实现了注册页面的表单组件，它包含：
 * 1. 用户名输入框
 * 2. 电子邮箱输入框
 * 3. 密码输入框
 * 4. 提交按钮
 * 5. 错误消息展示
 * 
 * 当用户填写并提交表单时，数据会发送到服务器进行处理。
 */

"use client"; // 这个标记表示这是一个客户端组件，会在浏览器中运行，而不是在服务器上

// 导入必要的函数和钩子
import { signupAction } from "./actions"; // 导入处理注册的服务器动作
import { useFormState } from "react-dom"; // 导入表单状态管理钩子

/**
 * 表单初始状态
 * 
 * 定义了表单的初始状态，包含一个空的错误消息
 * 这个状态会在表单提交后被更新，用于显示成功或错误信息
 */
const initialState = {
	message: "" // 初始时没有消息
};

/**
 * 注册表单组件
 * 
 * 这个组件创建一个用户注册表单，收集用户信息并提交给服务器
 * 
 * @returns React组件，显示注册表单界面
 */
export function SignUpForm() {
	// useFormState钩子用于管理表单状态
	// - signupAction: 表单提交时调用的服务器动作函数
	// - initialState: 表单的初始状态
	// - state: 当前表单状态，包含服务器返回的消息
	// - action: 提交表单时调用的函数
	const [state, action] = useFormState(signupAction, initialState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 用户名输入字段 */}
			<label htmlFor="form-signup.username">Username</label>
			<input 
				id="form-signup.username" // 输入框的ID，与label关联
				name="username" // 输入框的名称，服务器会用这个名称获取值
				required // 表示这是必填字段
				minLength={4} // 最少4个字符
				maxLength={31} // 最多31个字符
			/>
			<br />
			
			{/* 电子邮箱输入字段 */}
			<label htmlFor="form-signup.email">Email</label>
			<input 
				type="email" // 输入类型为email，浏览器会验证格式
				id="form-signup.email" // 输入框的ID
				name="email" // 输入框的名称
				autoComplete="username" // 浏览器自动填充提示，这里用username因为email常用作登录标识
				required // 必填字段
			/>
			<br />
			
			{/* 密码输入字段 */}
			<label htmlFor="form-signup.password">Password</label>
			<input 
				type="password" // 密码类型，输入会显示为圆点
				id="form-signup.password" // 输入框的ID
				name="password" // 输入框的名称
				autoComplete="new-password" // 浏览器自动填充提示，指明这是新密码字段
				required // 必填字段
			/>
			<br />
			
			{/* 提交按钮 */}
			<button>Continue</button>
			
			{/* 显示表单状态消息，如错误提示 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 组件工作流程:
 * 
 * 1. 用户填写用户名、电子邮箱和密码
 * 2. 用户点击"Continue"按钮提交表单
 * 3. 表单数据被发送到signupAction函数处理
 * 4. 如果有错误，signupAction返回包含错误消息的state
 * 5. 错误消息显示在表单底部
 * 6. 如果注册成功，用户会被重定向到新页面（在actions.ts中处理）
 * 
 * 注意: 这个组件只负责界面显示和数据收集，真正的数据验证和处理
 * 都在服务器端的actions.ts中进行，这样可以确保安全性。
 */
