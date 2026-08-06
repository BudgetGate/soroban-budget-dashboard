import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "BudgetGate",
  description: "Automated CI-native tracking of Soroban smart contract resource costs.",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is BudgetGate?', link: '/guide/' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Architecture', link: '/guide/architecture' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/BudgetGate' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present BudgetGate'
    }
  }
})
