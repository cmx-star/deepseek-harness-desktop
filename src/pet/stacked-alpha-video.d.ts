import type * as React from 'react'

/**
 * stacked-alpha-video 自定义元素（jakearchibald/stacked-alpha-video）的 React JSX 声明。
 *
 * 库自身声明了 `HTMLElementTagNameMap['stacked-alpha-video']`（全局 DOM API 层面），
 * React 的 JSX.IntrinsicElements 需要单独增强：桌宠窗口（WebKit，无 VP9-alpha 支持）
 * 用它把「上半颜色 + 下半 alpha 亮度」的堆叠视频合成为带透明通道的画布，见
 * src/pet/components/pet.tsx 的 stacked-alpha 渲染分支与 issue #434。
 *
 * `premultipliedalpha`：仅当源视频使用预乘 alpha（半透明边缘偏暗）时设 true；
 * dsh-pet 素材链（yuva420p / yuva444p 直通编码）默认非预乘，通常不需要。
 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'stacked-alpha-video': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        premultipliedalpha?: string
      }
    }
  }
}

export {}
