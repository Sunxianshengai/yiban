import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Icon from '../components/Icon';

// 已登录访客不需要再看介绍页：会话 cookie 存在就直接进应用
// （cookie 名与 lib/auth.mjs 的 COOKIE_NAME 一致；有效性由 /app 页自己校验）。
const SESSION_COOKIE = 'yiban_session';

export const metadata = {
  title: '忆伴 · 把家里的故事，好好保存下来',
  description: '忆伴是全家人的记忆空间：照片、声音与往事放在一处，由家人共同核对与回看，还能让回忆用自己的声音开口讲述。',
};

const NAV_LINKS = [
  { href: '#features', label: '核心能力' },
  { href: '#how', label: '使用方式' },
  { href: '#desktop', label: '桌面版' },
  { href: '#faq', label: '常见问题' },
];

const HERO_META = [
  { value: '3 类', label: '角色权限 · 管理员 / 编辑者 / 查看者' },
  { value: '4 项', label: '适老设置 · 字号 / 对比度 / 朗读速度' },
  { value: '1 个', label: '家庭空间 · 记忆与家人共享' },
];

// 按「怎样留下 → 家人怎样一起补充 → 怎样回来听和看」组织，与页面的三步时间轴对应。
const STEPS = [
  { no: '第一步', icon: 'pen-line', title: '一分钟记下一段', text: '添加照片、录音或视频，先写标题和一句故事；年份、地点、人物可以以后慢慢补。保存后先进入待核对，确认无误才发布给家人。' },
  { no: '第二步', icon: 'users', title: '家人一起核对补充', text: '编辑者整理文字、补齐人物与年份，核对后发布。家人在每段记忆下留言，点「我也记得」，这些回应都留在故事旁边。' },
  { no: '第三步', icon: 'headphones', title: '随时回来听和看', text: '照片可放大，故事可朗读，控制清楚稳定。专辑把零散记忆串成长讲述，时间胶囊把话留给未来某个日子。' },
];

const NOTES = [
  { icon: 'shield-check', text: '受邀请码保护：账号由管理员生成，每位家人用自己的邮箱登录，查看者只能浏览已发布内容。' },
  { icon: 'book', text: '数据保存在你们家庭自己的空间里，随时可以导出记忆元数据，照片与音视频文件也可另行保存。' },
  { icon: 'sparkle', text: 'AI 生成的内容都带明确标识：原声录音、设备朗读与合成声音分得清，生成结果必须经家人核对。' },
  { icon: 'sun', text: '新的 AI 生成消耗积分：由管理员发放，执行前先确认本次价格，失败自动退回。浏览与回放免费，不接支付。' },
];

const FAQ = [
  { q: '谁能看到这些记忆？', a: '未发布的记忆只有编辑者可见；查看者只能浏览已发布内容。时间胶囊在到期前对任何人都保密，包括写信的人。' },
  { q: '使用需要付费吗？', a: '浏览、整理、检索与回放免费。新的 AI 生成消耗积分，积分由管理员发放；执行前先展示价格，失败自动退回。当前不接支付，也没有人民币兑换。' },
  { q: '记忆的数据归谁？', a: '数据保存在你们家庭自己的空间里，随时可以一键导出记忆元数据，照片与音视频文件也可另行保存。' },
];

const FOOTER_LINKS = [
  { title: '了解忆伴', links: [
    ['核心能力', '#features'],
    ['使用方式', '#how'],
    ['桌面版', '#desktop'],
    ['常见问题', '#faq'],
  ]},
  { title: '开始使用', links: [
    ['进入家庭空间', '/app'],
    ['创建家庭与账号', '/app'],
    ['用邀请码加入家人', '/app'],
  ]},
];

const BRAND_MARK = (
  <span className="brand-mark"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></span>
);

export default async function LandingPage() {
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)) redirect('/app');

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="/">{BRAND_MARK}忆伴</a>
        <nav className="landing-links" aria-label="页面导航">
          {NAV_LINKS.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <div className="landing-actions">
          <a className="landing-ghost" href="/app">进入家庭空间</a>
          <a className="landing-cta" href="/app">开始记录</a>
        </div>
      </header>

      <section className="landing-hero" id="intro">
        <div className="landing-hero-copy">
          <span className="landing-chip"><Icon name="heart-handshake" size={15} />为全家而建 · 长辈也能轻松用</span>
          <h1>把家的故事，<br />好好<em>收藏</em>、慢慢<em>重温</em></h1>
          <p>一张照片、一段声音、一句回忆，都能成为可核对、可整理、可回望的家庭故事。年轻人随手记录，长辈一键回看、听故事、聊往事。</p>
          <div className="landing-hero-actions">
            <a className="landing-cta big" href="/app">开始记录第一段回忆</a>
            <a className="landing-ghost" href="#how">看看怎么用</a>
          </div>
          <div className="landing-hero-meta">
            {HERO_META.map(item => <div key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-hero-photo">
            <img src="/auth-bg/hands-photos.jpg" alt="家人围坐在一起翻看老照片" />
          </div>
          <figure className="landing-polaroid">
            <img src="/auth-bg/album-warm.jpg" alt="" />
            <figcaption>示例故事 · 可替换为你们家的</figcaption>
          </figure>
          <span className="landing-live-badge"><i aria-hidden="true" />发布之前，先由家人一起核对</span>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section-head">
          <span className="landing-chip">核心能力</span>
          <h2>记录、整理、回望、陪伴，都在一处</h2>
          <p>几件小事围绕同一个家展开：真实记忆优先，AI 生成的内容始终明确标注。</p>
        </div>
        <div className="landing-bento">
          <div className="landing-bento-col">
            <a className="landing-fcard is-photo tall" href="/app">
              <img className="bgimg" src="/auth-bg/family-album.jpg" alt="" />
              <span className="shade" aria-hidden="true" />
              <div className="fbody">
                <span className="tag">记忆库</span>
                <h3>照片、录音、视频，随手存成故事</h3>
                <p>上传即建档：家人一起核对时间、人物与地点，确认之后才发布给全家。</p>
                <span className="go">进入记忆库 <Icon name="arrow" size={15} /></span>
              </div>
            </a>
            <div className="landing-bento-row2">
              <a className="landing-fcard is-tint tint-gold compact" href="/app">
                <span className="f-icon"><Icon name="hourglass" size={22} /></span>
                <div className="fbody">
                  <span className="tag">时间胶囊</span>
                  <h3>留一封信给未来</h3>
                  <span className="go">约好打开的日子 <Icon name="arrow" size={15} /></span>
                </div>
              </a>
              <a className="landing-fcard is-tint tint-blue compact" href="/app">
                <span className="f-icon"><Icon name="waypoints" size={22} /></span>
                <div className="fbody">
                  <span className="tag">问题引导</span>
                  <h3>从一个问题，记下家人的原话</h3>
                  <span className="go">问问家人 <Icon name="arrow" size={15} /></span>
                </div>
              </a>
            </div>
          </div>
          <div className="landing-bento-col">
            <a className="landing-fcard is-brand" href="/app">
              <div className="fbody">
                <span className="f-icon"><Icon name="mic" size={26} /></span>
                <div>
                  <span className="tag">陪伴对话</span>
                  <h3>聊今天，也找回家里的旧事</h3>
                  <p>家伴参考已经核对的家庭记忆，回答附上来源。AI 陪伴，不代表任何真实家人。</p>
                  <span className="go">开始陪伴 <Icon name="arrow" size={15} /></span>
                </div>
              </div>
            </a>
            <a className="landing-fcard is-photo" href="/app">
              <img className="bgimg" src="/auth-bg/album-warm.jpg" alt="" />
              <span className="shade" aria-hidden="true" />
              <div className="fbody">
                <span className="tag">家人故事</span>
                <h3>每一位家人，都有自己的故事</h3>
                <p>把旅行、毕业、团聚和普通日子，沿着人物与年份慢慢展开。</p>
                <span className="go">查看成长线 <Icon name="arrow" size={15} /></span>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how">
        <div className="landing-section-head">
          <span className="landing-chip">使用方式</span>
          <h2>三步，把回忆交还给全家</h2>
          <p>忆伴不是一个人的网盘，而是全家共用的记忆空间：记录、核对、回看，每一步都有家人参与。</p>
        </div>
        <div className="landing-timeline">
          {STEPS.map(step => (
            <article className="landing-step" key={step.no}>
              <span className="node"><Icon name={step.icon} size={26} /></span>
              <div className="step-copy">
                <em>{step.no}</em>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="landing-notes">
          {NOTES.map(note => <span key={note.text}><Icon name={note.icon} size={17} />{note.text}</span>)}
        </div>
      </section>

      <section className="landing-section landing-desktop" id="desktop">
        <div className="landing-desktop-copy">
          <span className="landing-chip">桌面版</span>
          <h2>在大屏幕上，<br />和长辈一起翻相册</h2>
          <p>Windows 桌面应用与浏览器版本功能一致，字号可调到长辈阅读档，也可以直接投屏到电视。需要联网使用。</p>
          <div className="landing-hero-actions">
            <a className="landing-cta" href="/app">立即体验</a>
            <a className="landing-link" href="https://github.com/Sunxianshengai/yiban/releases" target="_blank" rel="noreferrer">下载 Windows 版 <Icon name="arrow" size={15} /></a>
          </div>
        </div>
        <div className="landing-window" aria-hidden="true">
          <div className="landing-window-bar"><i /><i /><i /><em>yiban · 忆伴</em></div>
          <div className="landing-window-body">
            <div className="landing-window-side">
              <span className="on" /><span /><span /><span /><span />
            </div>
            <div className="landing-window-main">
              <div className="landing-window-photos">
                <img src="/auth-bg/family-album.jpg" alt="" />
                <img src="/auth-bg/hands-photos.jpg" alt="" />
                <img src="/auth-bg/album-warm.jpg" alt="" />
              </div>
              <span className="landing-window-line" />
              <span className="landing-window-line short" />
              <div className="landing-window-player">
                <Icon name="circle-play" size={22} />
                <span className="pw"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
                <time>03:12</time>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-faq" id="faq">
        <div className="landing-section-head">
          <span className="landing-chip">常见问题</span>
          <h2>开始之前，先弄清楚这几件事</h2>
        </div>
        <div className="landing-faq-list">
          {FAQ.map(item => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="landing-final-wrap">
        <section className="landing-final">
          <span className="landing-chip">现在开始</span>
          <h2>第一条回忆，一句话就够</h2>
          <p>写下「那年夏天我们去了海边」，忆伴会帮你整理成全家都能回望的故事。</p>
          <div className="acts">
            <a className="landing-btn-light" href="/app">进入家庭空间</a>
            <a className="landing-btn-outline" href="/app">用邀请码加入</a>
          </div>
        </section>
      </div>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <a className="landing-brand" href="/">{BRAND_MARK}忆伴</a>
            <p>让照片、文字、录音和视频，成为可核对、可整理、可重温的家庭故事。</p>
          </div>
          {FOOTER_LINKS.map(column => (
            <nav key={column.title} aria-label={column.title}>
              <h3>{column.title}</h3>
              <ul>
                {column.links.map(([label, href]) => <li key={label}><a href={href}>{label}</a></li>)}
              </ul>
            </nav>
          ))}
        </div>
        <div className="landing-footer-base">
          <span>© 2026 忆伴 · 家庭记忆与陪伴</span>
          <span>AI 生成内容明确标注 · 扣费前必先说明</span>
        </div>
      </footer>
    </div>
  );
}
