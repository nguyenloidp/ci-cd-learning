const express = require('express');
const path = require('path');

// Thông tin phiên bản được CI/CD truyền vào lúc build image (xem Dockerfile)
const VERSION = process.env.APP_VERSION || 'dev';
const STARTED_AT = new Date().toISOString();

// Dữ liệu mẫu cho trang nội bộ — sau này có thể thay bằng database
const announcements = [
  { id: 1, title: 'Chào mừng đến cổng thông tin nội bộ', date: '2026-11-14' },
  { id: 2, title: 'Mỗi lần push lên main, website sẽ tự động deploy lại', date: '2026-11-14' },
];

const links = [
  { name: 'GitHub repo', url: 'https://github.com/nguyenloidp/ci-cd-learning' },
  { name: 'GitHub Actions', url: 'https://github.com/nguyenloidp/ci-cd-learning/actions' },
];

function createApp() {
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Health check: Docker và pipeline CD dùng endpoint này để biết app còn sống
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/api/info', (req, res) =>
    res.json({ version: VERSION, startedAt: STARTED_AT })
  );
  app.get('/api/announcements', (req, res) => res.json(announcements));
  app.get('/api/links', (req, res) => res.json(links));

  return app;
}

module.exports = { createApp };
