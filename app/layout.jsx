import './globals.css';

export const metadata = {
  title: '忆伴 · 让每一份回忆，都有温度',
  description: '面向认知障碍家庭的数字记忆与陪伴工具 · 新生杯原型',
};

export default function RootLayout({ children }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
