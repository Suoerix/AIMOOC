import Document, { Head, Html, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render() {
    const description =
      '弘识智教 AIMOOC——AI 加教育展示平台：把 B 站视频变成一堂 AI 课。可视化教学优先，配 AI 助教语音陪学与课堂互动出题。'
    const sitename = '弘识智教'
    const title = '弘识智教 · AI 教室'

    return (
      <Html lang="zh-CN" className="dark">
        <Head>
          <title>{title}</title>
          <link
            rel="icon"
            href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎓</text></svg>"
          />
          <meta name="description" content={description} />
          <meta name="theme-color" content="#040711" />
          <meta property="og:site_name" content={sitename} />
          <meta property="og:description" content={description} />
          <meta property="og:title" content={title} />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
        </Head>
        <body className="bg-[#040711] text-slate-100">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
