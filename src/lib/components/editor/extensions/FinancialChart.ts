import { Node, mergeAttributes } from '@tiptap/core'

export interface FinancialChartOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    financialChart: {
      insertFinancialChart: (options?: { symbol?: string }) => ReturnType
    }
  }
}

export const FinancialChart = Node.create<FinancialChartOptions>({
  name: 'financialChart',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      symbol: {
        default: 'NASDAQ:AAPL',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="financial-chart"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'financial-chart' })]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'my-6 border border-gray-200 dark:border-dark-700 rounded-lg overflow-hidden bg-white dark:bg-dark-800'
      
      // Controls
      const controls = document.createElement('div')
      controls.className = 'p-2 bg-gray-50 dark:bg-dark-700 flex items-center gap-2 border-b border-gray-200 dark:border-dark-600'
      
      const label = document.createElement('span')
      label.textContent = 'Symbol:'
      label.className = 'text-xs font-bold text-gray-500 dark:text-dark-400 uppercase'
      
      const input = document.createElement('input')
      input.type = 'text'
      input.value = node.attrs.symbol
      input.className = 'bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded px-2 py-1 text-sm w-32 focus:ring-1 focus:ring-primary-500'
      
      const updateBtn = document.createElement('button')
      updateBtn.textContent = 'Update'
      updateBtn.className = 'px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded font-medium'
      
      updateBtn.onclick = () => {
        if (typeof getPos === 'function') {
          editor.commands.updateAttributes(getPos(), { symbol: input.value })
        }
      }
      
      controls.appendChild(label)
      controls.appendChild(input)
      controls.appendChild(updateBtn)
      dom.appendChild(controls)

      // Chart Container
      const chartContainer = document.createElement('div')
      chartContainer.className = 'h-[400px] w-full relative bg-gray-100 dark:bg-dark-900 flex items-center justify-center'
      
      // We can use TradingView's Lightweight Charts or just an iframe embed
      // For simplicity and "Substack-like" functionality which uses TradingView
      const iframe = document.createElement('iframe')
      iframe.style.width = '100%'
      iframe.style.height = '100%'
      iframe.style.border = 'none'
      // Using a generic TradingView widget URL constructor or similar
      // Note: This is a simplified embed URL. 
      iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${node.attrs.symbol}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC`
      
      chartContainer.appendChild(iframe)
      dom.appendChild(chartContainer)

      return {
        dom,
        update: (updatedNode) => {
            if (updatedNode.type.name !== 'financialChart') return false
            if (updatedNode.attrs.symbol !== node.attrs.symbol) {
                // Update chart src
                iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${updatedNode.attrs.symbol}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC`
                input.value = updatedNode.attrs.symbol
            }
            return true
        }
      }
    }
  },

  addCommands() {
    return {
      insertFinancialChart: (options) => ({ commands }) => {
        return commands.insertContent({ type: this.name, attrs: options })
      },
    }
  },
})
