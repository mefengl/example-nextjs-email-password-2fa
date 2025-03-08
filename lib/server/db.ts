/**
 * 数据库模块 - Database Module
 * 
 * 这个模块负责处理与数据库的连接和交互：
 * - 建立到SQLite数据库的连接
 * - 提供查询和执行SQL语句的接口
 * - 通过适配器模式将数据库操作抽象化
 * 
 * 整个认证系统的所有持久化数据都通过这个模块进行存储和检索，
 * 包括用户账户、会话信息、验证请求等。使用SQLite作为数据库引擎，
 * 提供了轻量级但功能完整的数据库支持。
 */

import sqlite3 from "better-sqlite3";
import { SyncDatabase } from "@pilcrowjs/db-query";
import type { SyncAdapter } from "@pilcrowjs/db-query";

/**
 * SQLite数据库连接
 * 
 * 创建到SQLite数据库文件的连接。
 * better-sqlite3是一个高性能的同步SQLite客户端，
 * 不使用异步回调，而是直接返回结果。
 */
const sqlite = sqlite3("sqlite.db");

/**
 * 数据库适配器
 * 
 * 实现了SyncAdapter接口，作为数据库操作的桥接层：
 * - query方法：用于执行返回数据的SQL查询
 * - execute方法：用于执行不返回数据的SQL命令
 * 
 * 这种适配器模式允许在不改变上层代码的情况下，
 * 轻松替换底层数据库实现（例如从SQLite切换到PostgreSQL）。
 */
const adapter: SyncAdapter<sqlite3.RunResult> = {
    /**
     * 执行查询并返回结果集
     * 
     * 将SQL查询和参数传递给SQLite引擎：
     * 1. 准备查询语句
     * 2. 指定返回原始数据格式
     * 3. 执行查询并传入参数
     * 
     * @param statement SQL查询语句，可以包含参数占位符
     * @param params 要绑定到查询中的参数数组
     * @returns 查询结果的二维数组
     */
    query: (statement: string, params: unknown[]): unknown[][] => {
        const result = sqlite
            .prepare(statement)
            .raw()
            .all(...params);
        return result as unknown[][];
    },
    
    /**
     * 执行SQL命令
     * 
     * 用于执行不返回结果集的SQL语句，如INSERT, UPDATE, DELETE等：
     * 1. 准备SQL语句
     * 2. 执行并传入参数
     * 
     * @param statement SQL命令，可以包含参数占位符
     * @param params 要绑定到命令中的参数数组
     * @returns 执行结果对象，包含受影响的行数等信息
     */
    execute: (statement: string, params: unknown[]): sqlite3.RunResult => {
        const result = sqlite.prepare(statement).run(...params);
        return result;
    }
};

/**
 * 自定义数据库类
 * 
 * 扩展SyncDatabase类，添加额外功能：
 * - inTransaction方法：检查是否在事务中
 * 
 * 事务管理对于确保数据一致性至关重要，特别是在执行
 * 需要原子性的多步操作时（如用户注册、密码重置等）。
 */
class Database extends SyncDatabase<sqlite3.RunResult> {
    /**
     * 检查当前是否在数据库事务中
     * 
     * @returns 如果当前在事务中则返回true，否则返回false
     */
    public inTransaction(): boolean {
        return sqlite.inTransaction;
    }
}

/**
 * 导出数据库实例
 * 
 * 创建一个配置了适配器的数据库实例，供整个应用程序使用。
 * 在代码的其他部分可以直接导入这个实例进行数据库操作。
 */
export const db = new Database(adapter);
