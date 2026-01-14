import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.novellog.app', // 唯一的包名 ID
  appName: '读迹', // App 名称
  webDir: 'dist', // Vite 构建输出的目录
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true
    }
  }
};

export default config;