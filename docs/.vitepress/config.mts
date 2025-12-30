import { defineConfig, type HeadConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
import { withMermaid } from 'vitepress-plugin-mermaid'
// @ts-ignore
import timeline from "vitepress-markdown-timeline";
import { VitePWA } from 'vite-plugin-pwa'
import { readFile, stat, writeFile } from 'fs/promises'
import { isAbsolute as isAbsolutePath, join as joinPath, relative as relativePath } from 'path'

const SITE_TITLE = "VibeVibe"
const SITE_DESCRIPTION = "Vibe Coding 全栈实战教程 - 从 Next.js 到 AI 辅助开发，用 Vibe Coding 的方式重塑你的编程工作流。涵盖零基础入门、全栈开发、数据库、部署运维等核心主题。"
const SITE_URL_FALLBACK = 'https://www.vibevibe.cn'

function normalizeSiteUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function resolveSiteUrl(): string {
  const raw =
    process.env.SITE_URL || 
    process.env.EDGEONE_PAGES_URL || 
    process.env.DEPLOY_URL ||
    process.env.URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    SITE_URL_FALLBACK;

  const normalized = normalizeSiteUrl(raw);
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

const SITE_URL = resolveSiteUrl();

function urlPathForPage(relativePath: string): string {
  const p = relativePath.replace(/\\/g, '/');
  if (p === 'index.md') return '/';
  if (p.endsWith('/index.md')) return `/${p.slice(0, -'/index.md'.length)}/`;
  return `/${p.replace(/\.md$/, '.html')}`;
}

function stripFrontmatter(markdownSource: string): string {
  if (!markdownSource.startsWith('---')) return markdownSource;
  const match = markdownSource.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  if (!match) return markdownSource;
  return markdownSource.slice(match[0].length);
}

function parseSimpleFrontmatter(markdownSource: string): Record<string, string> {
  if (!markdownSource.startsWith('---')) return {};
  const match = markdownSource.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return {};

  const body = match[1];
  const result: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf(':');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '').trim();
    if (key) result[key] = value;
  }
  return result;
}

function stripMarkdown(markdownSource: string): string {
  let text = stripFrontmatter(markdownSource);
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]*`/g, ' ');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trim();
}

function extractDescriptionFromMarkdown(markdownSource: string): string | undefined {
  const text = stripMarkdown(markdownSource);
  if (!text) return undefined;
  return truncateText(text, 160);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeCdata(text: string): string {
  return text.replace(/]]>/g, ']]]]><![CDATA[>');
}

function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function displayNameFromPathSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  const withoutExt = decoded.replace(/\.html$/i, '');
  return withoutExt.replace(/[-_]+/g, ' ').trim() || decoded;
}

function buildBreadcrumbList(urlPath: string, fullUrl: string): Record<string, unknown> | undefined {
  const normalizedPath = urlPath.replace(/\?.*$/, '').replace(/#.*$/, '');
  const trimmed = normalizedPath.replace(/^\/+|\/+$/g, '');
  const parts = trimmed ? trimmed.split('/').filter(Boolean) : [];
  if (parts.length === 0) return undefined;

  const originMatch = fullUrl.match(/^(https?:\/\/[^/]+)/i);
  const origin = originMatch ? originMatch[1] : SITE_URL;
  const elements: Array<Record<string, unknown>> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: '首页',
      item: `${origin}/`
    }
  ];

  let current = '';
  for (let i = 0; i < parts.length; i += 1) {
    current += `/${parts[i]}`;
    const isLast = i === parts.length - 1;
    const itemUrl = isLast ? fullUrl : `${origin}${current}/`;
    elements.push({
      '@type': 'ListItem',
      position: i + 2,
      name: displayNameFromPathSegment(parts[i]),
      item: itemUrl
    });
  }

  return {
    '@type': 'BreadcrumbList',
    itemListElement: elements
  };
}


export default withMermaid(defineConfig({
  lang: 'zh-CN',
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  
  // 排除 docs/docs 目录不构建
  srcExclude: ['**/docs/**'],
  
  head: [
    ['meta', { name: 'baidu-site-verification', content: 'codeva-DyDGMBlEJg' }],
    ['meta', { name: 'keywords', content: 'Vibe Coding, 全栈开发, Next.js, TypeScript, React, Prisma, AI编程, Cursor, Claude' }],
    ['meta', { name: 'author', content: 'Eyre' }],
    ['meta', { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: SITE_TITLE }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['link', { rel: 'icon', href: '/logo.png', type: 'image/png' }],
    ['link', { rel: 'shortcut icon', href: '/logo.png', type: 'image/png' }],
    ['link', { rel: 'apple-touch-icon', href: '/logo.png' }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: SITE_TITLE, href: '/rss.xml' }],
    ['link', { rel: 'manifest', href: '/manifest.webmanifest' }],
    [
      'script',
      {
        defer: '',
        src: 'https://u.vibevibe.cn/script.js',
        'data-website-id': 'a1b0c652-8f34-4bc2-8c42-40fcaf521c9d'
      }
    ],
  ],

  ...(SITE_URL ? { sitemap: { hostname: SITE_URL } } : {}),

  transformHead: ({ pageData }): HeadConfig[] | void => {
    if (!SITE_URL) return;

    const url = `${SITE_URL}${urlPathForPage(pageData.relativePath)}`;
    const frontmatter = pageData.frontmatter as Record<string, unknown> | undefined;
    const frontmatterTitle = typeof frontmatter?.title === 'string' ? frontmatter.title : undefined;
    const frontmatterDescription =
      typeof frontmatter?.description === 'string' ? frontmatter.description : undefined;

    const title = frontmatterTitle || pageData.title || SITE_TITLE;
    const description = frontmatterDescription || pageData.description || SITE_DESCRIPTION;
    const frontmatterImage = typeof frontmatter?.image === 'string' ? frontmatter.image : undefined;
    const image = frontmatterImage
      ? (/^https?:\/\//i.test(frontmatterImage) ? frontmatterImage : `${SITE_URL}${frontmatterImage.startsWith('/') ? '' : '/'}${frontmatterImage}`)
      : `${SITE_URL}/logo.png`;

    const urlPath = urlPathForPage(pageData.relativePath);
    const breadcrumbList = buildBreadcrumbList(urlPath, url);
    const jsonLdGraph: Array<Record<string, unknown>> = [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_TITLE,
        description: SITE_DESCRIPTION,
        inLanguage: 'zh-CN'
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        inLanguage: 'zh-CN'
      }
    ];
    if (breadcrumbList) jsonLdGraph.push(breadcrumbList);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': jsonLdGraph
    };

    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:site_name', content: 'Vibe Vibe' }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:image', content: image }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: image }],
      ['script', { type: 'application/ld+json' }, safeJsonLd(jsonLd)],
    ];
  },

  transformPageData: async (pageData, ctx) => {
    const frontmatter = pageData.frontmatter as Record<string, unknown> | undefined;
    const frontmatterDescription = typeof frontmatter?.description === 'string' ? frontmatter.description : undefined;
    if (frontmatterDescription) return;
    if (pageData.description) return;

    const relativePath = pageData.relativePath;
    const fullPath = joinPath(ctx.siteConfig.srcDir, relativePath);

    try {
      const source = await readFile(fullPath, 'utf-8');
      const description = extractDescriptionFromMarkdown(source);
      if (!description) return;
      return { description };
    } catch {
      return;
    }
  },

  buildEnd: async (siteConfig) => {
    const sitemapLine = SITE_URL ? `\nSitemap: ${SITE_URL}/sitemap.xml\n` : '\n';
    const content = `User-agent: *\nAllow: /${sitemapLine}`;
    await writeFile(joinPath(siteConfig.outDir, 'robots.txt'), content, 'utf-8');

    const pages = siteConfig.pages
      .map((page) => (isAbsolutePath(page) ? relativePath(siteConfig.srcDir, page) : page))
      .map((page) => page.replace(/\\/g, '/'))
      .filter((page) => page.endsWith('.md'))
      .filter((page) => page !== '404.md');

    type RssItem = {
      title: string;
      link: string;
      description: string;
      pubDate: Date;
    };

    const items: RssItem[] = [];
    for (const page of pages) {
      const filePath = joinPath(siteConfig.srcDir, page);
      try {
        const source = await readFile(filePath, 'utf-8');
        const frontmatter = parseSimpleFrontmatter(source);
        const contentSource = stripFrontmatter(source);

        const title =
          frontmatter.title ||
          (contentSource.match(/^#\s+(.+)\s*$/m)?.[1]?.trim() || '') ||
          page.replace(/\/index\.md$/i, '').replace(/\.md$/i, '');

        const description =
          frontmatter.description ||
          extractDescriptionFromMarkdown(source) ||
          SITE_DESCRIPTION;

        const link = `${SITE_URL}${urlPathForPage(page)}`;

        const fileStats = await stat(filePath);
        const pubDateCandidate = frontmatter.date ? new Date(frontmatter.date) : undefined;
        const pubDate = pubDateCandidate && !Number.isNaN(pubDateCandidate.getTime()) ? pubDateCandidate : fileStats.mtime;

        items.push({ title, link, description, pubDate });
      } catch {
        continue;
      }
    }

    items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    const lastBuildDate = items[0]?.pubDate ?? new Date();
    const rssItemsXml = items
      .slice(0, 200)
      .map((item) => {
        const title = escapeXml(item.title);
        const link = escapeXml(item.link);
        const pubDate = escapeXml(item.pubDate.toUTCString());
        const description = safeCdata(item.description);
        return [
          '<item>',
          `<title>${title}</title>`,
          `<link>${link}</link>`,
          `<guid isPermaLink="true">${link}</guid>`,
          `<pubDate>${pubDate}</pubDate>`,
          `<description><![CDATA[${description}]]></description>`,
          '</item>'
        ].join('');
      })
      .join('');

    const channelTitle = escapeXml(SITE_TITLE);
    const channelLink = escapeXml(SITE_URL);
    const channelDescription = safeCdata(SITE_DESCRIPTION);
    const channelLanguage = 'zh-CN';
    const channelLastBuildDate = escapeXml(lastBuildDate.toUTCString());

    const rssXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '<channel>',
      `<title>${channelTitle}</title>`,
      `<link>${channelLink}</link>`,
      `<description><![CDATA[${channelDescription}]]></description>`,
      `<language>${channelLanguage}</language>`,
      `<lastBuildDate>${channelLastBuildDate}</lastBuildDate>`,
      rssItemsXml,
      '</channel>',
      '</rss>'
    ].join('');

    await writeFile(joinPath(siteConfig.outDir, 'rss.xml'), rssXml, 'utf-8');
  },

  // 1. Markdown 增强配置
  markdown: {
    // 开启数学公式 ($$ E=mc^2 $$)
    math: true,
    // 语言别名，消除 gitignore/env 警告
    languageAlias: {
      'gitignore': 'ini',
      'env': 'properties'
    },
    // 注册时间线插件
    config: (md) => {
      md.use(timeline);
    },
  },

  // 2. Mermaid 配置
  mermaid: {
    // refer to mermaid config options
  },


  vite: {
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifestFilename: 'manifest.webmanifest',
        includeAssets: ['logo.png', 'logo.svg'],
        devOptions: {
          enabled: true
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
        },
        manifest: {
          name: SITE_TITLE,
          short_name: 'Vibe Vibe',
          description: SITE_DESCRIPTION,
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/logo.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        }
      })
    ],
    ssr: {
      noExternal: ['vitepress-plugin-mermaid', 'mermaid']
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      allowedHosts: true
    }
  },

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'Vibe Vibe',
    
    nav: [
      { text: '首页', link: '/' },

      {
        text: '基础篇',
        items: [
          { text: '导览', link: '/Basic/' },
          { text: '0. 序章', link: '/Basic/00-preface/' },
          { text: '1. 觉醒：从码农到指挥官', link: '/Basic/01-awakening/' },
          { text: '2. 心法：核心思维', link: '/Basic/02-mindset/' },
          { text: '3. 技术：从想法到产品', link: '/Basic/03-technique/' },
          { text: '4. 从 0 到 1 实战', link: '/Basic/04-practice-0-to-1/' },
          { text: '5. 精进技能', link: '/Basic/05-advanced/' },
          { text: '附录', link: '/Basic/99-appendix/' },
          { text: '结语', link: '/Basic/100-epilogue/' },
          { text: '下部预告', link: '/Basic/101-next-part/' },
        ]
      },

      {
        text: '进阶篇',
        items: [
          { text: '导览', link: '/Advanced/' },
          { text: '01-环境搭建与包管理', link: '/Advanced/01-environment-setup/' },
          { text: '02-工具与AI调教', link: '/Advanced/02-dev-tools-ai-tuning/' },
          { text: '03-PRD与文档驱动', link: '/Advanced/03-prd-doc-driven/' },
          { text: '04-运行与构建', link: '/Advanced/04-build-and-runtime-modes/' },
          { text: '05-界面与交互', link: '/Advanced/05-ui-ux/' },
          { text: '06-环境变量与安全', link: '/Advanced/06-env-vars-security/' },
          { text: '07-数据持久化与数据库', link: '/Advanced/07-data-persistence-database/' },
          { text: '08-测试与自动化', link: '/Advanced/08-testing-automation/' },
          { text: '09-公网访问', link: '/Advanced/09-localhost-public-access/' },
          { text: '10-Git协作', link: '/Advanced/10-git-collaboration/' },
          { text: '11-无服务器部署与CI/CD', link: '/Advanced/11-serverless-deploy-cicd/' },
          { text: '12-域名与DNS', link: '/Advanced/12-domain-dns/' },
          { text: '13-云服务器部署', link: '/Advanced/13-vps-ops-deploy/' },
          { text: '14-SEO与分享统计', link: '/Advanced/14-seo-analytics/' },
          { text: '15-用户反馈与迭代', link: '/Advanced/15-user-feedback-iteration/' },
          { text: 'Next Level', link: '/Advanced/99-next-level/' },
          { text: '旧进阶篇（完整）', link: '/Advanced-old/' },
        ]
      },

      {
        text: '实践篇',
        items: [
          { text: '导览', link: '/Practice/' },
          { text: '文科生/商科生项目', link: '/Practice/01-for-liberal-arts/' },
          { text: '理工科学生项目', link: '/Practice/02-for-stem/' },
          { text: '职场人士项目', link: '/Practice/03-for-professionals/' },
          { text: '核心技能', link: '/Practice/10-core-skills/' },
          { text: 'AI Agent 开发', link: '/Practice/11-ai-agents/' },
          { text: '全栈项目实战', link: '/Practice/12-fullstack-projects/' },
          { text: '工具与效率', link: '/Practice/13-tools-integration/' },
        ]
      },

      {
        text: '优质文章篇',
        items: [
          { text: '导览', link: '/Articles/' },
          { text: '知名公司博客', link: '/Articles/01-company-blogs/' },
          { text: '优质播客', link: '/Articles/02-podcasts/' },
          { text: '研究报告', link: '/Articles/03-research-reports/' },
          { text: '优质 Newsletter', link: '/Articles/04-newsletters/' },
          { text: '开发者社区', link: '/Articles/05-communities/' },
        ]
      },
    ],
    
    // 核心：自动生成侧边栏
    sidebar: generateSidebar({
      documentRootPath: 'docs',
      useTitleFromFrontmatter: true,
      useTitleFromFileHeading: true,
      useFolderTitleFromIndexFile: true, 
      useFolderLinkFromIndexFile: true,
      hyphenToSpace: true,
      sortMenusByFrontmatterOrder: true,
      frontmatterOrderDefaultValue: 9999,
      
      manualSortFileNameByPriority: [
        'Basic', 'Advanced', 'Advanced-old', 'Practice', 'Articles',
        'Basic/00-preface', 'Basic/01-awakening', 'Basic/02-mindset', 'Basic/03-technique',
        'Basic/04-practice-0-to-1', 'Basic/05-advanced', 'Basic/06-learning-paths',
        'Basic/99-appendix', 'Basic/100-epilogue', 'Basic/101-next-part',
        'Practice/01-for-liberal-arts', 'Practice/02-for-stem', 'Practice/03-for-professionals',
        'Practice/10-core-skills', 'Practice/11-ai-agents', 'Practice/12-fullstack-projects', 'Practice/13-tools-integration',
        'Articles/01-company-blogs', 'Articles/02-podcasts', 'Articles/03-research-reports', 'Articles/04-newsletters', 'Articles/05-communities'
      ],
      
      collapsed: true,
      excludePattern: ['public', 'assets', 'docs'], 
    }),

    // editLink: {
    //   pattern: 'https://github.com/Eyre921/awesone-vibe-coding-tutorial/edit/main/docs/:path',
    //   text: '在 GitHub 上编辑此页'
    // },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    outline: {
      label: '页面导航',
      level: [2, 3]
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换'
            }
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/datawhalechina/vibe-vibe' }
    ],

    // footer: {
    //   message: '',
    //   copyright: ''
    // }
  }
}))
