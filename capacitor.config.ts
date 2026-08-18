import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ai.teacher',
  appName: 'AI教师',
  webDir: 'dist',
  android: {
    // 允许 WebView 内的导航在外部浏览器打开（如点外链）
    allowMixedContent: true,
  },
  server: {
    // 这里可以覆盖 APK 加载的入口；留空则加载打包进来的 dist
    // androidScheme: 'https'
  }
};

export default config;
