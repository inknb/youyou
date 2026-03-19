/**
 * 数据库配置模块
 * 支持 MySQL 连接池管理
 */

const fs = require('fs');
const path = require('path');

// 数据库连接池
let pool = null;

// 数据库模式：'json' 或 'mysql'
let dbMode = 'json';

/**
 * 初始化数据库连接
 */
function initDatabase() {
    // 检查是否配置了 MySQL
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.log('[数据库] 未找到 .env 配置文件，使用 JSON 文件模式');
        dbMode = 'json';
        return null;
    }

    // 加载环境变量
    require('dotenv').config({ path: envPath });

    if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
        console.log('[数据库] MySQL 配置不完整，使用 JSON 文件模式');
        dbMode = 'json';
        return null;
    }

    // 检查安装锁定
    const lockFile = path.join(__dirname, 'data', 'install.lock');
    if (!fs.existsSync(lockFile)) {
        console.log('[数据库] 系统未安装，使用 JSON 文件模式');
        dbMode = 'json';
        return null;
    }

    // 加载 mysql2
    try {
        const mysql = require('mysql2/promise');

        pool = mysql.createPool({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME,
            charset: process.env.DB_CHARSET || 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        dbMode = 'mysql';
        console.log(`[数据库] MySQL 连接池已创建 (${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`);

        return pool;
    } catch (err) {
        console.error('[数据库] MySQL 初始化失败:', err.message);
        console.log('[数据库] 回退到 JSON 文件模式');
        dbMode = 'json';
        return null;
    }
}

/**
 * 获取数据库连接池
 */
function getPool() {
    return pool;
}

/**
 * 获取当前数据库模式
 */
function getMode() {
    return dbMode;
}

/**
 * 检查是否使用 MySQL
 */
function isMySQL() {
    return dbMode === 'mysql';
}

/**
 * 执行 SQL 查询
 */
async function query(sql, params = []) {
    if (!pool) {
        throw new Error('数据库未初始化');
    }

    const prefix = process.env.DB_PREFIX || '';
    // 替换表前缀占位符
    const finalSql = sql.replace(/__PREFIX__/g, prefix);

    try {
        const [rows] = await pool.execute(finalSql, params);
        return rows;
    } catch (err) {
        console.error('[数据库] 查询失败:', err.message);
        console.error('[数据库] SQL:', finalSql);
        throw err;
    }
}

/**
 * 执行 SQL 并返回单行
 */
async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 关闭数据库连接
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('[数据库] MySQL 连接池已关闭');
    }
}

module.exports = {
    initDatabase,
    getPool,
    getMode,
    isMySQL,
    query,
    queryOne,
    close
};
