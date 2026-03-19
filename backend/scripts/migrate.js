/**
 * 数据迁移脚本 - 从 JSON 配置迁移到 MySQL 数据库
 * 运行方式: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置路径
const DATA_FILE = path.join(__dirname, '../data/config.json');
const ENV_FILE = path.join(__dirname, '../.env');

// 加载环境变量
if (fs.existsSync(ENV_FILE)) {
    require('dotenv').config({ path: ENV_FILE });
}

// MD5 哈希
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 主迁移函数
 */
async function migrate() {
    console.log('========== 数据迁移工具 ==========\n');

    // 检查配置文件
    if (!fs.existsSync(DATA_FILE)) {
        console.error('错误: 找不到配置文件 data/config.json');
        process.exit(1);
    }

    // 检查环境变量
    if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
        console.error('错误: 数据库配置不完整，请先运行安装向导或配置 .env 文件');
        process.exit(1);
    }

    // 加载 mysql2
    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (e) {
        console.error('错误: mysql2 模块未安装，请运行: npm install mysql2');
        process.exit(1);
    }

    // 读取 JSON 配置
    let config;
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        config = JSON.parse(content);
    } catch (e) {
        console.error('错误: 配置文件解析失败:', e.message);
        process.exit(1);
    }

    console.log('读取配置文件成功');
    console.log(`网站标题: ${config.site?.title || '未知'}`);
    console.log(`管理员: ${config.admin?.username || '未知'}`);
    console.log('');

    // 连接数据库
    let connection;
    try {
        console.log('正在连接数据库...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME
        });
        console.log('数据库连接成功\n');
    } catch (e) {
        console.error('数据库连接失败:', e.message);
        process.exit(1);
    }

    const prefix = process.env.DB_PREFIX || '';

    try {
        // 迁移网站配置
        console.log('迁移网站配置...');
        if (config.site) {
            const siteConfig = [
                ['title', config.site.title, 'string', '网站标题'],
                ['subtitle', config.site.subtitle, 'string', '网站副标题'],
                ['nickname', config.site.nickname, 'string', '昵称'],
                ['qq', config.site.qq, 'string', 'QQ号'],
                ['bio', config.site.bio, 'string', '个人简介'],
                ['signature', config.site.signature, 'string', '个性签名'],
                ['start_date', config.site.startDate, 'string', '网站开始日期'],
                ['favicon', config.site.favicon, 'string', '网站图标']
            ];

            for (const [key, value, type, desc] of siteConfig) {
                await connection.query(
                    `INSERT INTO \`${prefix}site_config\` (config_key, config_value, config_type, description)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
                    [key, value || '', type, desc]
                );
            }
            console.log('网站配置迁移完成');
        }

        // 迁移管理员账号
        console.log('迁移管理员账号...');
        if (config.admin) {
            await connection.query(
                `INSERT INTO \`${prefix}admin\` (username, password, created_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE password = VALUES(password)`,
                [config.admin.username, config.admin.password]
            );
            console.log('管理员账号迁移完成');
        }

        // 迁移 API 配置
        console.log('迁移 API 配置...');
        if (config.apis) {
            // 动漫图片 API
            if (config.apis.anime && Array.isArray(config.apis.anime)) {
                for (const api of config.apis.anime) {
                    await connection.query(
                        `INSERT INTO \`${prefix}api_config\` (api_type, name, url, enabled, priority)
                         VALUES ('anime', ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), priority = VALUES(priority)`,
                        [api.name, api.url, api.enabled ? 1 : 0, api.priority || 1]
                    );
                }
            }

            // 一言 API
            if (config.apis.hitokoto && Array.isArray(config.apis.hitokoto)) {
                for (const api of config.apis.hitokoto) {
                    await connection.query(
                        `INSERT INTO \`${prefix}api_config\` (api_type, name, url, enabled, priority)
                         VALUES ('hitokoto', ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), priority = VALUES(priority)`,
                        [api.name, api.url, api.enabled ? 1 : 0, api.priority || 1]
                    );
                }
            }

            // QQ 信息 API
            if (config.apis.qqInfo) {
                await connection.query(
                    `INSERT INTO \`${prefix}api_config\` (api_type, name, url, enabled)
                     VALUES ('qqInfo', 'qqInfo', ?, ?)
                     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
                    [config.apis.qqInfo.url, config.apis.qqInfo.enabled ? 1 : 0]
                );
            }

            // 天气 API
            if (config.apis.weather) {
                await connection.query(
                    `INSERT INTO \`${prefix}api_config\` (api_type, name, url, enabled, extra_config)
                     VALUES ('weather', 'weather', ?, ?, ?)
                     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), extra_config = VALUES(extra_config)`,
                    [
                        config.apis.weather.url,
                        config.apis.weather.enabled ? 1 : 0,
                        JSON.stringify({ city: config.apis.weather.city || '' })
                    ]
                );
            }
            console.log('API 配置迁移完成');
        }

        // 迁移标签
        console.log('迁移标签...');
        if (config.tags && Array.isArray(config.tags)) {
            for (let i = 0; i < config.tags.length; i++) {
                const tag = config.tags[i];
                await connection.query(
                    `INSERT INTO \`${prefix}tags\` (icon, name, sort_order)
                     VALUES (?, ?, ?)`,
                    [tag.icon, tag.name, i + 1]
                );
            }
            console.log(`标签迁移完成 (${config.tags.length} 个)`);
        }

        // 迁移外链
        console.log('迁移外链...');
        if (config.links && Array.isArray(config.links)) {
            for (let i = 0; i < config.links.length; i++) {
                const link = config.links[i];
                await connection.query(
                    `INSERT INTO \`${prefix}links\` (name, url, icon, color, sort_order)
                     VALUES (?, ?, ?, ?, ?)`,
                    [link.name, link.url, link.icon, link.color || '#3b82f6', i + 1]
                );
            }
            console.log(`外链迁移完成 (${config.links.length} 个)`);
        }

        // 迁移课程
        console.log('迁移课程...');
        if (config.schedule?.courses && Array.isArray(config.schedule.courses)) {
            for (const course of config.schedule.courses) {
                await connection.query(
                    `INSERT INTO \`${prefix}courses\` (name, day, start_time, end_time, location, color)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [course.name, course.day, course.startTime, course.endTime, course.location, course.color || '#3b82f6']
                );
            }
            console.log(`课程迁移完成 (${config.schedule.courses.length} 个)`);
        }

        // 迁移日程
        console.log('迁移日程...');
        if (config.schedule?.events && Array.isArray(config.schedule.events)) {
            for (const event of config.schedule.events) {
                await connection.query(
                    `INSERT INTO \`${prefix}events\` (name, day, start_time, end_time, type, color)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [event.name, event.day, event.startTime, event.endTime, event.type || 'other', event.color || '#22c55e']
                );
            }
            console.log(`日程迁移完成 (${config.schedule.events.length} 个)`);
        }

        // 迁移动态
        console.log('迁移动态...');
        if (config.activities && Array.isArray(config.activities)) {
            for (const activity of config.activities) {
                await connection.query(
                    `INSERT INTO \`${prefix}activities\` (content, time_desc)
                     VALUES (?, ?)`,
                    [activity.text, activity.time]
                );
            }
            console.log(`动态迁移完成 (${config.activities.length} 个)`);
        }

        // 迁移挂件配置
        console.log('迁移挂件配置...');
        if (config.widgets?.sakana) {
            await connection.query(
                `INSERT INTO \`${prefix}widgets\` (widget_type, enabled, config)
                 VALUES ('sakana', ?, ?)
                 ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config = VALUES(config)`,
                [config.widgets.sakana.enabled ? 1 : 0, JSON.stringify(config.widgets.sakana)]
            );
            console.log('挂件配置迁移完成');
        }

        console.log('\n========== 迁移完成 ==========');
        console.log('所有数据已成功迁移到 MySQL 数据库');
        console.log('建议: 备份原 config.json 文件后可将其删除');

    } catch (e) {
        console.error('\n迁移失败:', e.message);
        console.error(e);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

// 执行迁移
migrate().catch(console.error);
