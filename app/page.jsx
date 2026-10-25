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
  { href: '#how', label: '如何使用' },
  { href: '#join', label: '开始使用' },
];

const FOOTER_LINKS = [
  { title: '开始使用', links: [
    ['进入家庭空间', '/app'],
    ['创建家庭与账号', '/app'],
    ['用邀请码加入家人', '/app'],
  ]},
  { title: '了解更多', links: [
    ['桌面版下载', 'https://github.com/Sunxianshengai/yiban/releases'],
    ['AI 内容标识与计费说明', '#join'],
  ]},
];

const HERO_NOTES = ['受邀请码保护 · 家人各自登录', 'AI 回答引用已核对的记忆', '浏览免费 · 生成扣积分，失败退回'];

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

      {/* 首屏：流动渐变 + 居中单列 + 极光胶囊 */}
      <section className="lp-hero" id="intro">
        <div className="lp-hero-inner">
          <h1>把家的故事，<br />好好<em>收藏</em>、慢慢<em>重温</em></h1>
          <p>一张照片、一段声音、一句回忆，都值得留给以后。家人一起记录、核对、回望，AI 陪伴始终温和在场。</p>
          <div className="landing-hero-actions">
            <a className="landing-cta big" href="/app">开始记录第一段回忆</a>
            <a className="landing-ghost" href="#how">看看怎么用</a>
          </div>
          <div className="lp-hero-notes">
            {HERO_NOTES.map(note => <span key={note}><Icon name="check" size={14} />{note}</span>)}
          </div>
        </div>
      </section>

      {/* 三组「左文右机」卖点区，样机为纯 CSS 实现 */}
      <section id="features">
        <div className="lp-split">
          <div className="lp-copy">
            <div className="lp-appicon">💜</div>
            <h2>被理解，一直在。</h2>
            <p className="lp-lead">家伴知道家里每个人的故事。聊起往事时，回答会引用你们核对过的记忆，附上原文出处——温和，但从不编造。</p>
          </div>
          <div className="lp-phone"><span className="lp-notch" /><div className="lp-screen lp-sunset">
            <div className="lp-wheel"><span className="faint">1945</span><span>1962</span><span className="on">1995</span><span>2008</span><span className="faint">2024</span></div>
            <div className="lp-cta-bar"><span className="lp-darkpill">选好了，聊聊这一年 →</span></div>
          </div></div>
        </div>

        <div className="lp-split reverse">
          <div className="lp-phone lavbg"><span className="lp-notch" /><div className="lp-screen lp-chat">
            <div className="lp-msg them"><i className="lp-pavatar">爸</i>今天降温了，出门记得穿那件厚外套。</div>
            <div className="lp-msg me">好嘞。对了，周末我回家吃饭？</div>
            <div className="lp-msg them"><i className="lp-pavatar">爸</i>回！你妈念叨好几天了，说想包饺子。</div>
            <div className="lp-msg src">📖 引用家庭记忆：去年除夕「一起包饺子的夜晚」 · 已核对</div>
          </div>
          <div className="lp-chips"><span className="hot">好啊，想吃韭菜的</span><span>下周再回</span><span>让她歇歇，我来擀皮</span></div>
          <div className="lp-inputbar"><span>🎙️</span><div className="lp-field">说点什么…</div><div className="lp-send">➤</div></div>
          </div>
          <div className="lp-copy">
            <div className="lp-appicon">🛡️</div>
            <h2>家的语气，原样保存。</h2>
            <p className="lp-lead">语音、照片、视频都可以存进记忆库，发布前由家人一起核对。日常聊天像发消息一样自然，建议回复就在输入框旁边。</p>
          </div>
        </div>

        <div className="lp-split">
          <div className="lp-copy">
            <div className="lp-appicon">📖</div>
            <h2>每段记忆，都有出处。</h2>
            <p className="lp-lead">故事叠印在照片上，人物、地点、年份一目了然；发布前由家人核对，回望时连「那天很开心」都有据可查。</p>
          </div>
          <div className="lp-phone lavbg"><span className="lp-notch" /><div className="lp-screen">
            <div className="lp-memcard">
              <div className="mtitle">全家去西湖的那个夏天</div>
              <div className="mstory">那是一个晴朗的夏天。我们一家三口去杭州，在西湖边坐了好久。风很轻，笑声一直留在心里。</div>
              <div className="mtags"><span>旅行</span><span>全家福</span></div>
            </div>
            <div className="lp-chiprow"><div>📍 杭州 · 西湖</div><div>📅 1995 年夏</div></div>
            <div className="lp-navycta">下一步 · 请家人核对</div>
          </div></div>
        </div>
      </section>

      {/* 滚动叙事：三步，极光背景 + 白卡 */}
      <div className="lp-story" id="how">
        <section className="lp-snap"><div className="lp-aurora" />
          <div className="lp-card"><div className="lp-ico">🏡</div><h3>第一步 · 建一个家</h3><p>邀请家人加入，或先从一个人的记忆小屋开始。每个人都用自己的账号，只看得到发布过的内容。</p></div>
          <span className="lp-down" aria-hidden="true">⌄</span>
        </section>
        <section className="lp-snap"><div className="lp-aurora" />
          <div className="lp-card"><div className="lp-ico">📷</div><h3>第二步 · 记下片刻</h3><p>一句话就能建档，照片、录音随时补。家人一起核对人物与年份，确认后才发布给全家。</p></div>
          <span className="lp-down" aria-hidden="true">⌄</span>
        </section>
        <section className="lp-snap"><div className="lp-aurora" />
          <div className="lp-card"><div className="lp-ico">💬</div><h3>第三步 · 随时聊聊</h3><p>聊今天，也聊旧事。AI 陪伴引用已核对的家庭记忆，回答附带来源，永远是家里的语气。</p></div>
          <span className="lp-down" aria-hidden="true">⌄</span>
        </section>
      </div>

      <div className="landing-final-wrap" id="join">
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
