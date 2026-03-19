/**
 * 悠悠个人主页 - 安装向导后端 API
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

// 配置路径
const DATA_DIR = path.join(__dirname, '../data');
const LOCK_FILE = path.join(DATA_DIR, 'install.lock');
const ENV_FILE = path.join(__dirname, '../.env');
const ENV_TEMPLATE = path.join(DATA_DIR, '.env.template');
const SCHEMA_FILE = path.join(DATA_DIR, 'schema.sql');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// MySQL 连接（延迟加载）
let mysqlConnection = null;

/**
 * 获取 MySQL 连接
 */
function getMysqlConnection(config) {
    // 如果已有连接且配置相同，复用
    if (mysqlConnection) {
        return mysqlConnection;
    }

    // 动态加载 mysql2
    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (e) {
        throw new Error('mysql2 模块未安装，请运行: npm install mysql2');
    }

    mysqlConnection = mysql.createPool({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password,
        database: config.database,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    return mysqlConnection;
}

/**
 * 关闭 MySQL 连接
 */
async function closeMysqlConnection() {
    if (mysqlConnection) {
        await mysqlConnection.end();
        mysqlConnection = null;
    }
}

/**
 * MD5 哈希
 */
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 生成随机字符串
 */
function generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * 检查安装状态 API
 */
router.get('/status', (req, res) => {
    const locked = fs.existsSync(LOCK_FILE);
    let installInfo = null;

    if (locked) {
        try {
            const lockContent = fs.readFileSync(LOCK_FILE, 'utf8');
            installInfo = JSON.parse(lockContent);
        } catch (e) {
            // 忽略解析错误
        }
    }

    res.json({
        success: true,
        data: {
            locked,
            installInfo
        }
    });
});

/**
 * 环境检测 API
 */
router.get('/check-env', (req, res) => {
    const result = {
        nodeVersion: process.version,
        nodeVersionValid: false,
        npmVersion: null,
        mysqlDriverInstalled: false,
        mysqlDriver: null,
        dataDirExists: false,
        dataDirWritable: false,
        envFileExists: false
    };

    // 检查 Node.js 版本 (需要 >= 14)
    const nodeVersionMatch = process.version.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (nodeVersionMatch) {
        const major = parseInt(nodeVersionMatch[1]);
        result.nodeVersionValid = major >= 14;
    }

    // 检查 npm
    try {
        const npmVersion = require('child_process').execSync('npm --version', { encoding: 'utf8' }).trim();
        result.npmVersion = npmVersion;
    } catch (e) {
        // npm 不可用
    }

    // 检查 MySQL 驱动
    try {
        require.resolve('mysql2/promise');
        result.mysqlDriverInstalled = true;
        result.mysqlDriver = 'mysql2';
    } catch (e) {
        result.mysqlDriverInstalled = false;
    }

    // 检查数据目录
    result.dataDirExists = fs.existsSync(DATA_DIR);
    if (result.dataDirExists) {
        try {
            // 尝试写入测试文件
            const testFile = path.join(DATA_DIR, '.write_test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            result.dataDirWritable = true;
        } catch (e) {
            result.dataDirWritable = false;
        }
    } else {
        // 尝试创建目录
        try {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            result.dataDirExists = true;
            result.dataDirWritable = true;
        } catch (e) {
            result.dataDirWritable = false;
        }
    }

    // 检查配置文件
    result.envFileExists = fs.existsSync(ENV_FILE);

    res.json({
        success: true,
        data: result
    });
});

/**
 * 测试数据库连接 API
 */
router.post('/test-db', async (req, res) => {
    const { host, port, database, user, password } = req.body;

    if (!host || !database || !user) {
        return res.status(400).json({
            success: false,
            message: '请填写完整的数据库连接信息'
        });
    }

    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (e) {
        return res.status(500).json({
            success: false,
            message: 'mysql2 模块未安装'
        });
    }

    let connection;
    try {
        connection = await mysql.createConnection({
            host,
            port: port || 3306,
            user,
            password: password || '',
            connectTimeout: 10000
        });

        // 检查数据库是否存在
        const [rows] = await connection.query(`SHOW DATABASES LIKE '${database}'`);

        if (rows.length === 0) {
            // 数据库不存在，尝试创建
            await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            await connection.query(`USE \`${database}\``);
            await connection.end();

            return res.json({
                success: true,
                message: '数据库连接成功，已自动创建数据库'
            });
        }

        // 切换到目标数据库
        await connection.query(`USE \`${database}\``);

        // 检查表是否存在
        const [tables] = await connection.query('SHOW TABLES');
        const tableCount = tables.length;

        await connection.end();

        if (tableCount > 0) {
            return res.json({
                success: true,
                message: `数据库连接成功，检测到 ${tableCount} 个已存在的表`
            });
        }

        res.json({
            success: true,
            message: '数据库连接成功'
        });

    } catch (error) {
        if (connection) {
            try { await connection.end(); } catch (e) {}
        }

        console.error('数据库连接测试失败:', error);

        let errorMessage = '数据库连接失败';
        if (error.code === 'ECONNREFUSED') {
            errorMessage = '无法连接到数据库服务器，请检查主机地址和端口';
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            errorMessage = '数据库用户名或密码错误';
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            errorMessage = '数据库不存在且无创建权限';
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(400).json({
            success: false,
            message: errorMessage
        });
    }
});

/**
 * 执行安装步骤 - 生成配置文件
 */
router.post('/execute/config', async (req, res) => {
    const { mode, database, admin } = req.body;

    try {
        let envContent;

        if (mode === 'mysql' && database) {
            // MySQL 模式
            if (!database.host || !database.database || !database.user) {
                return res.status(400).json({
                    success: false,
                    message: '数据库配置信息不完整'
                });
            }

            envContent = `# 悠悠个人主页环境配置文件
# 由安装向导自动生成于 ${new Date().toISOString()}

# 服务器配置
PORT=${process.env.PORT || 3000}
NODE_ENV=production

# 数据库配置
DB_HOST=${database.host}
DB_PORT=${database.port || 3306}
DB_USER=${database.user}
DB_PASSWORD=${database.password || ''}
DB_NAME=${database.database}
DB_PREFIX=${database.prefix || ''}
DB_CHARSET=utf8mb4

# 存储模式
STORAGE_MODE=mysql

# 安全配置
SESSION_SECRET=${generateSecret(32)}

# 安装状态
INSTALL_LOCK=false
INSTALL_TIME=${new Date().toISOString()}
`;
        } else {
            // JSON 模式
            envContent = `# 悠悠个人主页环境配置文件
# 由安装向导自动生成于 ${new Date().toISOString()}

# 服务器配置
PORT=${process.env.PORT || 3000}
NODE_ENV=production

# 存储模式
STORAGE_MODE=json

# 安全配置
SESSION_SECRET=${generateSecret(32)}

# 安装状态
INSTALL_LOCK=false
INSTALL_TIME=${new Date().toISOString()}
`;
        }

        // 写入配置文件
        fs.writeFileSync(ENV_FILE, envContent, 'utf8');

        // 如果是 MySQL 模式，更新 process.env
        if (mode === 'mysql' && database) {
            process.env.DB_HOST = database.host;
            process.env.DB_PORT = database.port || '3306';
            process.env.DB_USER = database.user;
            process.env.DB_PASSWORD = database.password || '';
            process.env.DB_NAME = database.database;
            process.env.DB_PREFIX = database.prefix || '';
        }

        process.env.STORAGE_MODE = mode;

        res.json({
            success: true,
            message: '配置文件生成成功'
        });

    } catch (error) {
        console.error('生成配置文件失败:', error);
        res.status(500).json({
            success: false,
            message: `配置文件生成失败: ${error.message}`
        });
    }
});

/**
 * 执行安装步骤 - 初始化数据库
 */
router.post('/execute/database', async (req, res) => {
    const { database } = req.body;

    if (!database) {
        return res.status(400).json({
            success: false,
            message: '数据库配置信息缺失'
        });
    }

    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (e) {
        return res.status(500).json({
            success: false,
            message: 'mysql2 模块未安装'
        });
    }

    let connection;
    try {
        // 连接数据库
        connection = await mysql.createConnection({
            host: database.host,
            port: database.port || 3306,
            user: database.user,
            password: database.password || '',
            database: database.database,
            multipleStatements: true
        });

        // 读取 SQL 文件
        if (!fs.existsSync(SCHEMA_FILE)) {
            throw new Error('数据库结构文件不存在: schema.sql');
        }

        let sqlContent = fs.readFileSync(SCHEMA_FILE, 'utf8');

        // 添加表前缀支持（如果需要）
        if (database.prefix) {
            sqlContent = sqlContent.replace(/`(\w+)`/g, (match, tableName) => {
                const keywords = ['SET', 'DROP', 'CREATE', 'TABLE', 'IF', 'EXISTS', 'INSERT', 'INTO', 'VALUES', 'ENGINE', 'DEFAULT', 'CHARSET', 'COLLATE', 'COMMENT', 'PRIMARY', 'KEY', 'UNIQUE', 'AUTO_INCREMENT', 'NOT', 'NULL', 'CURRENT_TIMESTAMP', 'USE'];
                if (keywords.includes(tableName.toUpperCase())) {
                    return match;
                }
                return `\`${database.prefix}${tableName}\``;
            });
        }

        // 执行 SQL
        await connection.query(sqlContent);

        await connection.end();

        res.json({
            success: true,
            message: '数据库初始化成功'
        });

    } catch (error) {
        if (connection) {
            try { await connection.end(); } catch (e) {}
        }

        console.error('数据库初始化失败:', error);
        res.status(500).json({
            success: false,
            message: `数据库初始化失败: ${error.message}`
        });
    }
});

/**
 * 执行安装步骤 - 创建管理员账号
 */
router.post('/execute/admin', async (req, res) => {
    const { mode, database, admin } = req.body;

    if (!admin || !admin.username || !admin.password) {
        return res.status(400).json({
            success: false,
            message: '管理员信息不完整'
        });
    }

    try {
        // 密码哈希
        const passwordHash = md5(admin.password);

        if (mode === 'mysql') {
            // MySQL 模式
            let mysql;
            try {
                mysql = require('mysql2/promise');
            } catch (e) {
                return res.status(500).json({
                    success: false,
                    message: 'mysql2 模块未安装'
                });
            }

            let connection;
            try {
                connection = await mysql.createConnection({
                    host: database.host,
                    port: database.port || 3306,
                    user: database.user,
                    password: database.password || '',
                    database: database.database
                });

                const prefix = database.prefix || '';

                // 插入管理员账号
                await connection.query(
                    `INSERT INTO \`${prefix}admin\` (username, password, email, created_at)
                     VALUES (?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE password = VALUES(password), email = VALUES(email)`,
                    [admin.username, passwordHash, admin.email || null]
                );

                await connection.end();

            } catch (e) {
                if (connection) {
                    try { await connection.end(); } catch (err) {}
                }
                throw e;
            }
        } else {
            // JSON 模式 - 更新 config.json
            let config = {};
            if (fs.existsSync(CONFIG_FILE)) {
                try {
                    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
                } catch (e) {
                    // 使用默认配置
                }
            }

            // 更新管理员信息
            config.admin = {
                username: admin.username,
                password: passwordHash,
                token: '',
                tokenExpiry: null,
                lastLogin: null
            };

            // 确保 site 配置存在
            if (!config.site) {
                config.site = {
                    title: '悠悠の小站',
                    subtitle: '探索简洁、逻辑与二次元的平衡点',
                    nickname: '悠悠',
                    qq: '',
                    bio: '热爱二次元的平凡学生',
                    signature: '小小世界 开心至上',
                    startDate: new Date().toISOString().split('T')[0],
                    favicon: ''
                };
            }

            // 确保其他配置存在
            if (!config.apis) config.apis = {};
            if (!config.tags) config.tags = [];
            if (!config.links) config.links = [];
            if (!config.schedule) config.schedule = { courses: [], events: [] };
            if (!config.activities) config.activities = [];
            if (!config.widgets) config.widgets = { sakana: { enabled: true, characters: [] } };

            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        }

        res.json({
            success: true,
            message: '管理员账号创建成功'
        });

    } catch (error) {
        console.error('创建管理员账号失败:', error);
        res.status(500).json({
            success: false,
            message: `创建管理员账号失败: ${error.message}`
        });
    }
});

/**
 * 执行安装步骤 - 锁定安装
 */
router.post('/execute/lock', async (req, res) => {
    try {
        // 创建锁定文件
        const lockData = {
            locked: true,
            installedAt: new Date().toISOString(),
            installerIp: req.ip || req.connection.remoteAddress,
            version: '1.0.0',
            mode: req.body.mode || 'json'
        };

        fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf8');

        // 更新 .env 文件中的安装状态
        if (fs.existsSync(ENV_FILE)) {
            let envContent = fs.readFileSync(ENV_FILE, 'utf8');
            envContent = envContent.replace('INSTALL_LOCK=false', 'INSTALL_LOCK=true');
            fs.writeFileSync(ENV_FILE, envContent, 'utf8');
        }

        res.json({
            success: true,
            message: '安装锁定成功'
        });

    } catch (error) {
        console.error('锁定安装失败:', error);
        res.status(500).json({
            success: false,
            message: `锁定安装失败: ${error.message}`
        });
    }
});

module.exports = router;
