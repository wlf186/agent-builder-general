import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Agent Builder User Guide',

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      link: '/en/',
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
    },
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Agent Builder',

    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Core Features', link: '/core/' },
      { text: 'Advanced', link: '/advanced/' },
    ],

    sidebar: {
      '/en/': [
        {
          text: 'Getting Started',
          link: '/en/getting-started',
        },
        {
          text: 'Core Features',
          collapsed: false,
          items: [
            { text: 'Chat Interface', link: '/en/core/agent-chat' },
            { text: 'Managing Conversations', link: '/en/core/conversation-drawer' },
            { text: 'Creating Agents', link: '/en/core/sub-agent-selector' },
            { text: 'Knowledge Bases', link: '/en/core/knowledge-base-selector' },
            { text: 'Uploading Documents', link: '/en/core/document-uploader' },
            { text: 'File Attachments', link: '/en/core/file-uploader' },
          ],
        },
        {
          text: 'Advanced',
          collapsed: false,
          items: [
            { text: 'Model Services', link: '/en/advanced/model-service-dialog' },
            { text: 'MCP Services', link: '/en/advanced/mcp-service-dialog' },
            { text: 'Skills', link: '/en/advanced/skill-detail-dialog' },
          ],
        },
      ],
      '/zh/': [
        {
          text: '快速开始',
          link: '/zh/getting-started',
        },
        {
          text: '核心功能',
          collapsed: false,
          items: [
            { text: '聊天界面', link: '/zh/core/agent-chat' },
            { text: '管理对话', link: '/zh/core/conversation-drawer' },
            { text: '创建智能体', link: '/zh/core/sub-agent-selector' },
            { text: '知识库', link: '/zh/core/knowledge-base-selector' },
            { text: '上传文档', link: '/zh/core/document-uploader' },
            { text: '文件附件', link: '/zh/core/file-uploader' },
          ],
        },
        {
          text: '高级功能',
          collapsed: false,
          items: [
            { text: '模型服务', link: '/zh/advanced/model-service-dialog' },
            { text: 'MCP服务', link: '/zh/advanced/mcp-service-dialog' },
            { text: '技能', link: '/zh/advanced/skill-detail-dialog' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/anthropics/claude-code' },
    ],
  },
})
