import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/noto-serif-sc';
import './globals.css';
import './credits.css';
import './product.css';
import './chat-workspace.css';

export const metadata = {
  title: '忆伴 · 让每一份回忆，都有温度',
  description: '为每个年龄段的家人保存回忆、讲述故事与日常陪伴。',
};

export default function RootLayout({ children }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
