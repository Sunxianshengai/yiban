import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// 已登录访客不需要再看介绍页：会话 cookie 存在就直接进应用
// （cookie 名与 lib/auth.mjs 的 COOKIE_NAME 一致；有效性由 /app 页自己校验）。
const SESSION_COOKIE = 'yiban_session';

export const metadata = {
  title: '忆伴 · 把家里的故事，好好保存下来',
  description: '忆伴是全家人的记忆空间：照片、声音与往事放在一处，由家人共同核对与回看，还能让回忆用自己的声音开口讲述。',
};

// 按「怎样留下 → 家人怎样一起补充 → 怎样回来听和看」组织演示，不铺功能卡。
const STEPS = [
  { no: '第一步', title: '一分钟记下一段', text: '添加照片、录音或视频，先写标题和一句故事；年份、地点、人物可以以后慢慢补。保存后先进入待核对，确认无误才发布给家人。' },
  { no: '第二步', title: '家人一起核对补充', text: '编辑者整理文字、补齐人物与年份，核对后发布。家人在每段记忆下留言，点「我也记得」，这些回应都留在故事旁边。' },
  { no: '第三步', title: '随时回来听和看', text: '照片可放大，故事可朗读，控制清楚稳定。专辑把零散记忆串成长讲述，时间胶囊把话留给未来某个日子。' },
];

const NOTES = [
  { icon: 'shield', text: '受邀请码保护：账号由管理员生成，每位家人用自己的邮箱登录，查看者只能浏览已发布内容。' },
  { icon: 'book', text: '数据保存在你们家庭自己的空间里，随时可以导出记忆元数据，照片与音视频文件也可另行保存。' },
  { icon: 'sparkle', text: 'AI 生成的内容都带明确标识：原声录音、设备朗读与合成声音分得清，生成结果必须经家人核对。' },
  { icon: 'sun', text: '新的 AI 生成消耗积分：由管理员发放，执行前先确认本次价格，失败自动退回。浏览与回放免费，不接支付。' },
];

const FAQ = [
  { q: '谁能看到这些记忆？', a: '未发布的记忆只有编辑者可见；查看者只能浏览已发布内容。时间胶囊在到期前对任何人都保密，包括写信的人。' },
  { q: '使用需要付费吗？', a: '浏览、整理、检索与回放免费。新的 AI 生成消耗积分，积分由管理员发放；执行前先展示价格，失败自动退回。当前不接支付，也没有人民币兑换。' },
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
          <a href="#how">使用方式</a>
          <a href="#desktop">桌面版</a>
          <a href="#faq">常见问题</a>
        </nav>
        <div className="landing-actions">
          <a className="landing-cta" href="/app">进入家庭空间</a>
        </div>
      </header>

      <section className="landing-hero" id="intro">
        <div className="landing-hero-copy">
          <span className="landing-kicker">忆伴 · 家庭记忆与陪伴</span>
          <h1>把家里的故事，<br />好好保存下来</h1>
          <p>照片、声音和往事放在一处，由家人共同核对与回看。年轻人容易记录，长辈轻松回看——想起哪一段，就回来看看。</p>
          <div className="landing-hero-actions">
            <a className="landing-cta big" href="/app">进入家庭空间</a>
            <a className="landing-ghost" href="#how">看看怎么用</a>
          </div>
        </div>
        <div className="landing-visual" aria-hidden="true">
          <img src="/auth-bg/hands-photos.jpg" alt="" />
          <figure className="landing-story-card">
            <strong>翻相册的下午</strong>
            <p>奶奶翻到 1999 年那张全家福，把院子里的事又讲了一遍，孩子们听完了才去写作业。</p>
            <small>示例记忆 · 进入后可替换为你们自己的故事</small>
          </figure>
        </div>
      </section>

      <section className="landing-section" id="how">
        <span className="landing-kicker">使用方式</span>
        <h2>三步，把回忆交还给全家</h2>
        <p className="landing-lede">忆伴不是一个人的网盘，而是全家共用的记忆空间：记录、核对、回看，每一步都有家里人参与。</p>
        <div className="landing-steps">
          {STEPS.map(step => (
            <article className="landing-step" key={step.no}>
              <em>{step.no}</em>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="landing-notes">
          {NOTES.map(note => (
            <span key={note.text}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={note.icon === 'shield' ? 'M12 2l9 4v6c0 7-9 10-9 10S3 19 3 12V6z M8 12l3 3 5-6' : note.icon === 'book' ? 'M12 5s-5-3-10-1v15c5-2 10 1 10 1s5-3 10-1V4c-5-2-10 1-10 1 M12 5v15' : note.icon === 'sparkle' ? 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z' : 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8 M12 1v3 M12 20v3 M1 12h3 M20 12h3 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2'}/></svg>{note.text}</span>
          ))}
        </div>
      </section>

      <section className="landing-section landing-desktop" id="desktop">
        <div className="landing-desktop-copy">
          <span className="landing-kicker">桌面版</span>
          <h2>在大屏幕上，<br />和长辈一起翻相册</h2>
          <p>Windows 桌面应用与浏览器版本功能一致，字号可调到长辈阅读档，也可以直接投屏到电视。需要联网使用。</p>
          <div className="landing-hero-actions">
            <a className="landing-cta" href="/app">立即体验</a>
            <a className="landing-link" href="https://github.com/Sunxianshengai/yiban/releases" target="_blank" rel="noreferrer">下载 Windows 版 ›</a>
          </div>
        </div>
        <div className="landing-visual small" aria-hidden="true">
          <img src="/auth-bg/family-album.jpg" alt="" />
        </div>
      </section>

      <section className="landing-section landing-faq" id="faq">
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
        <a className="landing-cta big" href="/app">进入家庭空间</a>
      </section>

      <footer className="landing-footer">
        <span>忆伴 · 让每一份回忆，都有温度</span>
        <span>新生杯作品原型 · 家庭记忆与陪伴工具</span>
      </footer>
    </div>
  );
}
