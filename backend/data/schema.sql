-- 悠悠个人主页数据库结构
-- 创建时间: 自动生成

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 1. 系统配置表
-- ----------------------------
DROP TABLE IF EXISTS `site_config`;
CREATE TABLE `site_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL COMMENT '配置键',
  `config_value` text COMMENT '配置值',
  `config_type` varchar(50) DEFAULT 'string' COMMENT '值类型: string, json, number, boolean',
  `description` varchar(255) DEFAULT NULL COMMENT '配置说明',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- ----------------------------
-- 2. 管理员表
-- ----------------------------
DROP TABLE IF EXISTS `admin`;
CREATE TABLE `admin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL COMMENT '用户名',
  `password` varchar(255) NOT NULL COMMENT '密码哈希',
  `email` varchar(255) DEFAULT NULL COMMENT '邮箱',
  `token` varchar(255) DEFAULT NULL COMMENT '登录令牌',
  `token_expiry` bigint(20) DEFAULT NULL COMMENT '令牌过期时间',
  `last_login` timestamp NULL DEFAULT NULL COMMENT '最后登录时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- ----------------------------
-- 3. API配置表
-- ----------------------------
DROP TABLE IF EXISTS `api_config`;
CREATE TABLE `api_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `api_type` varchar(50) NOT NULL COMMENT 'API类型: anime, hitokoto, qqInfo, weather',
  `name` varchar(100) NOT NULL COMMENT 'API名称',
  `url` varchar(500) NOT NULL COMMENT 'API地址',
  `enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `priority` int(11) DEFAULT 1 COMMENT '优先级(数字越小越优先)',
  `extra_config` json DEFAULT NULL COMMENT '额外配置(JSON格式)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_api_type` (`api_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API配置表';

-- ----------------------------
-- 4. 标签表
-- ----------------------------
DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `icon` varchar(50) DEFAULT NULL COMMENT '图标名称',
  `name` varchar(100) NOT NULL COMMENT '标签名称',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表';

-- ----------------------------
-- 5. 外链表
-- ----------------------------
DROP TABLE IF EXISTS `links`;
CREATE TABLE `links` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '链接名称',
  `url` varchar(500) NOT NULL COMMENT '链接地址',
  `icon` varchar(500) DEFAULT NULL COMMENT '图标地址',
  `color` varchar(20) DEFAULT '#3b82f6' COMMENT '主题色',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='外链表';

-- ----------------------------
-- 6. 课程表
-- ----------------------------
DROP TABLE IF EXISTS `courses`;
CREATE TABLE `courses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '课程名称',
  `day` tinyint(4) NOT NULL COMMENT '星期几(1-7)',
  `start_time` time NOT NULL COMMENT '开始时间',
  `end_time` time NOT NULL COMMENT '结束时间',
  `location` varchar(100) DEFAULT NULL COMMENT '地点',
  `color` varchar(20) DEFAULT '#3b82f6' COMMENT '颜色标记',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_day` (`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程表';

-- ----------------------------
-- 7. 个人日程表
-- ----------------------------
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '日程名称',
  `day` tinyint(4) NOT NULL COMMENT '星期几(1-7)',
  `start_time` time NOT NULL COMMENT '开始时间',
  `end_time` time NOT NULL COMMENT '结束时间',
  `type` varchar(50) DEFAULT 'other' COMMENT '类型: course, hobby, project, study, other',
  `color` varchar(20) DEFAULT '#22c55e' COMMENT '颜色标记',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_day` (`day`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='个人日程表';

-- ----------------------------
-- 8. 动态表
-- ----------------------------
DROP TABLE IF EXISTS `activities`;
CREATE TABLE `activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL COMMENT '动态内容',
  `time_desc` varchar(100) DEFAULT NULL COMMENT '时间描述',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='动态表';

-- ----------------------------
-- 9. 挂件配置表
-- ----------------------------
DROP TABLE IF EXISTS `widgets`;
CREATE TABLE `widgets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `widget_type` varchar(50) NOT NULL COMMENT '挂件类型',
  `enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `config` json DEFAULT NULL COMMENT '配置信息',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_widget_type` (`widget_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='挂件配置表';

-- ----------------------------
-- 10. 安装锁定表
-- ----------------------------
DROP TABLE IF EXISTS `install_lock`;
CREATE TABLE `install_lock` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `is_locked` tinyint(1) DEFAULT 1 COMMENT '是否锁定',
  `installed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `installer_ip` varchar(50) DEFAULT NULL COMMENT '安装者IP',
  `version` varchar(20) DEFAULT NULL COMMENT '安装版本',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='安装锁定表';

-- ----------------------------
-- 插入默认配置数据
-- ----------------------------
INSERT INTO `site_config` (`config_key`, `config_value`, `config_type`, `description`) VALUES
('title', '悠悠の小站', 'string', '网站标题'),
('subtitle', '探索简洁、逻辑与二次元的平衡点', 'string', '网站副标题'),
('nickname', '悠悠', 'string', '昵称'),
('qq', '', 'string', 'QQ号'),
('customAvatar', '', 'string', '自定义头像URL'),
('bio', '热爱二次元的平凡学生', 'string', '个人简介'),
('signature', '小小世界 开心至上', 'string', '个性签名'),
('start_date', CURDATE(), 'string', '网站开始日期'),
('favicon', '', 'string', '网站图标');

-- 插入默认API配置
INSERT INTO `api_config` (`api_type`, `name`, `url`, `enabled`, `priority`) VALUES
('anime', 'yppp', 'https://api.yppp.net/api.php', 1, 1),
('anime', 'loliapi', 'https://www.loliapi.com/acg/', 1, 2),
('hitokoto', 'hitokoto', 'https://v1.hitokoto.cn/?encode=text', 1, 1);

INSERT INTO `api_config` (`api_type`, `name`, `url`, `enabled`, `extra_config`) VALUES
('qqInfo', 'qqInfo', 'https://uapis.cn/api/v1/social/qq/userinfo', 1, NULL),
('weather', 'weather', 'https://uapis.cn/api/v1/misc/weather', 1, '{"city": ""}');

-- 插入默认标签
INSERT INTO `tags` (`icon`, `name`, `sort_order`) VALUES
('gamepad', 'ACG', 1),
('code', 'Code', 2),
('sparkles', '二次元', 3);

-- 插入默认挂件配置
INSERT INTO `widgets` (`widget_type`, `enabled`, `config`) VALUES
('sakana', 1, '{"characters": [{"name": "chisato", "position": "right", "size": 200}, {"name": "takina", "position": "left", "size": 200}]}');

SET FOREIGN_KEY_CHECKS = 1;
