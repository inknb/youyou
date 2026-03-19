/**
 * 数据访问层 - 统一接口
 * 支持 JSON 文件和 MySQL 数据库双模式
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');

// JSON 数据文件路径
const DATA_FILE = path.join(__dirname, '../data', 'config.json');

/**
 * MD5 哈希
 */
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 生成随机 Token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ========== JSON 模式实现 ==========

const JsonStore = {
    /**
     * 读取完整配置
     */
    readConfig() {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('[JSON] 读取配置失败:', err);
            return null;
        }
    },

    /**
     * 写入完整配置
     */
    writeConfig(config) {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(config, null, 2), 'utf8');
            return true;
        } catch (err) {
            console.error('[JSON] 保存配置失败:', err);
            return false;
        }
    },

    // ========== 网站配置 ==========

    async getSiteConfig() {
        const config = this.readConfig();
        return config?.site || null;
    },

    async updateSiteConfig(data) {
        const config = this.readConfig();
        if (!config) return false;
        config.site = { ...config.site, ...data };
        return this.writeConfig(config);
    },

    // ========== 管理员 ==========

    async getAdmin() {
        const config = this.readConfig();
        return config?.admin || null;
    },

    async updateAdmin(data) {
        const config = this.readConfig();
        if (!config) return false;
        config.admin = { ...config.admin, ...data };
        return this.writeConfig(config);
    },

    // ========== API 配置 ==========

    async getApis() {
        const config = this.readConfig();
        return config?.apis || null;
    },

    async updateApis(data) {
        const config = this.readConfig();
        if (!config) return false;
        config.apis = { ...config.apis, ...data };
        return this.writeConfig(config);
    },

    // ========== 标签 ==========

    async getTags() {
        const config = this.readConfig();
        return config?.tags || [];
    },

    async updateTags(tags) {
        const config = this.readConfig();
        if (!config) return false;
        config.tags = tags;
        return this.writeConfig(config);
    },

    // ========== 外链 ==========

    async getLinks() {
        const config = this.readConfig();
        return config?.links || [];
    },

    async updateLinks(links) {
        const config = this.readConfig();
        if (!config) return false;
        config.links = links;
        return this.writeConfig(config);
    },

    // ========== 日程 ==========

    async getSchedule() {
        const config = this.readConfig();
        return config?.schedule || { courses: [], events: [] };
    },

    async getCourses() {
        const schedule = await this.getSchedule();
        return schedule.courses || [];
    },

    async addCourse(course) {
        const config = this.readConfig();
        if (!config) return false;
        const newCourse = { id: Date.now(), ...course };
        config.schedule.courses.push(newCourse);
        return this.writeConfig(config) ? newCourse : null;
    },

    async updateCourse(id, data) {
        const config = this.readConfig();
        if (!config) return false;
        const index = config.schedule.courses.findIndex(c => String(c.id) === String(id));
        if (index === -1) return null;
        config.schedule.courses[index] = { ...config.schedule.courses[index], ...data };
        return this.writeConfig(config) ? config.schedule.courses[index] : null;
    },

    async deleteCourse(id) {
        const config = this.readConfig();
        if (!config) return false;
        config.schedule.courses = config.schedule.courses.filter(c => String(c.id) !== String(id));
        return this.writeConfig(config);
    },

    async getEvents() {
        const schedule = await this.getSchedule();
        return schedule.events || [];
    },

    async addEvent(event) {
        const config = this.readConfig();
        if (!config) return false;
        const newEvent = { id: Date.now(), ...event };
        config.schedule.events.push(newEvent);
        return this.writeConfig(config) ? newEvent : null;
    },

    async updateEvent(id, data) {
        const config = this.readConfig();
        if (!config) return false;
        const index = config.schedule.events.findIndex(e => String(e.id) === String(id));
        if (index === -1) return null;
        config.schedule.events[index] = { ...config.schedule.events[index], ...data };
        return this.writeConfig(config) ? config.schedule.events[index] : null;
    },

    async deleteEvent(id) {
        const config = this.readConfig();
        if (!config) return false;
        config.schedule.events = config.schedule.events.filter(e => String(e.id) !== String(id));
        return this.writeConfig(config);
    },

    // ========== 动态 ==========

    async getActivities() {
        const config = this.readConfig();
        return config?.activities || [];
    },

    async addActivity(activity) {
        const config = this.readConfig();
        if (!config) return false;
        if (!config.activities) config.activities = [];
        const newActivity = { id: Date.now(), ...activity };
        config.activities.unshift(newActivity);
        return this.writeConfig(config) ? newActivity : null;
    },

    async updateActivity(id, data) {
        const config = this.readConfig();
        if (!config) return false;
        if (!config.activities) config.activities = [];
        const index = config.activities.findIndex(a => String(a.id) === String(id));
        if (index === -1) return null;
        config.activities[index] = { ...config.activities[index], ...data };
        return this.writeConfig(config) ? config.activities[index] : null;
    },

    async deleteActivity(id) {
        const config = this.readConfig();
        if (!config) return false;
        if (!config.activities) config.activities = [];
        config.activities = config.activities.filter(a => String(a.id) !== String(id));
        return this.writeConfig(config);
    },

    // ========== 挂件 ==========

    async getWidgets() {
        const config = this.readConfig();
        return config?.widgets || null;
    },

    // ========== 公开配置（过滤敏感信息）==========

    async getPublicConfig() {
        const config = this.readConfig();
        if (!config) return null;

        return {
            site: config.site,
            apis: {
                anime: config.apis?.anime || [],
                hitokoto: config.apis?.hitokoto || [],
                qqInfo: config.apis?.qqInfo,
                weather: config.apis?.weather
            },
            tags: config.tags,
            links: config.links,
            schedule: config.schedule,
            widgets: config.widgets,
            activities: config.activities
        };
    }
};

// ========== MySQL 模式实现 ==========

const MySQLStore = {
    // ========== 网站配置 ==========

    async getSiteConfig() {
        const rows = await db.query('SELECT * FROM __PREFIX__site_config');
        const result = {};
        for (const row of rows) {
            let value = row.config_value;
            if (row.config_type === 'json') {
                try { value = JSON.parse(value); } catch (e) {}
            } else if (row.config_type === 'number') {
                value = parseFloat(value);
            } else if (row.config_type === 'boolean') {
                value = value === 'true' || value === '1';
            }
            result[row.config_key] = value;
        }
        return result;
    },

    async updateSiteConfig(data) {
        for (const [key, value] of Object.entries(data)) {
            let type = 'string';
            let val = value;
            if (typeof value === 'object') {
                type = 'json';
                val = JSON.stringify(value);
            } else if (typeof value === 'number') {
                type = 'number';
                val = String(value);
            } else if (typeof value === 'boolean') {
                type = 'boolean';
                val = value ? 'true' : 'false';
            }

            await db.query(
                `INSERT INTO __PREFIX__site_config (config_key, config_value, config_type)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), config_type = VALUES(config_type)`,
                [key, val, type]
            );
        }
        return true;
    },

    // ========== 管理员 ==========

    async getAdmin() {
        return await db.queryOne('SELECT * FROM __PREFIX__admin LIMIT 1');
    },

    async updateAdmin(data) {
        const admin = await this.getAdmin();
        if (!admin) {
            await db.query(
                `INSERT INTO __PREFIX__admin (username, password, email, token, token_expiry, last_login)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [data.username || '', data.password || '', data.email || null, data.token || null, data.tokenExpiry || null, data.lastLogin || null]
            );
        } else {
            const updates = [];
            const values = [];
            if (data.username !== undefined) { updates.push('username = ?'); values.push(data.username); }
            if (data.password !== undefined) { updates.push('password = ?'); values.push(data.password); }
            if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email); }
            if (data.token !== undefined) { updates.push('token = ?'); values.push(data.token); }
            if (data.tokenExpiry !== undefined) { updates.push('token_expiry = ?'); values.push(data.tokenExpiry); }
            if (data.lastLogin !== undefined) { updates.push('last_login = ?'); values.push(data.lastLogin); }

            if (updates.length > 0) {
                values.push(admin.id);
                await db.query(`UPDATE __PREFIX__admin SET ${updates.join(', ')} WHERE id = ?`, values);
            }
        }
        return true;
    },

    // ========== API 配置 ==========

    async getApis() {
        const rows = await db.query('SELECT * FROM __PREFIX__api_config ORDER BY api_type, priority');
        const result = { anime: [], hitokoto: [], qqInfo: null, weather: null };

        for (const row of rows) {
            const item = {
                name: row.name,
                url: row.url,
                enabled: !!row.enabled,
                priority: row.priority
            };

            if (row.api_type === 'anime') {
                result.anime.push(item);
            } else if (row.api_type === 'hitokoto') {
                result.hitokoto.push(item);
            } else if (row.api_type === 'qqInfo') {
                result.qqInfo = { ...item, url: row.url, enabled: !!row.enabled };
            } else if (row.api_type === 'weather') {
                let extraConfig = {};
                if (row.extra_config) {
                    try { extraConfig = JSON.parse(row.extra_config); } catch (e) {}
                }
                result.weather = { ...item, ...extraConfig };
            }
        }

        return result;
    },

    async updateApis(data) {
        // 简化实现：直接更新特定 API
        if (data.anime) {
            // 先删除旧的
            await db.query("DELETE FROM __PREFIX__api_config WHERE api_type = 'anime'");
            // 插入新的
            for (const api of data.anime) {
                await db.query(
                    `INSERT INTO __PREFIX__api_config (api_type, name, url, enabled, priority)
                     VALUES ('anime', ?, ?, ?, ?)`,
                    [api.name, api.url, api.enabled ? 1 : 0, api.priority || 1]
                );
            }
        }

        if (data.hitokoto) {
            await db.query("DELETE FROM __PREFIX__api_config WHERE api_type = 'hitokoto'");
            for (const api of data.hitokoto) {
                await db.query(
                    `INSERT INTO __PREFIX__api_config (api_type, name, url, enabled, priority)
                     VALUES ('hitokoto', ?, ?, ?, ?)`,
                    [api.name, api.url, api.enabled ? 1 : 0, api.priority || 1]
                );
            }
        }

        if (data.qqInfo) {
            await db.query(
                `INSERT INTO __PREFIX__api_config (api_type, name, url, enabled)
                 VALUES ('qqInfo', 'qqInfo', ?, ?)
                 ON DUPLICATE KEY UPDATE url = VALUES(url), enabled = VALUES(enabled)`,
                [data.qqInfo.url, data.qqInfo.enabled ? 1 : 0]
            );
        }

        if (data.weather) {
            const extraConfig = JSON.stringify({ city: data.weather.city || '' });
            await db.query(
                `INSERT INTO __PREFIX__api_config (api_type, name, url, enabled, extra_config)
                 VALUES ('weather', 'weather', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE url = VALUES(url), enabled = VALUES(enabled), extra_config = VALUES(extra_config)`,
                [data.weather.url, data.weather.enabled ? 1 : 0, extraConfig]
            );
        }

        return true;
    },

    // ========== 标签 ==========

    async getTags() {
        return await db.query('SELECT icon, name FROM __PREFIX__tags ORDER BY sort_order');
    },

    async updateTags(tags) {
        await db.query('DELETE FROM __PREFIX__tags');
        for (let i = 0; i < tags.length; i++) {
            await db.query(
                'INSERT INTO __PREFIX__tags (icon, name, sort_order) VALUES (?, ?, ?)',
                [tags[i].icon, tags[i].name, i + 1]
            );
        }
        return true;
    },

    // ========== 外链 ==========

    async getLinks() {
        return await db.query('SELECT name, url, icon, color FROM __PREFIX__links ORDER BY sort_order');
    },

    async updateLinks(links) {
        await db.query('DELETE FROM __PREFIX__links');
        for (let i = 0; i < links.length; i++) {
            await db.query(
                'INSERT INTO __PREFIX__links (name, url, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)',
                [links[i].name, links[i].url, links[i].icon, links[i].color || '#3b82f6', i + 1]
            );
        }
        return true;
    },

    // ========== 日程 ==========

    async getCourses() {
        return await db.query('SELECT id, name, day, TIME_FORMAT(start_time, "%H:%i") as startTime, TIME_FORMAT(end_time, "%H:%i") as endTime, location, color FROM __PREFIX__courses ORDER BY day, start_time');
    },

    async addCourse(course) {
        const result = await db.query(
            `INSERT INTO __PREFIX__courses (name, day, start_time, end_time, location, color)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [course.name, course.day, course.startTime, course.endTime, course.location, course.color || '#3b82f6']
        );
        return { id: result.insertId, ...course };
    },

    async updateCourse(id, data) {
        await db.query(
            `UPDATE __PREFIX__courses SET name = ?, day = ?, start_time = ?, end_time = ?, location = ?, color = ?
             WHERE id = ?`,
            [data.name, data.day, data.startTime, data.endTime, data.location, data.color, id]
        );
        return { id, ...data };
    },

    async deleteCourse(id) {
        await db.query('DELETE FROM __PREFIX__courses WHERE id = ?', [id]);
        return true;
    },

    async getEvents() {
        return await db.query('SELECT id, name, day, TIME_FORMAT(start_time, "%H:%i") as startTime, TIME_FORMAT(end_time, "%H:%i") as endTime, type, color FROM __PREFIX__events ORDER BY day, start_time');
    },

    async addEvent(event) {
        const result = await db.query(
            `INSERT INTO __PREFIX__events (name, day, start_time, end_time, type, color)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [event.name, event.day, event.startTime, event.endTime, event.type || 'other', event.color || '#22c55e']
        );
        return { id: result.insertId, ...event };
    },

    async updateEvent(id, data) {
        await db.query(
            `UPDATE __PREFIX__events SET name = ?, day = ?, start_time = ?, end_time = ?, type = ?, color = ?
             WHERE id = ?`,
            [data.name, data.day, data.startTime, data.endTime, data.type, data.color, id]
        );
        return { id, ...data };
    },

    async deleteEvent(id) {
        await db.query('DELETE FROM __PREFIX__events WHERE id = ?', [id]);
        return true;
    },

    async getSchedule() {
        const [courses, events] = await Promise.all([
            this.getCourses(),
            this.getEvents()
        ]);
        return { courses, events };
    },

    // ========== 动态 ==========

    async getActivities() {
        return await db.query('SELECT id, content as text, time_desc as time FROM __PREFIX__activities ORDER BY created_at DESC');
    },

    async addActivity(activity) {
        const result = await db.query(
            `INSERT INTO __PREFIX__activities (content, time_desc)
             VALUES (?, ?)`,
            [activity.text, activity.time]
        );
        return { id: result.insertId, ...activity };
    },

    async updateActivity(id, data) {
        await db.query(
            `UPDATE __PREFIX__activities SET content = ?, time_desc = ? WHERE id = ?`,
            [data.text, data.time, id]
        );
        return { id, ...data };
    },

    async deleteActivity(id) {
        await db.query('DELETE FROM __PREFIX__activities WHERE id = ?', [id]);
        return true;
    },

    // ========== 挂件 ==========

    async getWidgets() {
        const rows = await db.query('SELECT widget_type, enabled, config FROM __PREFIX__widgets');
        const result = {};
        for (const row of rows) {
            let config = {};
            if (row.config) {
                try { config = JSON.parse(row.config); } catch (e) {}
            }
            result[row.widget_type] = { enabled: !!row.enabled, ...config };
        }
        return result;
    },

    // ========== 公开配置 ==========

    async getPublicConfig() {
        const [site, apis, tags, links, schedule, widgets, activities] = await Promise.all([
            this.getSiteConfig(),
            this.getApis(),
            this.getTags(),
            this.getLinks(),
            this.getSchedule(),
            this.getWidgets(),
            this.getActivities()
        ]);

        return { site, apis, tags, links, schedule, widgets, activities };
    }
};

// ========== 统一导出接口 ==========

/**
 * 获取数据存储实例
 */
function getStore() {
    return db.isMySQL() ? MySQLStore : JsonStore;
}

module.exports = {
    // 工具函数
    md5,
    generateToken,

    // 存储实例
    getStore,

    // 代理方法
    getSiteConfig: () => getStore().getSiteConfig(),
    updateSiteConfig: (data) => getStore().updateSiteConfig(data),
    getAdmin: () => getStore().getAdmin(),
    updateAdmin: (data) => getStore().updateAdmin(data),
    getApis: () => getStore().getApis(),
    updateApis: (data) => getStore().updateApis(data),
    getTags: () => getStore().getTags(),
    updateTags: (tags) => getStore().updateTags(tags),
    getLinks: () => getStore().getLinks(),
    updateLinks: (links) => getStore().updateLinks(links),
    getSchedule: () => getStore().getSchedule(),
    getCourses: () => getStore().getCourses(),
    addCourse: (course) => getStore().addCourse(course),
    updateCourse: (id, data) => getStore().updateCourse(id, data),
    deleteCourse: (id) => getStore().deleteCourse(id),
    getEvents: () => getStore().getEvents(),
    addEvent: (event) => getStore().addEvent(event),
    updateEvent: (id, data) => getStore().updateEvent(id, data),
    deleteEvent: (id) => getStore().deleteEvent(id),
    getActivities: () => getStore().getActivities(),
    addActivity: (activity) => getStore().addActivity(activity),
    updateActivity: (id, data) => getStore().updateActivity(id, data),
    deleteActivity: (id) => getStore().deleteActivity(id),
    getWidgets: () => getStore().getWidgets(),
    getPublicConfig: () => getStore().getPublicConfig(),

    // JSON 模式专用
    JsonStore,

    // MySQL 模式专用
    MySQLStore
};
