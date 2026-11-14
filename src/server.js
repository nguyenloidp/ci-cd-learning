const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
createApp().listen(PORT, () => {
  console.log(`Internal portal đang chạy tại http://localhost:${PORT}`);
});
