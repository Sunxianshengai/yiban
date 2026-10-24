import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// 已登录访客不需要再看介绍页：会话 cookie 存在就直接进应用
// （cookie 名与 lib/auth.mjs 的 COOKIE_NAME 一致；有效性由 /app 页自己校验）。
const SESSION_COOKIE = 'yiban_session';

export const metadata = {
  title: '忆伴 · 把家里的故事，好好保存下来',
  description: '忆伴是全家人的记忆空间：照片、声音与往事放在一处，由家人共同核对与回看，还能让回忆用自己的声音开口讲述。',
};

const FEATURES = [
  { title: '记忆库', text: '按时间、人物与地点整理每一段家庭记忆，支持全文检索与发布前审核。' },
  { title: '成长记录', text: '为每位成员保留成长时间线、里程碑与童言童语，那一年几岁一目了然。' },
  { title: '陪伴对话', text: '基于家里真实记忆的对话陪伴，每句话都能回溯到记忆原文。' },
  { title: '人生推演', text: '从一段真实记忆出发，往后推演另一条人生岔路，并明确标注这是假设。' },
  { title: '时间胶囊', text: '写给未来的信。到期之前，内容对包括作者在内的任何人都保密。' },
  { title: '回忆专辑', text: '把零散的记忆串成完整讲述，可以一键导出打印成册。' },
];

const FAQ = [
  { q: '谁能看到这些记忆？', a: '未发布的记忆只有编辑者可见；查看者只能浏览已发布内容。时间胶囊在到期前对任何人都保密，包括写信的人。' },
  { q: '使用需要付费吗？', a: '浏览、整理、检索与对话免费。声音复刻、配音与视频生成按服务商定价计费，生成前都会明确提示成本。' },
  { q: '记忆的数据归谁？', a: '数据保存在你们家庭自己的空间里，随时可以一键导出记忆元数据，照片与音视频文件也可另行保存。' },
];

export default async function LandingPage() {
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)) redirect('/app');

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="/"><span className="brand-mark"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></span>忆伴</a>
        <nav className="landing-links" aria-label="页面导航">
          <a href="#intro">简介</a>
          <a href="#features">功能</a>
          <a href="#desktop">桌面版</a>
          <a href="#faq">常见问题</a>
        </nav>
        <div className="landing-actions">
          <a className="landing-cta" href="/app">进入忆伴</a>
        </div>
      </header>

      <section className="landing-hero" id="intro">
        <div className="landing-visual" aria-hidden="true">
          <div className="landing-bubble">帮我找 <em>1999 年</em> 老院子里拍的那张全家福</div>
          <div className="landing-window">
            <img src="/demo/courtyard.svg" alt="" />
            <img src="/demo/newyear.svg" alt="" />
            <img src="/demo/train.svg" alt="" />
            <img src="/demo/kitchen.svg" alt="" />
            <img src="/demo/wedding.svg" alt="" />
            <img src="/demo/graduation.svg" alt="" />
          </div>
        </div>
        <div className="landing-hero-copy">
          <span className="landing-kicker">忆伴 · 家庭记忆与陪伴工具</span>
          <h1>把家里的故事，<br />好好保存下来</h1>
          <p>忆伴是全家人的记忆空间：照片、声音与往事放在一处，由家人共同核对与回看，还能让回忆用自己的声音开口讲述。</p>
          <div className="landing-hero-actions">
            <a className="landing-cta big" href="/app">免费开始使用</a>
            <a className="landing-ghost" href="#features">了解功能</a>
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <span className="landing-kicker">功能</span>
        <h2>一个地方，装下一家人的记忆</h2>
        <div className="landing-grid">
          {FEATURES.map(f => (
            <article className="landing-card" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-desktop" id="desktop">
        <div className="landing-desktop-copy">
          <span className="landing-kicker">桌面版</span>
          <h2>在大屏幕上，<br />和长辈一起翻相册</h2>
          <p>Windows 桌面应用与浏览器版本功能一致，界面为长辈做了字号与对比度适配，也可以直接投屏到电视。</p>
          <div className="landing-hero-actions">
            <a className="landing-cta" href="/app">立即体验</a>
            <a className="landing-link" href="https://github.com/Sunxianshengai/yiban/releases" target="_blank" rel="noreferrer">下载 Windows 版 ›</a>
          </div>
        </div>
        <div className="landing-visual small" aria-hidden="true">
          <div className="landing-window two">
            <img src="/demo/westlake.svg" alt="" />
            <img src="/demo/childhood.svg" alt="" />
          </div>
        </div>
      </section>

      <section className="landing-faq" id="faq">
        <span className="landing-kicker">常见问题</span>
        <h2>开始之前，先弄清楚这几件事</h2>
        <div className="landing-faq-list">
          {FAQ.map(item => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-final">
        <h2>今晚，就从一段回忆开始</h2>
        <a className="landing-cta big" href="/app">免费开始使用</a>
      </section>

      <footer className="landing-footer">
        <span>忆伴 · 让每一份回忆，都有温度</span>
        <span>新生杯作品原型 · 家庭记忆与陪伴工具</span>
      </footer>
    </div>
  );
}
